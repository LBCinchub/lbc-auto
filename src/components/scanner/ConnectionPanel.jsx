import React from "react";
import { Button } from "@/components/ui/button";
import { Bluetooth, BluetoothConnected, Loader2 } from "lucide-react";

const INDICATOR = {
  disconnected: { dot: "bg-slate-500", text: "DISCONNECTED", color: "text-slate-400", pulse: "" },
  connecting: { dot: "bg-sky-500", text: "CONNECTING", color: "text-sky-400", pulse: "animate-pulse" },
  connected: { dot: "bg-emerald-500", text: "CONNECTED", color: "text-emerald-400", pulse: "" },
  error: { dot: "bg-red-500", text: "ERROR", color: "text-red-400", pulse: "" },
};

export default function ConnectionPanel({
  connState, adapterName, connError, readProgress, bleSupported,
  onConnect, onDisconnect,
}) {
  const ind = INDICATOR[connState] || INDICATOR.disconnected;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-white font-semibold text-sm flex items-center gap-2">
          <Bluetooth className="w-4 h-4 text-sky-400" /> CONNECTION
        </h2>
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${ind.dot} ${ind.pulse}`} />
          <span className={`text-xs font-bold tracking-wide ${ind.color}`}>{ind.text}</span>
        </div>
      </div>

      {connState === "connected" && adapterName && (
        <p className="text-xs text-emerald-400 mb-3 font-medium">
          Vgate iCar Pro 2S • {adapterName}
        </p>
      )}

      {connError && (
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-md p-3 mb-3">
          {connError}
        </div>
      )}

      {connState === "connected" ? (
        <Button
          onClick={onDisconnect}
          variant="outline"
          size="sm"
          className="border-gray-700 text-gray-300 w-full"
        >
          <BluetoothConnected className="w-4 h-4 mr-2 text-emerald-400" />
          Disconnect Adapter
        </Button>
      ) : (
        <Button
          onClick={onConnect}
          disabled={!bleSupported || connState === "connecting"}
          size="sm"
          className="bg-sky-500 hover:bg-sky-600 text-white w-full gap-2"
        >
          {connState === "connecting" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bluetooth className="w-4 h-4" />}
          {connState === "connecting" ? "Connecting..." : "CONNECT VGATE BLE"}
        </Button>
      )}

      {readProgress && (
        <p className="text-xs text-slate-500 italic mt-2">{readProgress}</p>
      )}
    </div>
  );
}