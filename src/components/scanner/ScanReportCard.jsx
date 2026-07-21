import React from "react";
import { Button } from "@/components/ui/button";
import { lookupDtc } from "@/lib/dtcDatabase";
import {
  X, Car, AlertTriangle, CheckCircle2, XCircle, ShieldCheck, ShieldAlert,
  Activity, FileText, Loader2, ArrowRight, Gauge, Battery, Thermometer, Zap, Sparkles,
} from "lucide-react";

/**
 * Full-screen professional report card shown when the background scan completes.
 * Summarizes vehicle, DTCs, emissions readiness, live snapshot, and AI health.
 */
export default function ScanReportCard({
  autoVehicle, scanResults, aiSummary, onDismiss, onSaveToRepairOrder, saving,
}) {
  const stored = scanResults?.storedCodes || [];
  const pending = scanResults?.pendingCodes || [];
  const permanent = scanResults?.permanentCodes || [];
  const monitors = scanResults?.emissions?.monitors || [];
  const snapshot = scanResults?.liveSnapshot || {};
  const milOn = scanResults?.emissions?.milOn;
  const totalCodes = stored.length + pending.length + permanent.length;

  const renderCodeRow = (code, type) => {
    const info = lookupDtc(code.code) || {};
    const badgeClass =
      type === "stored" ? "bg-red-500/15 text-red-400"
      : type === "pending" ? "bg-amber-500/15 text-amber-400"
      : "bg-purple-500/15 text-purple-400";
    return (
      <div key={`${type}-${code.code}`} className="flex items-start gap-2 py-1.5 border-b border-gray-800 last:border-0">
        <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded shrink-0 ${badgeClass}`}>
          {code.code}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-200">{info.description || "Unknown code"}</p>
          <p className="text-[10px] text-gray-500 uppercase">{type}</p>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-start md:items-center justify-center p-3 md:p-6 overflow-y-auto">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl max-w-2xl w-full shadow-2xl my-4">
        {/* Header */}
        <div className="bg-gradient-to-r from-fuchsia-600/20 via-purple-600/15 to-transparent border-b border-gray-800 px-5 py-4 flex items-center justify-between rounded-t-2xl">
          <div>
            <h2 className="text-white font-bold text-lg flex items-center gap-2">
              <FileText className="w-5 h-5 text-fuchsia-400" />
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

        <div className="p-5 space-y-5 max-h-[calc(100vh-180px)] overflow-y-auto">
          {/* Vehicle Confirmed */}
          <section>
            <SectionTitle icon={Car} label="Vehicle Confirmed" />
            <div className="bg-gray-800/50 rounded-lg p-3">
              <p className="text-white font-bold text-base">
                {autoVehicle?.year || ""} {autoVehicle?.make || ""} {autoVehicle?.model || "Unknown"}
              </p>
              {autoVehicle?.engine_type && (
                <p className="text-gray-400 text-sm">{autoVehicle.engine_type}</p>
              )}
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs">
                {autoVehicle?.vin && (
                  <span className="text-gray-500">
                    VIN: <span className="text-teal-400 font-mono font-bold">{autoVehicle.vin}</span>
                  </span>
                )}
                {autoVehicle?.mileage != null && (
                  <span className="text-gray-500">
                    Mileage: <span className="text-emerald-400 font-bold">{Number(autoVehicle.mileage).toLocaleString()} km</span>
                  </span>
                )}
              </div>
            </div>
          </section>

          {/* DTC Summary */}
          <section>
            <SectionTitle icon={AlertTriangle} label="DTC Summary" />
            <div className="grid grid-cols-3 gap-2 mb-2">
              <CountCard value={stored.length} label="Active" color="red" />
              <CountCard value={pending.length} label="Pending" color="amber" />
              <CountCard value={permanent.length} label="Permanent" color="purple" />
            </div>
            {totalCodes === 0 ? (
              <div className="flex items-center gap-2 text-emerald-400 text-sm py-2">
                <CheckCircle2 className="w-4 h-4" /> No trouble codes found
              </div>
            ) : (
              <div className="bg-gray-800/50 rounded-lg p-3 max-h-40 overflow-y-auto">
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
                suffix={milOn && <span className="text-amber-400 normal-case font-normal ml-1">(CEL ON)</span>}
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
              <SectionTitle icon={Activity} label="Live Snapshot" />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {snapshot.rpm != null && <SnapshotCard icon={Gauge} label="RPM" value={snapshot.rpm} />}
                {snapshot.coolant != null && <SnapshotCard icon={Thermometer} label="Coolant" value={`${snapshot.coolant}°C`} />}
                {snapshot.battery != null && <SnapshotCard icon={Battery} label="Battery" value={`${snapshot.battery}V`} />}
                {snapshot.throttle != null && <SnapshotCard icon={Zap} label="Throttle" value={`${snapshot.throttle}%`} />}
              </div>
            </section>
          )}

          {/* AI Health Summary */}
          {aiSummary && (
            <section>
              <SectionTitle icon={Sparkles} label="AI Health Summary" iconColor="text-fuchsia-400" />
              <div className="bg-fuchsia-500/5 border border-fuchsia-500/20 rounded-lg p-3">
                <p className="text-sm text-gray-200 leading-relaxed">{aiSummary}</p>
              </div>
            </section>
          )}
        </div>

        {/* Footer actions */}
        <div className="border-t border-gray-800 p-4 flex gap-2 rounded-b-2xl">
          <Button variant="outline" onClick={onDismiss} className="flex-1 border-gray-700 text-gray-300">
            Close
          </Button>
          <Button
            onClick={onSaveToRepairOrder}
            disabled={saving}
            className="flex-1 bg-fuchsia-600 hover:bg-fuchsia-700 text-white"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <ArrowRight className="w-4 h-4 mr-1" />}
            Save to Repair Order
          </Button>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ icon: Icon, label, iconColor = "text-gray-500", suffix }) {
  return (
    <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
      <Icon className={`w-3.5 h-3.5 ${iconColor}`} /> {label} {suffix}
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