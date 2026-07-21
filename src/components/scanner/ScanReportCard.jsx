import React from "react";
import { Button } from "@/components/ui/button";
import { lookupDtc } from "@/lib/dtcDatabase";
import DtcAiAnalysis from "@/components/scanner/DtcAiAnalysis";
import {
  X, Car, AlertTriangle, CheckCircle2, XCircle, ShieldCheck, ShieldAlert,
  Activity, FileText, Loader2, ArrowRight, Gauge, Battery, Thermometer, Zap, Sparkles,
  RefreshCw, Printer, Save, Wrench,
} from "lucide-react";

/**
 * Full-screen professional report card shown when the background scan completes.
 * Non-dismissable by outside click or ESC (only the action buttons close it).
 */
export default function ScanReportCard({
  autoVehicle, scanResults, aiSummary, saving, savingScan, savingEstimate, laborRate,
  analysisByCode, analyzingCodes, onAnalyzeCode, onAnalyzeAll, onAddCodeToRepairOrder,
  onDismiss, onSaveToRepairOrder, onCreateEstimate, onSaveReport, onEnterVehicleManually, onPrint, onStartNewScan,
}) {
  const stored = scanResults?.storedCodes || [];
  const pending = scanResults?.pendingCodes || [];
  const permanent = scanResults?.permanentCodes || [];
  const monitors = scanResults?.emissions?.monitors || [];
  const snapshot = scanResults?.liveSnapshot || {};
  const milOn = scanResults?.emissions?.milOn;
  const totalCodes = stored.length + pending.length + permanent.length;

  const severityFor = (code) => {
    const sev = analysisByCode?.[code.code]?.urgency?.toUpperCase() || lookupDtc(code.code)?.severity;
    if (sev === "HIGH" || sev === "CRITICAL") return { label: "Critical", cls: "bg-red-500/15 text-red-400 border-red-500/30" };
    if (sev === "MEDIUM" || sev === "WARNING") return { label: "Warning", cls: "bg-amber-500/15 text-amber-400 border-amber-500/30" };
    if (sev === "LOW" || sev === "INFO") return { label: "Info", cls: "bg-sky-500/15 text-sky-400 border-sky-500/30" };
    return { label: "Info", cls: "bg-sky-500/15 text-sky-400 border-sky-500/30" };
  };

  const allCodes = [...stored, ...pending, ...permanent];
  const overall = (() => {
    if (!allCodes.length) return { label: "Passed", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" };
    const hasHigh = allCodes.some((c) => lookupDtc(c.code)?.severity === "HIGH");
    const hasMed = allCodes.some((c) => lookupDtc(c.code)?.severity === "MEDIUM");
    if (hasHigh) return { label: "Critical", cls: "bg-red-500/15 text-red-400 border-red-500/30" };
    if (hasMed) return { label: "Warning", cls: "bg-amber-500/15 text-amber-400 border-amber-500/30" };
    return { label: "Info", cls: "bg-sky-500/15 text-sky-400 border-sky-500/30" };
  })();

  const nextSteps = (() => {
    if (!allCodes.length) return ["No faults detected — no immediate action required. Continue routine maintenance."];
    const causes = [];
    const seen = new Set();
    allCodes.forEach((c) => {
      (lookupDtc(c.code)?.causes || []).forEach((cause) => {
        if (!seen.has(cause)) { seen.add(cause); causes.push(cause); }
      });
    });
    const steps = causes.length ? causes.slice(0, 6) : ["Inspect the affected system per the DTC and repair the underlying fault."];
    steps.push("Clear codes after repair and perform a road test to confirm the fix.");
    return steps;
  })();

  const renderCodeRow = (code, type) => {
    const info = lookupDtc(code.code) || {};
    const sev = severityFor(code);
    return (
      <div key={`${type}-${code.code}`} className="flex items-start gap-2 py-2 border-b border-gray-800 last:border-0">
        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded shrink-0 bg-gray-700/50 text-gray-200">
          {code.code}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm text-gray-200 font-medium">{analysisByCode?.[code.code]?.plain_english || info.name || "Definition pending AI analysis"}</p>
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${sev.cls}`}>{sev.label}</span>
            <span className="text-[9px] text-gray-500 uppercase">{type}</span>
          </div>
          {info.causes?.length > 0 && (
            <p className="text-[11px] text-gray-500 mt-0.5">Repair direction: {info.causes.join(" · ")}</p>
          )}
          <DtcAiAnalysis analysis={analysisByCode?.[code.code]} loading={analyzingCodes?.[code.code]} laborRate={laborRate} onAnalyze={() => onAnalyzeCode(code)} onAdd={() => onAddCodeToRepairOrder(code)} />
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-start md:items-center justify-center p-3 md:p-6 overflow-y-auto">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl max-w-2xl w-full shadow-2xl my-4">
        {/* Header */}
        <div className="bg-gradient-to-r from-sky-600/15 via-blue-600/10 to-transparent border-b border-gray-800 px-5 py-4 flex items-center justify-between rounded-t-2xl">
          <div>
            <h2 className="text-white font-bold text-lg flex items-center gap-2">
              <FileText className="w-5 h-5 text-sky-400" />
              Diagnostic Report
            </h2>
            <p className="text-xs text-gray-500">{new Date().toLocaleString()}</p>
          </div>
          <button
            onClick={onDismiss}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5 max-h-[calc(100vh-220px)] overflow-y-auto">
          {/* Overall status badge */}
          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold px-3 py-1 rounded-full border ${overall.cls}`}>
              Overall: {overall.label}
            </span>
            {milOn && (
              <span className="text-xs font-bold px-3 py-1 rounded-full border bg-amber-500/15 text-amber-400 border-amber-500/30">
                Check Engine Light ON
              </span>
            )}
          </div>

          {/* Vehicle Confirmed */}
          <section>
            <SectionTitle icon={Car} label="Vehicle Confirmed" />
            {autoVehicle ? <div className="bg-gray-800/50 rounded-lg p-3">
              <p className="text-white font-bold text-base">
                {autoVehicle.year} {autoVehicle.make} {autoVehicle.model}
              </p>
              {(autoVehicle.trim || autoVehicle.engine || autoVehicle.engine_type) && <p className="text-gray-400 text-sm">{[autoVehicle.trim, autoVehicle.engine || autoVehicle.engine_type].filter(Boolean).join(" · ")}</p>}
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs">
                {autoVehicle?.vin && (
                  <span className="text-gray-500">
                    VIN: <span className="text-teal-400 font-mono font-bold">{autoVehicle.vin}</span>
                  </span>
                )}
                <span className="text-gray-500">
                  Mileage:{" "}
                  {(autoVehicle?.mileage_km ?? autoVehicle?.mileage) != null ? (
                    <span className="text-emerald-400 font-bold">{Number(autoVehicle.mileage_km ?? autoVehicle.mileage).toLocaleString()} km</span>
                  ) : (
                    <span className="text-gray-500 italic">Not reported by ECU</span>
                  )}
                </span>
              </div>
            </div> : <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3"><p className="text-white font-semibold">Vehicle not identified automatically</p><Button size="sm" onClick={onEnterVehicleManually} className="mt-2 bg-amber-600 hover:bg-amber-700">Enter Vehicle Manually</Button></div>}
          </section>

          {/* DTC Summary */}
          <section>
            <SectionTitle icon={AlertTriangle} label="Diagnostic Severity Summary" />
            <div className="grid grid-cols-3 gap-2 mb-2">
              <CountCard value={stored.length} label="Active" color="red" />
              <CountCard value={pending.length} label="Pending" color="amber" />
              <CountCard value={permanent.length} label="Permanent" color="purple" />
            </div>
            {totalCodes > 0 && <Button onClick={onAnalyzeAll} disabled={analyzingCodes?.all} className="w-full mb-2 bg-sky-600 hover:bg-sky-700"><Sparkles className="w-4 h-4 mr-1" />{analyzingCodes?.all ? "Analyzing All Codes…" : "Analyze All Codes With AI"}</Button>}
            {totalCodes === 0 ? (
              <div className="flex items-center gap-2 text-emerald-400 text-sm py-2">
                <CheckCircle2 className="w-4 h-4" /> No trouble codes found — all systems passed.
              </div>
            ) : (
              <div className="bg-gray-800/50 rounded-lg p-3 max-h-96 overflow-y-auto">
                {stored.map((c) => renderCodeRow(c, "stored"))}
                {pending.map((c) => renderCodeRow(c, "pending"))}
                {permanent.map((c) => renderCodeRow(c, "permanent"))}
              </div>
            )}
          </section>

          {/* Emissions Readiness */}
          {monitors.length > 0 && (
            <section>
              <SectionTitle
                icon={milOn ? ShieldAlert : ShieldCheck}
                label="Emissions Readiness"
                iconColor={milOn ? "text-amber-400" : "text-emerald-400"}
              />
              <div className="grid grid-cols-2 gap-1.5">
                {monitors.map((m) => (
                  <div key={m.name} className="flex items-center gap-2 bg-gray-800/50 rounded px-2 py-1.5">
                    {m.status === "pass" ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    )}
                    <span className="text-xs text-gray-300 truncate">{m.name}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Live Snapshot */}
          {Object.keys(snapshot).length > 0 && (
            <section>
              <SectionTitle icon={Activity} label="Live Data Snapshot" />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {snapshot.rpm != null && <SnapshotCard icon={Gauge} label="RPM" value={snapshot.rpm} />}
                {snapshot.coolant != null && <SnapshotCard icon={Thermometer} label="Coolant" value={`${snapshot.coolant}°C`} />}
                {snapshot.battery != null && <SnapshotCard icon={Battery} label="Battery" value={`${snapshot.battery}V`} />}
                {snapshot.throttle != null && <SnapshotCard icon={Zap} label="Throttle" value={`${snapshot.throttle}%`} />}
              </div>
            </section>
          )}

          {/* Lumina AI Health Summary */}
          {aiSummary && (
            <section>
              <SectionTitle icon={Sparkles} label="Lumina AI Health Summary" iconColor="text-sky-400" />
              <div className="bg-sky-500/5 border border-sky-500/20 rounded-lg p-3">
                <p className="text-sm text-gray-200 leading-relaxed">{aiSummary}</p>
              </div>
            </section>
          )}

          {/* Recommended Next Steps */}
          <section>
            <SectionTitle icon={ArrowRight} label="Recommended Next Steps" iconColor="text-sky-400" />
            <ol className="bg-gray-800/50 rounded-lg p-3 space-y-1.5 list-decimal list-inside">
              {nextSteps.map((step, i) => (
                <li key={i} className="text-sm text-gray-200 leading-relaxed">{step}</li>
              ))}
            </ol>
          </section>
        </div>

        {/* Sticky scanner-to-repair actions */}
        <div className="sticky bottom-0 border-t border-gray-800 bg-gray-900 p-4 grid grid-cols-2 md:grid-cols-5 gap-2 rounded-b-2xl">
          <Button variant="outline" onClick={onSaveReport} disabled={savingScan} className="border-gray-700 text-gray-300">{savingScan ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Scan Report</Button>
          <Button onClick={onSaveToRepairOrder} disabled={saving || !autoVehicle} className="bg-sky-600 hover:bg-sky-700 text-white">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wrench className="w-4 h-4" />} Create Repair Order</Button>
          <Button onClick={onCreateEstimate} disabled={savingEstimate || !autoVehicle} className="bg-emerald-600 hover:bg-emerald-700 text-white">{savingEstimate ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />} Create Estimate</Button>
          <Button variant="outline" onClick={onPrint} className="border-gray-700 text-gray-300"><Printer className="w-4 h-4" /> Print Report</Button>
          <Button variant="outline" onClick={onStartNewScan} className="border-gray-700 text-gray-300"><RefreshCw className="w-4 h-4" /> New Scan</Button>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ icon: Icon, label, iconColor = "text-gray-500" }) {
  return (
    <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
      <Icon className={`w-3.5 h-3.5 ${iconColor}`} /> {label}
    </h3>
  );
}

function CountCard({ value, label, color }) {
  const colorMap = {
    red: "bg-red-500/10 border-red-500/20 text-red-400",
    amber: "bg-amber-500/10 border-amber-500/20 text-amber-400",
    purple: "bg-purple-500/10 border-purple-500/20 text-purple-400",
  };
  return (
    <div className={`border rounded-lg p-2 text-center ${colorMap[color]}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-[10px] text-gray-500 uppercase">{label}</p>
    </div>
  );
}

function SnapshotCard({ icon: Icon, label, value }) {
  return (
    <div className="bg-gray-800/50 rounded-lg p-2 text-center">
      <Icon className="w-4 h-4 text-gray-500 mx-auto mb-1" />
      <p className="text-sm font-bold text-white">{value}</p>
      <p className="text-[10px] text-gray-500 uppercase">{label}</p>
    </div>
  );
}