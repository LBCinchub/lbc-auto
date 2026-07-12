import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2, AlertTriangle, CheckCircle2, Gauge, Sparkles, Save,
  RefreshCw, Printer, FileText, ArrowRight, Type, Microscope, Trash2,
} from "lucide-react";
import QuickAddCustomerDialog from "@/components/diagnostics/QuickAddCustomerDialog";
import QuickAddVehicleDialog from "@/components/diagnostics/QuickAddVehicleDialog";
import { ELM327Client } from "@/lib/obd/elm327";
import { lookupDtc, parseDtcInput } from "@/lib/dtcDatabase";
import ConnectionPanel from "@/components/scanner/ConnectionPanel";
import VehiclePanel from "@/components/scanner/VehiclePanel";
import ManualCodeEntry from "@/components/scanner/ManualCodeEntry";
import DtcCard from "@/components/scanner/DtcCard";
import InspectionDecision from "@/components/scanner/InspectionDecision";
import ScannerChat from "@/components/scanner/ScannerChat";
import ScannerPrintReport from "@/components/scanner/ScannerPrintReport";

export default function Diagnostics() {
  const [user, setUser] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [customerId, setCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [vehicles, setVehicles] = useState([]);
  const [vehicleId, setVehicleId] = useState("");

  const [connState, setConnState] = useState("disconnected");
  const [adapterName, setAdapterName] = useState("");
  const [connError, setConnError] = useState("");
  const clientRef = useRef(null);

  const [reading, setReading] = useState(false);
  const [readProgress, setReadProgress] = useState("");
  const [dtcCodes, setDtcCodes] = useState([]);
  const [liveData, setLiveData] = useState(null);
  const [clearing, setClearing] = useState(false);
  const [clearedMsg, setClearedMsg] = useState("");

  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [dtcLookupResults, setDtcLookupResults] = useState({});
  const lookedUpRef = useRef(new Set());

  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [savedScanId, setSavedScanId] = useState(null);

  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [creatingAction, setCreatingAction] = useState({});

  const navigate = useNavigate();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
    base44.entities.Customer.list("-created_date", 500).then(setCustomers).catch(() => {});
    return () => { clientRef.current?.disconnect(); };
  }, []);

  useEffect(() => {
    if (!customerId) { setVehicles([]); setVehicleId(""); return; }
    base44.entities.Vehicle.filter({ customer_id: customerId }).then(setVehicles).catch(() => setVehicles([]));
  }, [customerId]);

  const selectedVehicle = vehicles.find(v => v.id === vehicleId);
  const bleSupported = ELM327Client.isSupported();
  const laborRate = parseFloat(user?.labor_rate) || 120;

  // Lookup unknown DTC codes via AI (only for codes not in DTC_DATABASE)
  useEffect(() => {
    if (!dtcCodes.length) return;
    const vehicleDesc = selectedVehicle
      ? `${selectedVehicle.year || ""} ${selectedVehicle.make || ""} ${selectedVehicle.model || ""}`.trim()
      : "Unknown vehicle";

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
  }, [dtcCodes]);

  // ── BLE handlers ──────────────────────────────────────────────────────
  const handleConnect = async () => {
    setConnError("");
    setConnState("connecting");
    try {
      const client = new ELM327Client();
      const info = await client.connect();
      clientRef.current = client;
      setAdapterName(info.name);
      setConnState("connected");
    } catch (err) {
      setConnState("error");
      setConnError(err?.message || "Couldn't connect to the adapter.");
    }
  };

  const handleDisconnect = async () => {
    await clientRef.current?.disconnect();
    clientRef.current = null;
    setConnState("disconnected");
    setAdapterName("");
    setDtcCodes([]);
    setLiveData(null);
    setAnalysis(null);
  };

  const handleReadCodes = async () => {
    if (!clientRef.current) return;
    setReading(true);
    setConnError("");
    setClearedMsg("");
    setAnalysis(null);
    setReadProgress("Talking to the vehicle's computer...");
    try {
      const stored = await clientRef.current.readDTCs((attempt, total) => {
        setReadProgress(attempt === 1
          ? "Talking to the vehicle's computer..."
          : `Still trying (attempt ${attempt}/${total})... this can take up to a minute on first connect.`);
      });
      setReadProgress("Checking for pending codes...");
      const pending = await clientRef.current.readPendingDTCs();
      setReadProgress("Checking for permanent codes...");
      const permanent = await clientRef.current.readPermanentDTCs();
      setReadProgress("Pulling live sensor data...");
      const live = await clientRef.current.readLiveData();

      const seen = new Set();
      const merged = [];
      const addCodes = (arr, type) => {
        for (const c of arr) {
          if (seen.has(c.code)) continue;
          seen.add(c.code);
          merged.push({ ...c, type });
        }
      };
      addCodes(stored, "stored");
      addCodes(pending, "pending");
      addCodes(permanent, "permanent");

      setDtcCodes(merged);
      setLiveData(live);
    } catch (err) {
      setConnError(err?.message || "Failed to read codes from the vehicle.");
    } finally {
      setReading(false);
      setReadProgress("");
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

  // ── AI holistic analysis ──────────────────────────────────────────────
  const handleAnalyze = async () => {
    if (!dtcCodes.length) return;
    setAnalyzing(true);
    try {
      const vehicleDesc = selectedVehicle
        ? `${selectedVehicle.year || ""} ${selectedVehicle.make || ""} ${selectedVehicle.model || ""} ${selectedVehicle.engine_type || ""}`.trim()
        : "Unknown vehicle";
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
      const vehicleDesc = selectedVehicle
        ? `${selectedVehicle.year || ""} ${selectedVehicle.make || ""} ${selectedVehicle.model || ""} ${selectedVehicle.engine_type || ""}`.trim()
        : "Unknown vehicle";
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

  // ── Save / Print ───────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!vehicleId) return;
    setSaving(true);
    setSavedMsg("");
    try {
      const vehicleInfo = selectedVehicle
        ? `${selectedVehicle.year || ""} ${selectedVehicle.make || ""} ${selectedVehicle.model || ""}`.trim()
        : undefined;
      const created = await base44.entities.DiagnosticScan.create({
        customer_id: customerId || undefined,
        customer_name: customerName || undefined,
        vehicle_id: vehicleId,
        vehicle_info: vehicleInfo,
        shop_owner_email: user?.email,
        adapter_name: adapterName || undefined,
        mileage: selectedVehicle?.mileage || undefined,
        dtc_codes: dtcCodes,
        live_data_snapshot: liveData || undefined,
        ai_analysis: analysis || undefined,
        codes_cleared: !!clearedMsg,
        notes: notes || undefined,
        status: clearedMsg ? "Codes Cleared" : (dtcCodes.length ? "Needs Follow-up" : "Completed"),
      });
      setSavedScanId(created?.id || null);
      setSavedMsg("Scan saved to this vehicle's history.");
    } catch (err) {
      setSavedMsg("Failed to save: " + (err?.message || "unknown error"));
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => window.print();

  // ── Per-card Create Estimate / Add to Repair Order ────────────────────
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
      const taxAmount = taxableAmount * (taxRate / 100);
      const grandTotal = laborTotal + partsTotal + taxAmount;

      const vehicleInfo = selectedVehicle
        ? `${selectedVehicle.year || ""} ${selectedVehicle.make || ""} ${selectedVehicle.model || ""}`.trim() : "";

      const created = await base44.entities.Estimate.create({
        estimate_number: `EST-${Date.now().toString().slice(-6)}`,
        customer_id: customerId,
        customer_name: customerName || "",
        vehicle_id: vehicleId,
        vehicle_info: vehicleInfo,
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
      navigate(`/EstimateDetail/${created.id}`);
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
      const vehicleInfo = selectedVehicle
        ? `${selectedVehicle.year || ""} ${selectedVehicle.make || ""} ${selectedVehicle.model || ""}`.trim() : "";

      const created = await base44.entities.RepairOrder.create({
        order_number: `RO-${Date.now().toString().slice(-6)}`,
        customer_id: customerId,
        customer_name: customerName || "",
        vehicle_id: vehicleId,
        vehicle_info: vehicleInfo,
        description: `${code} — ${dtcInfo.name}`,
        status: "waiting",
        labor_items: [{ description: `${code} — ${dtcInfo.name}`, hours: avgLabor, rate: laborRate, total: laborCost }],
        labor_hours: avgLabor,
        labor_cost: laborCost,
        parts_used: [],
        parts_cost: 0,
        total_cost: laborCost,
      });
      navigate(`/RepairOrderDetail/${created.id}`);
    } catch (err) {
      setConnError(err?.message || "Failed to create repair order.");
    } finally {
      setCreatingAction(prev => ({ ...prev, [code]: null }));
    }
  };

  const handleCustomerCreated = (newCustomer) => {
    setCustomers(prev => [newCustomer, ...prev]);
    setCustomerId(newCustomer.id);
    setCustomerName(newCustomer.full_name);
  };

  const handleVehicleCreated = (newVehicle) => {
    setVehicles(prev => [newVehicle, ...prev]);
    setVehicleId(newVehicle.id);
  };

  const reportVehicleInfo = selectedVehicle
    ? `${selectedVehicle.year || ""} ${selectedVehicle.make || ""} ${selectedVehicle.model || ""}`.trim()
    : "—";

  // ── Pro gate ───────────────────────────────────────────────────────────
  if (user && user.plan_tier !== "pro" && user.plan_tier !== "legacy") {
    return (
      <div className="max-w-lg mx-auto mt-16 text-center space-y-4 bg-gray-900 border border-gray-800 rounded-xl p-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-500/5 to-transparent pointer-events-none" />
        <Microscope className="w-10 h-10 text-fuchsia-400 mx-auto relative" />
        <h2 className="text-xl font-bold text-white relative">LBC AUTO AI SCANNER</h2>
        <p className="text-fuchsia-400 text-sm font-semibold relative">Pro Feature</p>
        <p className="text-gray-400 text-sm relative">
          Live Bluetooth OBD2 scanning, AI-powered diagnosis with consistent results, and one-click
          estimate generation are included on the Pro plan ($299/mo). You're currently on Basic.
        </p>
        <Button onClick={() => (window.location.href = "/Billing")} className="bg-fuchsia-600 hover:bg-fuchsia-700 text-white relative">
          Upgrade to Pro
        </Button>
      </div>
    );
  }

  // ── Main render ────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #diag-print-report, #diag-print-report * { visibility: visible !important; }
          #diag-print-report { position: absolute; left: 0; top: 0; width: 100%; padding: 24px; }
          .no-print { display: none !important; }
        }
      `}</style>

      {/* ── Header ── */}
      <div className="bg-gradient-to-br from-gray-900 to-gray-950 border border-gray-800 rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Microscope className="w-6 h-6 text-fuchsia-400" />
              LBC AUTO AI SCANNER
            </h1>
            <p className="text-sm text-gray-400 mt-1">Powered by LBC Auto AI</p>
          </div>
          <span className="bg-fuchsia-500/15 text-fuchsia-400 border border-fuchsia-500/30 rounded-full px-3 py-1 text-xs font-bold">
            PRO
          </span>
        </div>
      </div>

      {!bleSupported && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-200">
            Your browser doesn't support Web Bluetooth. Use Chrome or Edge on Android or desktop — not supported on iOS Safari.
          </div>
        </div>
      )}

      {/* ── Vehicle + Connection ── */}
      <div className="grid lg:grid-cols-2 gap-4">
        <VehiclePanel
          customers={customers}
          customerId={customerId}
          customerName={customerName}
          vehicles={vehicles}
          vehicleId={vehicleId}
          selectedVehicle={selectedVehicle}
          onCustomerChange={(id, name) => { setCustomerId(id); setCustomerName(name); }}
          onVehicleChange={setVehicleId}
          onAddCustomer={() => setShowAddCustomer(true)}
          onAddVehicle={() => setShowAddVehicle(true)}
        />
        <ConnectionPanel
          connState={connState}
          adapterName={adapterName}
          connError={connError}
          readProgress={readProgress}
          bleSupported={bleSupported}
          onConnect={handleConnect}
          onDisconnect={handleDisconnect}
        />
      </div>

      {/* ── Action bar ── */}
      <div className="flex gap-3 flex-wrap no-print">
        <Button
          onClick={handleReadCodes}
          disabled={reading || connState !== "connected"}
          className="bg-teal-500 hover:bg-teal-600 text-white gap-2"
        >
          {reading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          LIVE SCAN
        </Button>
        <Button
          onClick={() => setShowManualEntry(!showManualEntry)}
          variant="outline"
          className="border-gray-700 text-gray-300 gap-2"
        >
          <Type className="w-4 h-4" /> ENTER CODE MANUALLY
        </Button>
      </div>

      {/* ── Manual entry ── */}
      {showManualEntry && (
        <ManualCodeEntry onSubmit={handleManualEntry} />
      )}

      {/* ── Live data ── */}
      {liveData && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-white font-semibold text-sm flex items-center gap-2 mb-4">
            <Gauge className="w-4 h-4 text-sky-400" /> Live Data
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {liveData.rpm !== undefined && <LiveStat label="RPM" value={Math.round(liveData.rpm)} />}
            {liveData.speed_kph !== undefined && <LiveStat label="Speed" value={`${liveData.speed_kph} km/h`} />}
            {liveData.coolant_temp_c !== undefined && <LiveStat label="Coolant Temp" value={`${liveData.coolant_temp_c}°C`} />}
            {liveData.intake_temp_c !== undefined && <LiveStat label="Intake Temp" value={`${liveData.intake_temp_c}°C`} />}
            {liveData.engine_load_pct !== undefined && <LiveStat label="Engine Load" value={`${liveData.engine_load_pct}%`} />}
            {liveData.fuel_level_pct !== undefined && <LiveStat label="Fuel Level" value={`${liveData.fuel_level_pct}%`} />}
          </div>
        </div>
      )}

      {/* ── Scan results ── */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4 no-print">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-white font-semibold text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            SCAN RESULTS
            {dtcCodes.length > 0 && (
              <span className="text-xs text-gray-500 font-normal ml-1">
                ({dtcCodes.length} codes — {dtcCodes.filter(c => c.type === "stored").length} stored ·{" "}
                {dtcCodes.filter(c => c.type === "pending").length} pending ·{" "}
                {dtcCodes.filter(c => c.type === "permanent").length} permanent)
              </span>
            )}
          </h2>
          {dtcCodes.length > 0 && (
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
          )}
        </div>

        {clearedMsg && (
          <div className="text-sm text-emerald-400 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" /> {clearedMsg}
          </div>
        )}

        {dtcCodes.length === 0 ? (
          <div className="bg-gray-800/40 border border-gray-700 border-dashed rounded-lg p-8 text-center">
            <Microscope className="w-8 h-8 text-gray-600 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">No scan performed yet. Connect Vgate BLE and click LIVE SCAN, or enter codes manually.</p>
          </div>
        ) : (
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
        )}
      </div>

      {/* ── AI Diagnosis ── */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4 no-print">
        <h2 className="text-white font-semibold text-sm flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-400" /> AI DIAGNOSIS
        </h2>

        {!analysis && !analyzing && (
          <div className="bg-gray-800/40 border border-gray-700 border-dashed rounded-lg p-8 text-center">
            <Sparkles className="w-8 h-8 text-gray-600 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">
              {dtcCodes.length > 0
                ? "Click AI ANALYZE above for a holistic root-cause analysis of all codes."
                : "AI analysis will appear here after a scan."}
            </p>
          </div>
        )}

        {analyzing && (
          <div className="flex items-center justify-center gap-2 py-8">
            <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
            <span className="text-gray-400 text-sm">Analyzing codes...</span>
          </div>
        )}

        {analysis && !analyzing && (
          <>
            {analysis.summary && (
              <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4 text-sm text-purple-200">
                {analysis.summary}
              </div>
            )}
            {analysis.root_cause_analysis && (
              <div className="bg-amber-500/10 border border-amber-500/40 rounded-lg p-4 space-y-1">
                <h3 className="text-amber-400 font-bold text-sm flex items-center gap-2 uppercase tracking-wide">
                  ⚡ Root Cause Analysis
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
                  <Sparkles className="w-4 h-4" /> LBC Auto AI — Shop Advice
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
                  <p className="text-gray-300 text-sm"><span className="text-gray-500">Tell the customer:</span> {analysis.shop_advice.recommended_action}</p>
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

      {/* ── Save / Print ── */}
      {(dtcCodes.length > 0 || liveData) && vehicleId && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3 no-print">
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
              {saving ? "Saving..." : "Save Scan to Vehicle History"}
            </Button>
            <Button onClick={handlePrint} variant="outline" className="border-gray-700 text-gray-300 gap-2">
              <Printer className="w-4 h-4" /> Print Report
            </Button>
            {savedMsg && <span className="text-sm text-gray-400">{savedMsg}</span>}
          </div>
        </div>
      )}

      {/* ── Quick-add dialogs ── */}
      <QuickAddCustomerDialog open={showAddCustomer} onClose={() => setShowAddCustomer(false)} onSaved={handleCustomerCreated} />
      <QuickAddVehicleDialog
        open={showAddVehicle}
        onClose={() => setShowAddVehicle(false)}
        onSaved={handleVehicleCreated}
        customer={customerId ? { id: customerId, full_name: customerName } : null}
      />

      {/* ── Print report ── */}
      <ScannerPrintReport
        customerName={customerName}
        vehicleInfo={reportVehicleInfo}
        selectedVehicle={selectedVehicle}
        adapterName={adapterName}
        liveData={liveData}
        dtcCodes={dtcCodes}
        analysis={analysis}
        notes={notes}
      />
    </div>
  );
}

function LiveStat({ label, value }) {
  return (
    <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-3 text-center">
      <p className="text-gray-500 text-xs uppercase tracking-wide">{label}</p>
      <p className="text-white text-lg font-bold mt-1">{value}</p>
    </div>
  );
}