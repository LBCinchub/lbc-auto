import { useState, useEffect, useRef, useCallback } from "react";
import { base44 } from "@/api/base44Client";

const SCAN_TIMEOUT_MS = 120000;

/**
 * Orchestrates the professional-grade auto-connect flow:
 * 1. On BLE connect → read VIN (0902) + mileage (01A6), decode via NHTSA.
 * 2. Kick off a non-blocking background scan (DTCs 03/07/0A, supported PIDs,
 *    emissions 0101, freeze frame 0202) with live progress.
 * 3. When complete (or after 120s) → generate an AI health summary.
 *
 * All state lives here so it persists across scanner tab switches (the parent
 * Diagnostics component stays mounted while Scan/Live/Tech tabs unmount/remount).
 */
export function useAutoConnectScan({ clientRef, connState }) {
  const [autoVehicle, setAutoVehicle] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanLabel, setScanLabel] = useState("");
  const [scanResults, setScanResults] = useState(null);
  const [reportReady, setReportReady] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [aiSummary, setAiSummary] = useState("");
  const cancelledRef = useRef(false);
  const runRef = useRef(null);

  const dismissReport = useCallback(() => setReportOpen(false), []);
  const reopenReport = useCallback(() => setReportOpen(true), []);

  // ── Kick everything off when BLE connects ────────────────────────────
  useEffect(() => {
    if (connState !== "connected" || !clientRef.current) return;
    cancelledRef.current = false;
    setAutoVehicle(null);
    setScanResults(null);
    setReportReady(false);
    setReportOpen(false);
    setAiSummary("");
    setScanning(true);
    setScanProgress(5);
    runAutoDetectAndScan();
    return () => { cancelledRef.current = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connState]);

  // Stop background scan when adapter disconnects
  useEffect(() => {
    if (connState !== "connected") {
      cancelledRef.current = true;
      setScanning(false);
    }
  }, [connState]);

  const decodeVinNhtsa = async (vin) => {
    try {
      const res = await fetch(
        `https://vpic.nhtsa.dot.gov/api/vehicles/decodevin/${vin.trim()}?format=json`
      );
      if (!res.ok) return null;
      const json = await res.json();
      const results = json.Results || [];
      const get = (v) => {
        const item = results.find((r) => r.Variable === v);
        return item?.Value && item.Value !== "Not Applicable" && item.Value !== "0"
          ? item.Value
          : "";
      };
      const make = get("Make");
      const model = get("Model");
      const year = get("Model Year");
      const trim = get("Trim");
      const cyl = get("Engine Number of Cylinders");
      const disp = get("Displacement (L)");
      const fuel = get("Fuel Type - Primary");
      const config = get("Engine Configuration");
      const parts = [];
      if (cyl) parts.push(`${cyl}-cyl`);
      if (disp) parts.push(`${parseFloat(disp).toFixed(1)}L`);
      if (config) parts.push(config);
      if (fuel) parts.push(fuel);
      const engine = parts.join(" ") || "";
      return { make, model, year, trim, engine, engine_type: engine };
    } catch (e) {
      return null;
    }
  };

  const runAutoDetectAndScan = async () => {
    const client = clientRef.current;
    if (!client) return;
    const deadline = Date.now() + SCAN_TIMEOUT_MS;
    const timedOut = () => Date.now() > deadline;

    // ── 1. VIN + mileage ──
    setScanLabel("Reading VIN...");
    setScanProgress(8);
    const vin = await client.readVIN().catch(() => null);
    const mileage = await client.readMileage().catch(() => null);
    let decoded = null;
    if (vin) decoded = await decodeVinNhtsa(vin);
    if (cancelledRef.current) return;

    if (vin && decoded?.year && decoded?.make && decoded?.model) {
      setAutoVehicle({
        vin,
        year: decoded?.year || "",
        make: decoded?.make || "",
        model: decoded?.model || "",
        trim: decoded?.trim || "",
        engine: decoded?.engine || "",
        engine_type: decoded?.engine || "",
        mileage_km: mileage,
        mileage,
      });
    }

    if (cancelledRef.current || timedOut()) return finishScan({ storedCodes: [], pendingCodes: [], permanentCodes: [] }, vin, decoded, mileage);

    // ── 2. Background scan ──
    setScanLabel("Reading stored codes (Mode 03)...");
    setScanProgress(20);
    const stored = await client.readDTCs().catch(() => []);
    if (cancelledRef.current || timedOut()) return finishScan({ storedCodes: stored }, vin, decoded, mileage);

    setScanLabel("Reading pending codes (Mode 07)...");
    setScanProgress(38);
    const pending = await client.readPendingDTCs().catch(() => []);
    if (cancelledRef.current || timedOut()) return finishScan({ storedCodes: stored, pendingCodes: pending }, vin, decoded, mileage);

    setScanLabel("Reading permanent codes (Mode 0A)...");
    setScanProgress(52);
    const permanent = await client.readPermanentDTCs().catch(() => []);
    if (cancelledRef.current || timedOut()) return finishScan({ storedCodes: stored, pendingCodes: pending, permanentCodes: permanent }, vin, decoded, mileage);

    setScanLabel("Polling supported PIDs...");
    setScanProgress(68);
    const supportedPids = await client.getSupportedPids().catch(() => new Set());
    const snapshot = await readLiveSnapshot(client, supportedPids);
    if (cancelledRef.current || timedOut()) return finishScan({ storedCodes: stored, pendingCodes: pending, permanentCodes: permanent, liveSnapshot: snapshot }, vin, decoded, mileage);

    setScanLabel("Checking emissions readiness...");
    setScanProgress(84);
    const emissions = await client.readEmissionsReadiness().catch(() => null);

    let freezeFrame = null;
    if (stored.length || pending.length) {
      setScanLabel("Reading freeze frame...");
      setScanProgress(92);
      freezeFrame = await client.readFreezeFrame().catch(() => null);
    }

    finishScan({ storedCodes: stored, pendingCodes: pending, permanentCodes: permanent, liveSnapshot: snapshot, emissions, freezeFrame }, vin, decoded, mileage);
  };

  runRef.current = runAutoDetectAndScan;

  // Re-run the full detect + scan flow without reconnecting (adapter stays paired).
  const restartScan = useCallback(() => {
    if (!clientRef.current) return;
    cancelledRef.current = false;
    setScanResults(null);
    setReportReady(false);
    setReportOpen(false);
    setAiSummary("");
    setAutoVehicle(null);
    setScanning(true);
    setScanProgress(5);
    runRef.current?.();
  }, [clientRef]);

  const finishScan = async (results, vin, decoded, mileage) => {
    if (cancelledRef.current) return;
    // Ensure autoVehicle is set even on early-exit paths
    if (vin && decoded?.year && decoded?.make && decoded?.model && !autoVehicle) {
      setAutoVehicle({
        vin,
        year: decoded?.year || "",
        make: decoded?.make || "",
        model: decoded?.model || "",
        trim: decoded?.trim || "",
        engine: decoded?.engine || "",
        engine_type: decoded?.engine || "",
        mileage_km: mileage,
        mileage,
      });
    }
    setScanResults(results);
    setScanProgress(100);
    setScanLabel("Scan complete");
    setScanning(false);
    setReportReady(true);
    setReportOpen(!!(vin && decoded?.year && decoded?.make && decoded?.model));
  };

  const setManualVehicle = useCallback((vehicle) => {
    setAutoVehicle({ ...vehicle, engine_type: vehicle.engine || "", mileage: vehicle.mileage_km ?? null });
    setReportOpen(true);
  }, []);

  return {
    autoVehicle, scanning, scanProgress, scanLabel, scanResults,
    reportReady, reportOpen, dismissReport, reopenReport, aiSummary, setAiSummary, restartScan, setManualVehicle,
  };
}

/** Read the 4 key snapshot PIDs (RPM, coolant, battery, throttle) for the report. */
async function readLiveSnapshot(client, supportedPids) {
  const pids = [
    { pid: "010C", key: "rpm", parse: (b) => Math.round((b[0] * 256 + b[1]) / 4) },
    { pid: "0105", key: "coolant", parse: (b) => b[0] - 40 },
    { pid: "0142", key: "battery", parse: (b) => Math.round(((b[0] * 256 + b[1]) / 1000) * 100) / 100 },
    { pid: "0111", key: "throttle", parse: (b) => Math.round((b[0] * 100 / 255) * 10) / 10 },
  ];
  const out = {};
  for (const p of pids) {
    if (supportedPids.size && !supportedPids.has(p.pid)) continue;
    try {
      const response = await client.readPID(p.pid);
      if (/NO DATA|UNABLE TO CONNECT|ERROR/i.test(response)) continue;
      const bytes = client.parsePIDResponse(response, p.pid);
      if (bytes) out[p.key] = p.parse(bytes);
    } catch (e) { /* skip unsupported */ }
  }
  return out;
}