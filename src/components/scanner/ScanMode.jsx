import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2, AlertTriangle, CheckCircle2, Sparkles, Trash2,
  RefreshCw, Type, Camera, Save, Printer, FileText, ArrowRight, Zap,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { lookupDtc } from "@/lib/dtcDatabase";
import ManualCodeEntry from "@/components/scanner/ManualCodeEntry";
import DtcCard from "@/components/scanner/DtcCard";
import InspectionDecision from "@/components/scanner/InspectionDecision";
import ScannerChat from "@/components/scanner/ScannerChat";

const TYPE_META = {
  stored: { label: "CONFIRMED", color: "text-red-400", dot: "bg-red-500", badge: "bg-red-500/15 text-red-400 border-red-500/30" },
  pending: { label: "PENDING", color: "text-amber-400", dot: "bg-amber-500", badge: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  permanent: { label: "PERMANENT", color: "text-gray-400", dot: "bg-gray-500", badge: "bg-gray-500/15 text-gray-400 border-gray-500/30" },
  manual: { label: "MANUAL", color: "text-sky-400", dot: "bg-sky-500", badge: "bg-sky-500/15 text-sky-400 border-sky-500/30" },
};

export default function ScanMode({
  clientRef,
  connState,
  selectedVehicle,
  customerId,
  customerName,
  vehicleId,
  user,
  laborRate,
  onSave,
  onPhotoUpload,
}) {
  const [reading, setReading] = useState(false);
  const [readProgress, setReadProgress] = useState("");
  const [readPct, setReadPct] = useState(0);
  const [dtcCodes, setDtcCodes] = useState([]);
  const [liveData, setLiveData] = useState(null);
  const [vin, setVin] = useState("");
  const [clearing, setClearing] = useState(false);
  const [clearedMsg, setClearedMsg] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [dtcLookupResults, setDtcLookupResults] = useState({});
  const lookedUpRef = useRef(new Set());
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [creatingAction, setCreatingAction] = useState({});
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [connError, setConnError] = useState("");

  const vehicleDesc = selectedVehicle
    ? `${selectedVehicle.year || ""} ${selectedVehicle.make || ""} ${selectedVehicle.model || ""} ${selectedVehicle.engine_type || ""}`.trim()
    : "Unknown vehicle";

  // AI lookup for unknown DTC codes
  useEffect(() => {
    if (!dtcCodes.length) return;
    dtcCodes.forEach(async (c) => {
      if (lookupDtc(c.code) || lookedUpRef.current.has(c.code)) return;
      lookedUpRef.current.add(c.code);
      try {
        const result = await base44.integrations.Core.InvokeLLM({
          prompt: `You are LBC AUTO AI SCANNER. Look up this OBD2 code: ${c.code} for a ${vehicleDesc}. Return ONLY: code name, system, severity (HIGH/MEDIUM/LOW), top 3 likely causes, labor hours range, and estimated repair cost range in CAD. Be consistent — same code always gets same answer.`,
          add_context_from_internet: true,
          model: "gemini_3_flash",
          response_json_schema: {
            type: "object",
            properties: {
              name: { type: "string" },
              system: { type: "string" },
              severity: { type: "string", enum: ["HIGH", "MEDIUM", "LOW"] },
              causes: { type: "array", items: { type: "string" } },
              labor_min: { type: "number" },
              labor_max: { type: "number" },
              cost_min: { type: "number" },
              cost_max: { type: "number" },
            },
          },
        });
        const isAxios = result && typeof result === "object" && "status" in result && "headers" in result;
        const data = isAxios ? result.data : result;
        setDtcLookupResults(prev => ({ ...prev, [c.code]: data }));
      } catch (e) {
        setDtcLookupResults(prev => ({ ...prev, [c.code]: null }));
      }
    });
  }, [dtcCodes, vehicleDesc]);

  const handleFullScan = async () => {
    if (!clientRef.current) return;
    setReading(true);
    setConnError("");
    setClearedMsg("");
    setAnalysis(null);
    setDtcCodes([]);
    setReadPct(0);
    try {
      const { codes, vin: scannedVin } = await clientRef.current.fullSystemScan((label, pct) => {
        setReadProgress(label);
        setReadPct(pct);
      });
      setDtcCodes(codes);
      setVin(scannedVin || "");
      setReadProgress("Pulling live sensor data...");
      const live = await clientRef.current.readLiveData();
      setLiveData(live);
    } catch (err) {
      setConnError(err?.message || "Failed to scan vehicle.");
    } finally {
      setReading(false);
      setReadProgress("");
      setReadPct(0);
    }
  };

  const handleClearCodes = async () => {
    if (!clientRef.current) return;
    if (!window.confirm("Clear all trouble codes and turn off the check engine light?")) return;
    setClearing(true);
    try {
      const ok = await clientRef.current.clearDTCs();
      setClearedMsg(ok ? "✓ Codes cleared. Run engine and rescan to verify." : "Adapter didn't confirm — codes may not have cleared.");
      if (ok) setDtcCodes([]);
    } catch (err) {
      setConnError(err?.message || "Failed to clear codes.");
    } finally {
      setClearing(false);
    }
  };

  const handleManualEntry = (codes) => {
    const seen = new Set(dtcCodes.map(c => c.code));
    const merged = [...dtcCodes];
    for (const code of codes) {
      if (!seen.has(code)) {
        seen.add(code);
        merged.push({ code, type: "manual", raw: code });
      }
    }
    setDtcCodes(merged);
    setShowManualEntry(false);
    setAnalysis(null);
    setClearedMsg("");
  };

  const handleAnalyze = async () => {
    if (!dtcCodes.length) return;
    setAnalyzing(true);
    try {
      const res = await base44.functions.invoke("lbcDiagAI", {
        mode: "analyze", codes: dtcCodes, live_data: liveData, vehicle: vehicleDesc,
      });
      setAnalysis(res.data.analysis);
    } catch (err) {
      setConnError(err?.message || "AI analysis failed.");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleChatSend = async () => {
    const text = chatInput.trim();
    if (!text || chatLoading) return;
    setChatInput("");
    const newMessages = [...chatMessages, { role: "user", content: text }];
    setChatMessages(newMessages);
    setChatLoading(true);
    try {
      const res = await base44.functions.invoke("lbcDiagAI", {
        mode: "chat", codes: dtcCodes, live_data: liveData, vehicle: vehicleDesc, messages: newMessages,
      });
      setChatMessages(prev => [...prev, { role: "assistant", content: res.data.reply }]);
    } catch (err) {
      setChatMessages(prev => [...prev, { role: "assistant", content: "⚠️ " + (err?.message || "AI couldn't respond.") }]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleCreateEstimateFromCard = async (code, dtcInfo) => {
    if (!vehicleId || !customerId || !dtcInfo) return;
    setCreatingAction(prev => ({ ...prev, [code]: "estimate" }));
    try {
      const taxRate = parseFloat(user?.tax_rate) || 0;
      const taxAppliesTo = user?.tax_applies_to || "both";
      const avgLabor = (dtcInfo.labor_min + dtcInfo.labor_max) / 2;
      const avgCost = (dtcInfo.cost_min + dtcInfo.cost_max) / 2;
      const laborTotal = avgLabor * laborRate;
      const partsTotal = Math.max(0, avgCost - laborTotal);
      let taxableAmount = 0;
      if (taxAppliesTo === "labor") taxableAmount = laborTotal;
      else if (taxAppliesTo === "parts") taxableAmount = partsTotal;
      else if (taxAppliesTo === "both") taxableAmount = laborTotal + partsTotal;
      const taxAmount = Math.round(taxableAmount * (taxRate / 100) * 100) / 100;
      const grandTotal = Math.round((laborTotal + partsTotal + taxAmount) * 100) / 100;

      const created = await base44.entities.Estimate.create({
        estimate_number: `EST-${Date.now().toString().slice(-6)}`,
        customer_id: customerId,
        customer_name: customerName || "",
        vehicle_id: vehicleId,
        vehicle_info: vehicleDesc,
        status: "draft",
        service_reason: `${code} — ${dtcInfo.name}`,
        notes: `Generated from LBC AUTO AI SCANNER.\n\nLikely causes:\n${dtcInfo.causes.map(c => `- ${c}`).join("\n")}\n\nEstimated repair: $${dtcInfo.cost_min} – $${dtcInfo.cost_max}\nEstimated labor: ${dtcInfo.labor_min} – ${dtcInfo.labor_max} hrs @ $${laborRate}/hr`,
        labor_items: [{ description: `${code} — ${dtcInfo.name}`, hours: avgLabor, rate: laborRate, total: laborTotal }],
        parts_items: [],
        labor_total: laborTotal,
        parts_total: partsTotal,
        tax_rate: taxRate,
        tax_applies_to: taxAppliesTo,
        tax_amount: taxAmount,
        discount: 0,
        discount_type: "$",
        grand_total: grandTotal,
      });
      window.location.href = `/EstimateDetail/${created.id}`;
    } catch (err) {
      setConnError(err?.message || "Failed to create estimate.");
    } finally {
      setCreatingAction(prev => ({ ...prev, [code]: null }));
    }
  };

  const handleAddToRepairOrderFromCard = async (code, dtcInfo) => {
    if (!vehicleId || !customerId || !dtcInfo) return;
    setCreatingAction(prev => ({ ...prev, [code]: "ro" }));
    try {
      const avgLabor = (dtcInfo.labor_min + dtcInfo.labor_max) / 2;
      const laborCost = avgLabor * laborRate;

      const created = await base44.entities.RepairOrder.create({
        order_number: `RO-${Date.now().toString().slice(-6)}`,
        customer_id: customerId,
        customer_name: customerName || "",
        vehicle_id: vehicleId,
        vehicle_info: vehicleDesc,
        description: `${code} — ${dtcInfo.name}`,
        status: "waiting",
        labor_items: [{ description: `${code} — ${dtcInfo.name}`, hours: avgLabor, rate: laborRate, total: laborCost }],
        labor_hours: avgLabor,
        labor_cost: laborCost,
        parts_used: [],
        parts_cost: 0,
        total_cost: laborCost,
      });
      window.location.href = `/RepairOrderDetail/${created.id}`;
    } catch (err) {
      setConnError(err?.message || "Failed to create repair order.");
    } finally {
      setCreatingAction(prev => ({ ...prev, [code]: null }));
    }
  };

  const handleSave = async () => {
    if (!vehicleId) return;
    setSaving(true);
    setSavedMsg("");
    try {
      await onSave({
        customer_id: customerId || undefined,
        customer_name: customerName || undefined,
        vehicle_id: vehicleId,
        vehicle_info: vehicleDesc,
        dtc_codes: dtcCodes,
        live_data_snapshot: liveData || undefined,
        ai_analysis: analysis || undefined,
        codes_cleared: !!clearedMsg,
        notes: notes || undefined,
        status: clearedMsg ? "Codes Cleared" : (dtcCodes.length ? "Needs Follow-up" : "Completed"),
      });
      setSavedMsg("Scan saved to vehicle history.");
    } catch (err) {
      setSavedMsg("Failed to save: " + (err?.message || "unknown error"));
    } finally {
      setSaving(false);
    }
  };

  const connected = connState === "connected";

  return (
    <div className="space-y-4">
      {connError && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-300 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {connError}
        </div>
      )}

      {/* Action bar */}
      <div className="flex gap-3 flex-wrap">
        <Button
          onClick={handleFullScan}
          disabled={reading || !connected}
          className="bg-teal-500 hover:bg-teal-600 text-white gap-2"
        >
          {reading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {reading ? "SCANNING..." : "FULL SYSTEM SCAN"}
        </Button>
        <Button
          onClick={() => setShowManualEntry(!showManualEntry)}
          variant="outline"
          className="border-gray-700 text-gray-300 gap-2"
        >
          <Type className="w-4 h-4" /> ENTER CODE
        </Button>
        <Button
          onClick={onPhotoUpload}
          variant="outline"
          className="border-gray-700 text-gray-300 gap-2"
        >
          <Camera className="w-4 h-4" /> PHOTO
        </Button>
      </div>

      {/* Progress bar */}
      {reading && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-400">{readProgress}</span>
            <span className="text-teal-400 font-mono font-bold">{readPct}%</span>
          </div>
          <div className="h-2 rounded-full bg-gray-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-teal-500 to-cyan-400 transition-all duration-300"
              style={{ width: `${readPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Manual entry */}
      {showManualEntry && <ManualCodeEntry onSubmit={handleManualEntry} />}

      {/* VIN read from the vehicle */}
      {vin && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-3 flex items-center gap-2">
          <span className="text-xs text-gray-500 font-semibold uppercase tracking-wide">VIN</span>
          <span className="text-sm text-teal-400 font-mono font-bold tracking-wider">{vin}</span>
        </div>
      )}

      {/* Fault code badges summary */}
      {dtcCodes.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {dtcCodes.map((c, i) => {
            const meta = TYPE_META[c.type] || TYPE_META.manual;
            return (
              <span
                key={i}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold border ${meta.badge}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                {c.code}
              </span>
            );
          })}
        </div>
      )}

      {/* AI Master Diagnosis */}
      {dtcCodes.length > 0 && (
        <div className="bg-gradient-to-br from-purple-500/10 to-fuchsia-500/5 border border-purple-500/30 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="text-white font-bold text-sm flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              AI MASTER DIAGNOSIS
            </h2>
            <div className="flex gap-2">
              <Button onClick={handleAnalyze} disabled={analyzing} size="sm" className="bg-purple-500 hover:bg-purple-600 text-white gap-2">
                {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {analyzing ? "Analyzing..." : "AI ANALYZE"}
              </Button>
              <Button onClick={handleClearCodes} disabled={clearing} variant="outline" size="sm" className="border-red-500/40 text-red-400 hover:bg-red-500/10 gap-2">
                {clearing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Clear Codes
              </Button>
            </div>
          </div>

          {clearedMsg && (
            <div className="text-sm text-emerald-400 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> {clearedMsg}
            </div>
          )}

          {!analysis && !analyzing && (
            <div className="text-gray-500 text-sm text-center py-4">
              Click AI ANALYZE for a holistic root-cause analysis of all {dtcCodes.length} codes found.
            </div>
          )}

          {analyzing && (
            <div className="flex items-center justify-center gap-2 py-6">
              <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
              <span className="text-gray-400 text-sm">Analyzing all codes as a system...</span>
            </div>
          )}

          {analysis && !analyzing && (
            <>
              {analysis.summary && (
                <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4 text-sm text-purple-200 leading-relaxed">
                  {analysis.summary}
                </div>
              )}
              {analysis.root_cause_analysis && (
                <div className="bg-amber-500/10 border border-amber-500/40 rounded-lg p-4 space-y-1">
                  <h3 className="text-amber-400 font-bold text-sm flex items-center gap-2 uppercase tracking-wide">
                    <Zap className="w-3.5 h-3.5" /> Root Cause Analysis
                  </h3>
                  <p className="text-gray-200 text-sm leading-relaxed whitespace-pre-wrap">{analysis.root_cause_analysis}</p>
                </div>
              )}
              {analysis.inspection_decision && (
                <InspectionDecision decision={analysis.inspection_decision} />
              )}
              {analysis.shop_advice && (
                <div className="bg-sky-500/10 border border-sky-500/30 rounded-lg p-4 space-y-2">
                  <h3 className="text-sky-400 font-semibold text-sm flex items-center gap-2">
                    <Sparkles className="w-4 h-4" /> Shop Advice
                  </h3>
                  {analysis.shop_advice.total_estimated_cost != null && (
                    <p className="text-gray-300 text-sm">
                      <span className="text-gray-500">Total estimated cost:</span>{" "}
                      <span className="text-white font-bold">${analysis.shop_advice.total_estimated_cost.toFixed(2)}</span>
                    </p>
                  )}
                  {analysis.shop_advice.priority_order && (
                    <p className="text-gray-300 text-sm"><span className="text-gray-500">Priority:</span> {analysis.shop_advice.priority_order}</p>
                  )}
                  {analysis.shop_advice.recommended_action && (
                    <p className="text-gray-300 text-sm"><span className="text-gray-500">Tell customer:</span> {analysis.shop_advice.recommended_action}</p>
                  )}
                </div>
              )}
              <ScannerChat
                messages={chatMessages}
                input={chatInput}
                loading={chatLoading}
                onInputChange={setChatInput}
                onSend={handleChatSend}
              />
            </>
          )}
        </div>
      )}

      {/* DTC Cards */}
      {dtcCodes.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3">
          <h2 className="text-white font-semibold text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            FAULT CODES ({dtcCodes.length} found)
            <span className="text-xs text-gray-500 font-normal ml-1">
              · {dtcCodes.filter(c => c.type === "stored").length} confirmed ·{" "}
              {dtcCodes.filter(c => c.type === "pending").length} pending ·{" "}
              {dtcCodes.filter(c => c.type === "permanent").length} permanent
            </span>
          </h2>
          <div className="space-y-3">
            {dtcCodes.map((c, i) => {
              const dbInfo = lookupDtc(c.code);
              const aiInfo = dtcLookupResults[c.code];
              const dtcInfo = dbInfo || aiInfo || null;
              const loading = !dbInfo && !(c.code in dtcLookupResults);
              return (
                <DtcCard
                  key={i}
                  codeObj={c}
                  dtcInfo={dtcInfo}
                  loading={loading}
                  laborRate={laborRate}
                  canCreate={!!vehicleId && !!customerId}
                  creating={creatingAction[c.code]}
                  onCreateEstimate={() => handleCreateEstimateFromCard(c.code, dtcInfo)}
                  onAddToRepairOrder={() => handleAddToRepairOrderFromCard(c.code, dtcInfo)}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Save / Print */}
      {dtcCodes.length > 0 && vehicleId && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3">
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Technician notes about this scan (optional)..."
            className="bg-gray-800 border-gray-700 text-white"
            rows={3}
          />
          <div className="flex items-center gap-3 flex-wrap">
            <Button onClick={handleSave} disabled={saving} className="bg-sky-500 hover:bg-sky-600 text-white gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? "Saving..." : "Save to Vehicle History"}
            </Button>
            <Button onClick={() => window.print()} variant="outline" className="border-gray-700 text-gray-300 gap-2">
              <Printer className="w-4 h-4" /> Print Report
            </Button>
            {savedMsg && <span className="text-sm text-gray-400">{savedMsg}</span>}
          </div>
        </div>
      )}

      {/* Empty state */}
      {dtcCodes.length === 0 && !reading && (
        <div className="bg-gray-900 border border-gray-800 border-dashed rounded-xl p-12 text-center">
          <RefreshCw className="w-10 h-10 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">
            {connected
              ? "Ready to scan. Click FULL SYSTEM SCAN to pull all fault codes from the vehicle."
              : "Connect a BLE OBD2 adapter to start scanning, or enter codes manually."}
          </p>
        </div>
      )}
    </div>
  );
}