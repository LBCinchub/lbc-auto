import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Bluetooth, BluetoothConnected, Loader2, AlertTriangle, CheckCircle2,
  Gauge, Sparkles, Trash2, Save, RefreshCw, Search,
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
  const [dtcCodes, setDtcCodes] = useState([]);
  const [liveData, setLiveData] = useState(null);
  const [clearing, setClearing] = useState(false);
  const [clearedMsg, setClearedMsg] = useState("");

  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");

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
    try {
      const [codes, live] = await Promise.all([
        clientRef.current.readDTCs(),
        clientRef.current.readLiveData(),
      ]);
      setDtcCodes(codes);
      setLiveData(live);
      setAnalysis(null);
    } catch (err) {
      setConnError(err?.message || "Failed to read codes from the vehicle.");
    } finally {
      setReading(false);
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

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are an expert automotive diagnostic technician. A vehicle (${vehicleDesc}) was just scanned and returned these OBD2 trouble codes: ${dtcCodes.map(c => c.code).join(", ")}.
${liveData ? `Live data at time of scan: ${JSON.stringify(liveData)}.` : ""}
For each code, give a plain-English explanation, the most likely causes ordered from most to least probable, an urgency level, and a recommended fix order (cheapest/most-likely-first). Also give a one to two sentence overall summary for the technician.`,
        response_json_schema: {
          type: "object",
          properties: {
            summary: { type: "string" },
            findings: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  code: { type: "string" },
                  plain_english: { type: "string" },
                  likely_causes: { type: "array", items: { type: "string" } },
                  urgency: { type: "string", enum: ["Low", "Medium", "High", "Critical"] },
                  recommended_fix_order: { type: "array", items: { type: "string" } },
                },
              },
            },
          },
        },
      });
      setAnalysis(result);
    } catch (err) {
      setConnError(err?.message || "AI analysis failed.");
    } finally {
      setAnalyzing(false);
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

  return (
    <div className="space-y-6">
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
                    <span className="text-white font-mono font-semibold">{c.code}</span>
                    {finding?.urgency && (
                      <span className={`text-xs border rounded-full px-2.5 py-0.5 ${URGENCY_STYLES[finding.urgency] || ""}`}>
                        {finding.urgency}
                      </span>
                    )}
                  </div>
                  {finding ? (
                    <div className="mt-2 space-y-2 text-sm">
                      <p className="text-gray-300">{finding.plain_english}</p>
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
          <div className="flex items-center gap-3">
            <Button onClick={handleSave} disabled={saving} className="bg-sky-500 hover:bg-sky-600 text-white gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? "Saving..." : "Save Scan to Vehicle History"}
            </Button>
            {savedMsg && <span className="text-sm text-gray-400">{savedMsg}</span>}
          </div>
        </div>
      )}
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
