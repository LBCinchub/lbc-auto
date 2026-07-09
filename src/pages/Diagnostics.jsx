import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Bluetooth, BluetoothConnected, Loader2, AlertTriangle, CheckCircle2,
  Gauge, Sparkles, Trash2, Save, RefreshCw, Search, Printer, Send, Package,
} from "lucide-react";
import PageHeader from "../components/shared/PageHeader";
import CustomerSearchInput from "../components/shared/CustomerSearchInput";
import { ELM327Client } from "../lib/obd/elm327";

const URGENCY_STYLES = {
  Low: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  Medium: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  High: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  Critical: "bg-red-500/15 text-red-400 border-red-500/30",
};

export default function Diagnostics() {
  const [user, setUser] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [customerId, setCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [vehicles, setVehicles] = useState([]);
  const [vehicleId, setVehicleId] = useState("");

  const [connState, setConnState] = useState("disconnected"); // disconnected | connecting | connected
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
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");

  // LBC AI chat state
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

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
      setConnState("disconnected");
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
    setReadProgress("Talking to the vehicle's computer...");
    try {
      // Run sequentially — both share one Bluetooth write/notify pipe, and the
      // adapter can only handle one in-flight command at a time. First query
      // can take up to ~75s on some clone adapters while it auto-detects the
      // vehicle's OBD protocol — this is normal, not stuck.
      const stored = await clientRef.current.readDTCs((attempt, total) => {
        setReadProgress(
          attempt === 1
            ? "Talking to the vehicle's computer..."
            : `Still trying (attempt ${attempt}/${total})... this can take up to a minute on first connect.`
        );
      });
      setReadProgress("Checking for pending codes...");
      const pending = await clientRef.current.readPendingDTCs();
      setReadProgress("Checking for permanent codes...");
      const permanent = await clientRef.current.readPermanentDTCs();
      setReadProgress("Pulling live sensor data...");
      const live = await clientRef.current.readLiveData();

      // Merge all codes, tagging each with its type; dedupe by code (stored wins)
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
      setAnalysis(null);
    } catch (err) {
      setConnError(err?.message || "Failed to read codes from the vehicle.");
    } finally {
      setReading(false);
      setReadProgress("");
    }
  };

  const handleClearCodes = async () => {
    if (!clientRef.current) return;
    if (!window.confirm("Clear all trouble codes and turn off the check engine light? Make sure the AI analysis has been reviewed/saved first.")) return;
    setClearing(true);
    try {
      const ok = await clientRef.current.clearDTCs();
      setClearedMsg(ok ? "Codes cleared successfully." : "Adapter didn't confirm — codes may not have cleared.");
      if (ok) setDtcCodes([]);
    } catch (err) {
      setConnError(err?.message || "Failed to clear codes.");
    } finally {
      setClearing(false);
    }
  };

  const handleAnalyze = async () => {
    if (dtcCodes.length === 0) return;
    setAnalyzing(true);
    try {
      const vehicleDesc = selectedVehicle
        ? `${selectedVehicle.year || ""} ${selectedVehicle.make || ""} ${selectedVehicle.model || ""} ${selectedVehicle.engine_type || ""}`.trim()
        : "Unknown vehicle";

      const res = await base44.functions.invoke("lbcDiagAI", {
        mode: "analyze",
        codes: dtcCodes,
        live_data: liveData,
        vehicle: vehicleDesc,
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
        mode: "chat",
        codes: dtcCodes,
        live_data: liveData,
        vehicle: vehicleDesc,
        messages: newMessages,
      });
      setChatMessages(prev => [...prev, { role: "assistant", content: res.data.reply }]);
    } catch (err) {
      setChatMessages(prev => [...prev, { role: "assistant", content: "⚠️ " + (err?.message || "AI couldn't respond.") }]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleSave = async () => {
    if (!vehicleId) return;
    setSaving(true);
    setSavedMsg("");
    try {
      await base44.entities.DiagnosticScan.create({
        customer_id: customerId || undefined,
        customer_name: customerName || undefined,
        vehicle_id: vehicleId,
        vehicle_info: selectedVehicle
          ? `${selectedVehicle.year || ""} ${selectedVehicle.make || ""} ${selectedVehicle.model || ""}`.trim()
          : undefined,
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
      setSavedMsg("Scan saved to this vehicle's history.");
    } catch (err) {
      setSavedMsg("Failed to save: " + (err?.message || "unknown error"));
    } finally {
      setSaving(false);
    }
  };

  const bleSupported = ELM327Client.isSupported();

  const handlePrint = () => window.print();

  const reportVehicleInfo = selectedVehicle
    ? `${selectedVehicle.year || ""} ${selectedVehicle.make || ""} ${selectedVehicle.model || ""}`.trim()
    : "—";

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
      <PageHeader
        title="Diagnostics"
        subtitle="Read live OBD2 trouble codes with a Bluetooth adapter, get AI-powered fix guidance, and save the scan to the vehicle's history."
      />

      {!bleSupported && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-200">
            Your browser doesn't support Web Bluetooth. Use Chrome or Edge on Android or desktop — this feature isn't supported on iOS Safari.
          </div>
        </div>
      )}

      {/* Vehicle selection */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
        <h2 className="text-white font-semibold text-sm flex items-center gap-2">
          <Search className="w-4 h-4 text-sky-400" /> Select customer & vehicle
        </h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <CustomerSearchInput
            customers={customers}
            value={customerId}
            onChange={(id, name) => { setCustomerId(id); setCustomerName(name); }}
          />
          <select
            value={vehicleId}
            onChange={(e) => setVehicleId(e.target.value)}
            disabled={!customerId}
            className="bg-gray-800 border border-gray-700 text-white rounded-md px-3 py-2 text-sm disabled:opacity-50"
          >
            <option value="">{customerId ? "Select a vehicle..." : "Select a customer first"}</option>
            {vehicles.map(v => (
              <option key={v.id} value={v.id}>
                {v.year} {v.make} {v.model} {v.license_plate ? `— ${v.license_plate}` : ""}
              </option>
            ))}
          </select>
        </div>
        {selectedVehicle?.vin && (
          <p className="text-xs text-gray-500">VIN: {selectedVehicle.vin}</p>
        )}
      </div>

      {/* Connection panel */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-white font-semibold text-sm flex items-center gap-2">
            {connState === "connected"
              ? <BluetoothConnected className="w-4 h-4 text-emerald-400" />
              : <Bluetooth className="w-4 h-4 text-sky-400" />}
            OBD2 Adapter
          </h2>
          {connState === "connected" ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-3 py-1">
                Connected — {adapterName}
              </span>
              <Button size="sm" variant="outline" onClick={handleDisconnect} className="border-gray-700 text-gray-300">
                Disconnect
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              onClick={handleConnect}
              disabled={!bleSupported || connState === "connecting"}
              className="bg-sky-500 hover:bg-sky-600 text-white gap-2"
            >
              {connState === "connecting" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bluetooth className="w-4 h-4" />}
              {connState === "connecting" ? "Connecting..." : "Connect Adapter"}
            </Button>
          )}
        </div>

        {connError && (
          <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-md p-3">
            {connError}
          </div>
        )}

        {connState === "connected" && (
          <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-3">
            <Button
              size="sm"
              onClick={handleReadCodes}
              disabled={reading}
              className="bg-teal-500 hover:bg-teal-600 text-white gap-2"
            >
              {reading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {reading ? "Reading vehicle..." : "Read Codes & Live Data"}
            </Button>
            {dtcCodes.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleClearCodes}
                disabled={clearing}
                className="border-red-500/40 text-red-400 hover:bg-red-500/10 gap-2"
              >
                {clearing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Clear Codes
              </Button>
            )}
          </div>
          {readProgress && (
            <p className="text-xs text-muted-foreground italic">{readProgress}</p>
          )}
          </div>
        )}
        {clearedMsg && (
          <div className="text-sm text-emerald-400 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" /> {clearedMsg}
          </div>
        )}
      </div>

      {/* Live data */}
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

      {/* DTC codes */}
      {dtcCodes.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-white font-semibold text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" /> Trouble Codes ({dtcCodes.length})
              <span className="text-xs text-gray-500 font-normal">
                {dtcCodes.filter(c => c.type === "stored").length} stored ·{" "}
                {dtcCodes.filter(c => c.type === "pending").length} pending ·{" "}
                {dtcCodes.filter(c => c.type === "permanent").length} permanent
              </span>
            </h2>
            <Button
              size="sm"
              onClick={handleAnalyze}
              disabled={analyzing}
              className="bg-purple-500 hover:bg-purple-600 text-white gap-2"
            >
              {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {analyzing ? "Analyzing..." : "AI Analyze"}
            </Button>
          </div>

          <div className="space-y-3">
            {dtcCodes.map((c, i) => {
              const finding = analysis?.findings?.find(f => f.code === c.code);
              return (
                <div key={i} className="bg-gray-800/60 border border-gray-700 rounded-lg p-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-mono font-semibold">{c.code}</span>
                      {c.type !== "stored" && (
                        <span className={`text-[10px] uppercase tracking-wide border rounded-full px-2 py-0.5 ${
                          c.type === "pending"
                            ? "bg-yellow-500/15 text-yellow-400 border-yellow-500/30"
                            : "bg-blue-500/15 text-blue-400 border-blue-500/30"
                        }`}>
                          {c.type}
                        </span>
                      )}
                    </div>
                    {finding?.urgency && (
                      <span className={`text-xs border rounded-full px-2.5 py-0.5 ${URGENCY_STYLES[finding.urgency] || ""}`}>
                        {finding.urgency}
                      </span>
                    )}
                  </div>
                  {finding ? (
                    <div className="mt-2 space-y-2 text-sm">
                      <p className="text-gray-300">{finding.plain_english}</p>
                      {(finding.estimated_labor_hours || finding.estimated_labor_cost) && (
                        <div className="flex flex-wrap gap-2">
                          {finding.estimated_labor_hours != null && (
                            <span className="text-xs bg-sky-500/10 text-sky-400 border border-sky-500/30 rounded-full px-2.5 py-0.5">
                              ⏱ {finding.estimated_labor_hours} hrs labor
                            </span>
                          )}
                          {finding.estimated_labor_cost != null && (
                            <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-full px-2.5 py-0.5">
                              💰 ${finding.estimated_labor_cost.toFixed(2)}
                            </span>
                          )}
                        </div>
                      )}
                      {finding.likely_causes?.length > 0 && (
                        <div>
                          <p className="text-gray-500 text-xs uppercase tracking-wide mb-1">Likely causes</p>
                          <ul className="list-disc list-inside text-gray-300 space-y-0.5">
                            {finding.likely_causes.map((cause, j) => <li key={j}>{cause}</li>)}
                          </ul>
                        </div>
                      )}
                      {finding.recommended_fix_order?.length > 0 && (
                        <div>
                          <p className="text-gray-500 text-xs uppercase tracking-wide mb-1">Recommended fix order</p>
                          <ol className="list-decimal list-inside text-gray-300 space-y-0.5">
                            {finding.recommended_fix_order.map((step, j) => <li key={j}>{step}</li>)}
                          </ol>
                        </div>
                      )}
                      {finding.parts_needed?.length > 0 && (
                        <div>
                          <p className="text-gray-500 text-xs uppercase tracking-wide mb-1 flex items-center gap-1">
                            <Package className="w-3 h-3" /> Parts needed
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {finding.parts_needed.map((p, j) => (
                              <span key={j} className={`text-xs border rounded-full px-2 py-0.5 ${
                                p.in_stock
                                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                  : "bg-orange-500/10 text-orange-400 border-orange-500/30"
                              }`}>
                                {p.name}{p.estimated_cost != null ? ` — $${p.estimated_cost.toFixed(2)}` : ""} {p.in_stock ? "✓ In stock" : "⚠ Order"}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-xs mt-2">Click "AI Analyze" for an explanation and fix guidance.</p>
                  )}
                </div>
              );
            })}
          </div>

          {analysis?.summary && (
            <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4 text-sm text-purple-200">
              {analysis.summary}
            </div>
          )}

          {analysis?.shop_advice && (
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
                <p className="text-gray-300 text-sm">
                  <span className="text-gray-500">Priority:</span> {analysis.shop_advice.priority_order}
                </p>
              )}
              {analysis.shop_advice.recommended_action && (
                <p className="text-gray-300 text-sm">
                  <span className="text-gray-500">Tell the customer:</span> {analysis.shop_advice.recommended_action}
                </p>
              )}
            </div>
          )}

          {/* LBC AI Chat — ask follow-up questions about the scan */}
          <div className="bg-gray-800/40 border border-gray-700 rounded-lg p-4 space-y-3">
            <h3 className="text-white font-semibold text-sm flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400" /> Ask LBC Auto AI
            </h3>
            <p className="text-xs text-gray-500">Ask follow-up questions about these codes, repair procedures, or parts — the AI knows your shop's labor rate and inventory.</p>

            {chatMessages.length > 0 && (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {chatMessages.map((m, i) => (
                  <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                    <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                      m.role === "user"
                        ? "bg-sky-500/20 text-sky-100"
                        : "bg-gray-700/60 text-gray-200"
                    }`}>
                      {m.content}
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex justify-start">
                    <div className="bg-gray-700/60 rounded-lg px-3 py-2">
                      <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleChatSend()}
                placeholder="e.g. What's the torque spec for the brake caliper bolts?"
                disabled={chatLoading}
                className="flex-1 bg-gray-800 border border-gray-700 text-white rounded-md px-3 py-2 text-sm placeholder:text-gray-600 focus:outline-none focus:border-sky-500"
              />
              <Button
                size="sm"
                onClick={handleChatSend}
                disabled={chatLoading || !chatInput.trim()}
                className="bg-purple-500 hover:bg-purple-600 text-white gap-2"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Save */}
      {(dtcCodes.length > 0 || liveData) && vehicleId && (
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
              {saving ? "Saving..." : "Save Scan to Vehicle History"}
            </Button>
            <Button onClick={handlePrint} variant="outline" className="border-gray-700 text-gray-300 gap-2">
              <Printer className="w-4 h-4" /> Print Report
            </Button>
            {savedMsg && <span className="text-sm text-gray-400">{savedMsg}</span>}
          </div>
        </div>
      )}

      {/* ── Print-only diagnostic report (hidden on screen) ── */}
      <div id="diag-print-report" style={{ display: "none" }}>
        <style>{`@media print { #diag-print-report { display: block !important; } }`}</style>

        <div style={{ borderBottom: "2px solid #000", paddingBottom: 12, marginBottom: 16 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Diagnostic Scan Report</h1>
          <p style={{ fontSize: 13, color: "#666", margin: "4px 0 0" }}>
            Generated {new Date().toLocaleString()}
          </p>
        </div>

        <table style={{ width: "100%", fontSize: 13, marginBottom: 16 }}>
          <tbody>
            <tr><td style={{ fontWeight: 700, width: 120, padding: "3px 0" }}>Customer:</td><td style={{ padding: "3px 0" }}>{customerName || "—"}</td></tr>
            <tr><td style={{ fontWeight: 700, padding: "3px 0" }}>Vehicle:</td><td style={{ padding: "3px 0" }}>{reportVehicleInfo}</td></tr>
            {selectedVehicle?.vin && <tr><td style={{ fontWeight: 700, padding: "3px 0" }}>VIN:</td><td style={{ padding: "3px 0" }}>{selectedVehicle.vin}</td></tr>}
            {selectedVehicle?.license_plate && <tr><td style={{ fontWeight: 700, padding: "3px 0" }}>Plate:</td><td style={{ padding: "3px 0" }}>{selectedVehicle.license_plate}</td></tr>}
            {selectedVehicle?.mileage !== undefined && <tr><td style={{ fontWeight: 700, padding: "3px 0" }}>Mileage:</td><td style={{ padding: "3px 0" }}>{selectedVehicle.mileage?.toLocaleString()} km</td></tr>}
            {adapterName && <tr><td style={{ fontWeight: 700, padding: "3px 0" }}>Adapter:</td><td style={{ padding: "3px 0" }}>{adapterName}</td></tr>}
          </tbody>
        </table>

        {liveData && (
          <div style={{ marginBottom: 16 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, borderBottom: "1px solid #ccc", paddingBottom: 4, marginBottom: 8 }}>Live Data Snapshot</h2>
            <table style={{ width: "100%", fontSize: 13 }}>
              <tbody>
                {liveData.rpm !== undefined && <tr><td style={{ padding: "2px 0", width: 180 }}>RPM</td><td style={{ padding: "2px 0" }}>{Math.round(liveData.rpm)}</td></tr>}
                {liveData.speed_kph !== undefined && <tr><td style={{ padding: "2px 0" }}>Speed</td><td style={{ padding: "2px 0" }}>{liveData.speed_kph} km/h</td></tr>}
                {liveData.coolant_temp_c !== undefined && <tr><td style={{ padding: "2px 0" }}>Coolant Temp</td><td style={{ padding: "2px 0" }}>{liveData.coolant_temp_c}°C</td></tr>}
                {liveData.intake_temp_c !== undefined && <tr><td style={{ padding: "2px 0" }}>Intake Temp</td><td style={{ padding: "2px 0" }}>{liveData.intake_temp_c}°C</td></tr>}
                {liveData.engine_load_pct !== undefined && <tr><td style={{ padding: "2px 0" }}>Engine Load</td><td style={{ padding: "2px 0" }}>{liveData.engine_load_pct}%</td></tr>}
                {liveData.fuel_level_pct !== undefined && <tr><td style={{ padding: "2px 0" }}>Fuel Level</td><td style={{ padding: "2px 0" }}>{liveData.fuel_level_pct}%</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {dtcCodes.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, borderBottom: "1px solid #ccc", paddingBottom: 4, marginBottom: 8 }}>
              Trouble Codes ({dtcCodes.length})
            </h2>
            {dtcCodes.map((c, i) => {
              const finding = analysis?.findings?.find(f => f.code === c.code);
              return (
                <div key={i} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: "1px solid #eee" }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>
                    {c.code} <span style={{ fontSize: 11, textTransform: "uppercase", color: "#666" }}>[{c.type}]</span>
                  </div>
                  {finding && (
                    <div style={{ fontSize: 13, marginTop: 4 }}>
                      <p style={{ margin: "2px 0" }}>{finding.plain_english}</p>
                      {finding.urgency && <p style={{ margin: "2px 0" }}><strong>Urgency:</strong> {finding.urgency}</p>}
                      {finding.likely_causes?.length > 0 && (
                        <div style={{ margin: "4px 0" }}>
                          <strong>Likely causes:</strong>
                          <ol style={{ margin: "2px 0 2px 20px", padding: 0 }}>
                            {finding.likely_causes.map((cause, j) => <li key={j}>{cause}</li>)}
                          </ol>
                        </div>
                      )}
                      {finding.recommended_fix_order?.length > 0 && (
                        <div style={{ margin: "4px 0" }}>
                          <strong>Recommended fix order:</strong>
                          <ol style={{ margin: "2px 0 2px 20px", padding: 0 }}>
                            {finding.recommended_fix_order.map((step, j) => <li key={j}>{step}</li>)}
                          </ol>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {analysis?.summary && (
          <div style={{ marginBottom: 16, padding: 12, border: "1px solid #ccc", fontSize: 13 }}>
            <strong>Summary:</strong> {analysis.summary}
          </div>
        )}

        {notes && (
          <div style={{ marginBottom: 16 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, borderBottom: "1px solid #ccc", paddingBottom: 4, marginBottom: 8 }}>Technician Notes</h2>
            <p style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>{notes}</p>
          </div>
        )}

        <div style={{ marginTop: 24, paddingTop: 12, borderTop: "1px solid #ccc", fontSize: 11, color: "#999", textAlign: "center" }}>
          LBC Auto · Diagnostic Report
        </div>
      </div>
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