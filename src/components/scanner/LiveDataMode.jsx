import React, { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Loader2, Play, Square, Download, AlertTriangle, Sparkles, Activity,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { LIVE_PIDS, EV_PIDS, checkAlerts, getGaugeStatus, isLikelyHybrid } from "@/lib/obd/pids";
import LiveGauge from "@/components/scanner/LiveGauge";

export default function LiveDataMode({ clientRef, connState, selectedVehicle }) {
  const [streaming, setStreaming] = useState(false);
  const [liveData, setLiveData] = useState({});
  const [alerts, setAlerts] = useState([]);
  const [streamTime, setStreamTime] = useState(0);
  const [logging, setLogging] = useState(false);
  const [logData, setLogData] = useState([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const intervalRef = useRef(null);
  const startTimeRef = useRef(null);

  const isEV = isLikelyHybrid(selectedVehicle);
  const activePids = isEV ? [...LIVE_PIDS, ...EV_PIDS] : LIVE_PIDS;
  const connected = connState === "connected";

  const pollPIDs = useCallback(async () => {
    if (!clientRef.current || !streaming) return;
    const updates = {};
    for (const pid of activePids) {
      try {
        const response = await clientRef.current.readPID(pid.pid);
        if (/NO DATA|UNABLE TO CONNECT|ERROR/i.test(response)) continue;
        const bytes = clientRef.current.parsePIDResponse(response, pid.pid);
        if (bytes && bytes.length >= pid.formula.length) {
          const value = pid.formula(...bytes);
          updates[pid.key] = { value, pid };
        }
      } catch (e) {
        // skip unsupported PID
      }
    }
    setLiveData(updates);
    setAlerts(checkAlerts(updates));

    // Log data point
    if (logging) {
      setLogData(prev => [...prev.slice(-480), { t: Date.now(), ...Object.fromEntries(
        Object.entries(updates).map(([k, v]) => [k, v.value])
      )}]);
    }
  }, [streaming, logging, activePids]);

  useEffect(() => {
    if (!streaming) return;
    startTimeRef.current = Date.now();
    intervalRef.current = setInterval(pollPIDs, 500);
    const timer = setInterval(() => {
      if (startTimeRef.current) {
        setStreamTime(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }
    }, 1000);
    return () => {
      clearInterval(intervalRef.current);
      clearInterval(timer);
    };
  }, [streaming, pollPIDs]);

  const handleStartStream = () => {
    setLiveData({});
    setAlerts([]);
    setStreamTime(0);
    setAiAnalysis(null);
    setStreaming(true);
  };

  const handleStopStream = () => {
    setStreaming(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  const handleToggleLog = () => {
    if (logging) {
      setLogging(false);
    } else {
      setLogData([]);
      setLogging(true);
    }
  };

  const handleExportCSV = () => {
    if (!logData.length) return;
    const keys = Object.keys(logData[0]).filter(k => k !== "t");
    const header = ["timestamp", ...keys].join(",");
    const rows = logData.map(row => {
      const ts = new Date(row.t).toISOString();
      return [ts, ...keys.map(k => row[k] ?? "")].join(",");
    });
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lbc-scanner-log-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleAnalyzeLive = async () => {
    if (!Object.keys(liveData).length) return;
    setAnalyzing(true);
    setAiAnalysis(null);
    try {
      const vehicleDesc = selectedVehicle
        ? `${selectedVehicle.year || ""} ${selectedVehicle.make || ""} ${selectedVehicle.model || ""}`.trim()
        : "Unknown vehicle";
      const snapshot = Object.entries(liveData).map(([k, v]) => `${v.pid.name}: ${v.value} ${v.pid.unit}`).join(", ");
      const res = await base44.functions.invoke("lbcDiagAI", {
        mode: "chat",
        vehicle: vehicleDesc,
        live_data: Object.fromEntries(Object.entries(liveData).map(([k, v]) => [k, v.value])),
        messages: [{ role: "user", content: `Analyze these real-time OBD2 readings for a ${vehicleDesc}: ${snapshot}. Identify any abnormal values, what they indicate, and what the mechanic should check next.` }],
      });
      setAiAnalysis(res.data?.reply || "No analysis returned.");
    } catch (err) {
      setAiAnalysis("⚠️ " + (err?.message || "AI analysis failed."));
    } finally {
      setAnalyzing(false);
    }
  };

  const fmtTime = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  return (
    <div className="space-y-4">
      {/* Control bar */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Activity className="w-5 h-5 text-emerald-400" />
          <div>
            <h2 className="text-white font-bold text-sm">LIVE DATA</h2>
            <p className="text-xs text-gray-500">
              {streaming ? (
                <span className="text-emerald-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> STREAMING · {fmtTime(streamTime)}
                </span>
              ) : "Press START to begin real-time sensor streaming"}
              {logging && <span className="text-amber-400 ml-2">· LOGGING</span>}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {!streaming ? (
            <Button onClick={handleStartStream} disabled={!connected} className="bg-emerald-500 hover:bg-emerald-600 text-white gap-2" size="sm">
              <Play className="w-4 h-4" /> START STREAM
            </Button>
          ) : (
            <Button onClick={handleStopStream} className="bg-red-500 hover:bg-red-600 text-white gap-2" size="sm">
              <Square className="w-4 h-4" /> STOP
            </Button>
          )}
          <Button onClick={handleToggleLog} variant="outline" size="sm" className="border-gray-700 text-gray-300 gap-2" disabled={!streaming}>
            {logging ? "STOP LOG" : "LOG DATA"}
          </Button>
          {logData.length > 0 && (
            <Button onClick={handleExportCSV} variant="outline" size="sm" className="border-gray-700 text-gray-300 gap-2">
              <Download className="w-4 h-4" /> CSV
            </Button>
          )}
        </div>
      </div>

      {/* Smart alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert, i) => (
            <div
              key={i}
              className={`rounded-lg p-3 flex items-center gap-3 text-sm border ${
                alert.level === "critical"
                  ? "bg-red-500/10 border-red-500/40 text-red-300"
                  : "bg-amber-500/10 border-amber-500/40 text-amber-300"
              }`}
            >
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {alert.msg}
            </div>
          ))}
        </div>
      )}

      {/* Gauges grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {activePids.map(pid => {
          const data = liveData[pid.key];
          const value = data?.value;
          const status = getGaugeStatus(pid, value);
          return (
            <LiveGauge key={pid.key} pid={pid} value={value} unit={pid.unit} status={status} />
          );
        })}
      </div>

      {/* EV panel */}
      {isEV && (
        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4">
          <h3 className="text-emerald-400 font-bold text-sm mb-3">⚡ EV / HYBRID DATA</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {EV_PIDS.map(pid => {
              const data = liveData[pid.key];
              return (
                <LiveGauge key={pid.key} pid={pid} value={data?.value} unit={pid.unit} status={getGaugeStatus(pid, data?.value)} />
              );
            })}
          </div>
        </div>
      )}

      {/* AI Analyze Live Data button — appears after 30s of streaming */}
      {streaming && streamTime >= 30 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3">
          {!aiAnalysis && !analyzing && (
            <Button onClick={handleAnalyzeLive} className="bg-purple-500 hover:bg-purple-600 text-white gap-2">
              <Sparkles className="w-4 h-4" /> AI ANALYZE LIVE DATA
            </Button>
          )}
          {analyzing && (
            <div className="flex items-center gap-2 py-2">
              <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
              <span className="text-gray-400 text-sm">AI analyzing live data snapshot...</span>
            </div>
          )}
          {aiAnalysis && (
            <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4 text-sm text-purple-200 whitespace-pre-wrap leading-relaxed">
              {aiAnalysis}
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!streaming && (
        <div className="bg-gray-900 border border-gray-800 border-dashed rounded-xl p-12 text-center">
          <Activity className="w-10 h-10 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">
            {connected
              ? "Press START STREAM to view real-time sensor data from the vehicle."
              : "Connect a BLE OBD2 adapter to start streaming live data."}
          </p>
        </div>
      )}
    </div>
  );
}