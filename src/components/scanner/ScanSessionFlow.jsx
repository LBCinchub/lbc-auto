import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Hexagon, Bluetooth, Car, ScanLine, CheckCircle2, Loader2,
  AlertTriangle, RefreshCw, Zap, Activity, FileText,
} from "lucide-react";
import VehicleIdentifiedBanner from "@/components/scanner/VehicleIdentifiedBanner";

const SCAN_STEPS = [
  { key: "stored", label: "Reading stored codes", threshold: 20 },
  { key: "pending", label: "Reading pending codes", threshold: 38 },
  { key: "permanent", label: "Reading permanent codes", threshold: 52 },
  { key: "live", label: "Capturing live data snapshot", threshold: 68 },
  { key: "emissions", label: "Checking emissions readiness", threshold: 84 },
  { key: "freeze", label: "Capturing freeze-frame data", threshold: 92 },
  { key: "ai", label: "Building AI health summary", threshold: 100 },
];

/**
 * Guided professional scanner flow for the Scan tab. Drives the mechanic through
 * Landing → Connecting → Vehicle ID → Full Scan → Complete, with a premium
 * Matco/Snap-on style presentation. All state comes from the parent hook so it
 * persists across tab switches.
 */
export default function ScanSessionFlow({
  connState, connError, autoVehicle, scanning, scanProgress, scanLabel, reportReady,
  onConnect, onOpenVehiclePanel, onReopenReport, onStartNewScan,
}) {
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    if (scanning) {
      const start = Date.now();
      timerRef.current = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 500);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [scanning]);

  const isDone = (i) => {
    const next = SCAN_STEPS[i + 1];
    return next ? scanProgress >= next.threshold : scanProgress >= 100;
  };
  const isActive = (i) => !isDone(i) && (i === 0 || isDone(i - 1));

  // ── Connection error ──
  if (connState === "error") {
    const ecuIssue = /ECU|respond|UNABLE|protocol|connect/i.test(connError || "");
    return (
      <StagePanel icon={AlertTriangle} iconColor="text-amber-400" iconBg="bg-amber-500/15">
        <h2 className="text-white font-bold text-lg mb-1">Connection Problem</h2>
        <p className="text-gray-400 text-sm mb-4 max-w-sm mx-auto">
          {ecuIssue
            ? "Adapter detected but vehicle ECU did not respond. Turn ignition ON and retry."
            : connError || "Couldn't connect to the adapter. Make sure it's plugged in and ignition is ON."}
        </p>
        <Button onClick={onConnect} className="bg-fuchsia-600 hover:bg-fuchsia-700 text-white">
          <RefreshCw className="w-4 h-4 mr-2" /> Retry Connection
        </Button>
      </StagePanel>
    );
  }

  // ── Connecting ──
  if (connState === "connecting") {
    return (
      <StagePanel icon={Bluetooth} iconColor="text-fuchsia-400" iconBg="bg-fuchsia-500/15" loading>
        <h2 className="text-white font-bold text-lg mb-1">Connecting to OBD Adapter…</h2>
        <p className="text-gray-400 text-sm mb-4">Pairing with your BLE adapter and initializing protocol.</p>
        <div className="space-y-1.5 text-left max-w-xs mx-auto">
          <StatusLine done>Searching for Bluetooth adapter</StatusLine>
          <StatusLine active>Establishing secure connection</StatusLine>
          <StatusLine>Initializing ELM327 protocol</StatusLine>
        </div>
        <p className="text-xs text-gray-500 mt-4">Make sure ignition is ON (key in ACC or engine running).</p>
      </StagePanel>
    );
  }

  // ── Vehicle identification ──
  if (connState === "connected" && scanning && !autoVehicle) {
    return (
      <StagePanel icon={Car} iconColor="text-teal-400" iconBg="bg-teal-500/15" loading>
        <h2 className="text-white font-bold text-lg mb-1">Identifying Vehicle…</h2>
        <p className="text-gray-400 text-sm mb-4">{scanLabel || "Reading VIN and mileage from ECU…"}</p>
        <div className="space-y-1.5 text-left max-w-xs mx-auto">
          <StatusLine done>Adapter connected</StatusLine>
          <StatusLine active>Requesting VIN (Mode 09)</StatusLine>
          <StatusLine>Decoding vehicle specifications</StatusLine>
          <StatusLine>Reading odometer (where supported)</StatusLine>
        </div>
      </StagePanel>
    );
  }

  // ── Full scan in progress ──
  if (connState === "connected" && scanning && autoVehicle) {
    return (
      <div className="space-y-4">
        <VehicleIdentifiedBanner vehicle={autoVehicle} />
        <StagePanel icon={ScanLine} iconColor="text-fuchsia-400" iconBg="bg-fuchsia-500/15" loading>
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-white font-bold text-lg">Diagnostic Scan in Progress</h2>
            <span className="text-fuchsia-400 font-mono text-sm font-bold">{scanProgress}%</span>
          </div>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-fuchsia-500 to-purple-500 rounded-full transition-all duration-500" style={{ width: `${scanProgress}%` }} />
            </div>
            <span className="text-xs text-gray-500 font-mono shrink-0">
              {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}
            </span>
          </div>
          <div className="space-y-1.5 text-left max-w-xs mx-auto">
            {SCAN_STEPS.map((s, i) => (
              <StatusLine key={s.key} done={isDone(i)} active={isActive(i)}>
                {s.label}
              </StatusLine>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-4 flex items-center justify-center gap-1.5">
            <Activity className="w-3 h-3" /> Switch to Live Data or Tech Mode — the scan continues in the background.
          </p>
        </StagePanel>
      </div>
    );
  }

  // ── Scan complete (report overlay may be on top; this shows when dismissed) ──
  if (connState === "connected" && reportReady && autoVehicle) {
    return (
      <div className="space-y-4">
        <VehicleIdentifiedBanner vehicle={autoVehicle} />
        <StagePanel icon={CheckCircle2} iconColor="text-emerald-400" iconBg="bg-emerald-500/15">
          <h2 className="text-white font-bold text-lg mb-1">Scan Complete</h2>
          <p className="text-gray-400 text-sm mb-4">Your diagnostic report is ready to review.</p>
          <div className="flex gap-2 justify-center">
            <Button onClick={onStartNewScan} variant="outline" className="border-gray-700 text-gray-300">
              <RefreshCw className="w-4 h-4 mr-1" /> New Scan
            </Button>
            <Button onClick={onReopenReport} className="bg-fuchsia-600 hover:bg-fuchsia-700 text-white">
              <FileText className="w-4 h-4 mr-1" /> View Report
            </Button>
          </div>
        </StagePanel>
      </div>
    );
  }

  // ── VIN not available — connected but no vehicle identified ──
  if (connState === "connected" && !autoVehicle && !scanning) {
    return (
      <StagePanel icon={Car} iconColor="text-amber-400" iconBg="bg-amber-500/15">
        <h2 className="text-white font-bold text-lg mb-1">VIN Not Available from ECU</h2>
        <p className="text-gray-400 text-sm mb-4 max-w-sm mx-auto">
          The adapter connected but couldn't read the VIN. You can still scan — select a vehicle manually to continue.
        </p>
        <div className="flex gap-2 justify-center">
          <Button onClick={onOpenVehiclePanel} variant="outline" className="border-gray-700 text-gray-300">
            Select Vehicle Manually
          </Button>
          <Button onClick={onStartNewScan} className="bg-fuchsia-600 hover:bg-fuchsia-700 text-white">
            Retry VIN Read
          </Button>
        </div>
      </StagePanel>
    );
  }

  // ── Landing (default) ──
  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden bg-gradient-to-br from-gray-950 via-gray-900 to-black border border-gray-800 rounded-2xl p-8 text-center">
        <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-500/5 to-transparent pointer-events-none" />
        <div className="relative">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-fuchsia-500/15 flex items-center justify-center">
            <Hexagon className="w-9 h-9 text-fuchsia-400" fill="currentColor" fillOpacity={0.2} strokeWidth={1.5} />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight mb-1">AI Vehicle Diagnostic Scan</h1>
          <p className="text-gray-400 text-sm mb-6 max-w-md mx-auto">
            Connect your OBD2 adapter to run a full system scan with AI-powered health analysis.
          </p>
          <Button onClick={onConnect} size="lg" className="bg-fuchsia-600 hover:bg-fuchsia-700 text-white px-8 h-12 text-base font-bold">
            <Zap className="w-5 h-5 mr-2" /> Start Diagnostic Scan
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StepCard step={1} icon={Bluetooth} title="Connect Adapter" desc="Pair your BLE OBD2 dongle and initialize the ELM327 protocol." />
        <StepCard step={2} icon={Car} title="Identify Vehicle" desc="Auto-read VIN and decode year, make, model, and mileage." />
        <StepCard step={3} icon={ScanLine} title="Run Full Scan" desc="Pull all codes, emissions readiness, and live data with AI analysis." />
      </div>

      <div className="flex justify-center">
        <button onClick={onOpenVehiclePanel} className="text-xs text-gray-500 hover:text-gray-300 underline">
          Or select an existing vehicle manually
        </button>
      </div>
    </div>
  );
}

function StagePanel({ icon: Icon, iconColor, iconBg, loading, children }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 text-center">
      <div className={`w-14 h-14 mx-auto mb-4 rounded-2xl ${iconBg} flex items-center justify-center relative`}>
        <Icon className={`w-7 h-7 ${iconColor}`} />
        {loading && (
          <span className="absolute inset-0 rounded-2xl border-2 border-transparent border-t-fuchsia-400 animate-spin" />
        )}
      </div>
      {children}
    </div>
  );
}

function StatusLine({ done, active, children }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {done ? (
        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
      ) : active ? (
        <Loader2 className="w-4 h-4 text-fuchsia-400 animate-spin shrink-0" />
      ) : (
        <div className="w-4 h-4 rounded-full border border-gray-700 shrink-0" />
      )}
      <span className={done ? "text-gray-300" : active ? "text-white font-medium" : "text-gray-600"}>{children}</span>
    </div>
  );
}

function StepCard({ step, icon: Icon, title, desc }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 rounded-full bg-fuchsia-500/15 text-fuchsia-400 flex items-center justify-center text-xs font-bold">
          {step}
        </div>
        <Icon className="w-4 h-4 text-gray-400" />
      </div>
      <h3 className="text-white font-bold text-sm mb-1">{title}</h3>
      <p className="text-gray-500 text-xs leading-relaxed">{desc}</p>
    </div>
  );
}