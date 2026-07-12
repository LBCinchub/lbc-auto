import React from "react";
import { Car, Bluetooth, WifiOff, X, ChevronRight } from "lucide-react";

export default function VehicleConnectionBanner({
  selectedVehicle,
  connState,
  adapterName,
  protocol,
  voltage,
  vin,
  onConnect,
  onDisconnect,
  onVehicleChange,
}) {
  const vehicleDesc = selectedVehicle
    ? `${selectedVehicle.year || ""} ${selectedVehicle.make || ""} ${selectedVehicle.model || ""} ${selectedVehicle.engine_type || ""}`.trim()
    : "No vehicle selected";

  const connected = connState === "connected";

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <div className="grid md:grid-cols-2 divide-x divide-gray-800">
        {/* VEHICLE */}
        <div className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center shrink-0">
            <Car className="w-5 h-5 text-sky-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Vehicle</p>
            <p className="text-sm text-white font-semibold truncate">{vehicleDesc}</p>
            <p className="text-xs text-gray-500 font-mono truncate">
              {vin || selectedVehicle?.vin || `VIN: ${selectedVehicle?.vin || "—"}`}
            </p>
          </div>
          <button
            onClick={onVehicleChange}
            className="text-xs text-sky-400 hover:text-sky-300 font-semibold whitespace-nowrap flex items-center gap-1 px-2 py-1 rounded hover:bg-sky-500/10"
          >
            CHANGE <ChevronRight className="w-3 h-3" />
          </button>
        </div>

        {/* CONNECTION */}
        <div className="p-4 flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border ${
            connected
              ? "bg-emerald-500/10 border-emerald-500/20"
              : "bg-gray-800 border-gray-700"
          }`}>
            {connected ? (
              <Bluetooth className="w-5 h-5 text-emerald-400" />
            ) : (
              <WifiOff className="w-5 h-5 text-gray-500" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">BLE Connection</p>
            {connected ? (
              <>
                <p className="text-sm text-white font-semibold truncate flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  {adapterName || "OBD2 Adapter"}
                </p>
                <p className="text-xs text-gray-500 font-mono truncate">
                  {protocol ? `Protocol: ${protocol}` : "Connected"}{voltage ? ` · ${voltage}` : ""}
                </p>
              </>
            ) : (
              <p className="text-sm text-gray-400">
                {connState === "connecting" ? "Connecting..." : "Disconnected"}
              </p>
            )}
          </div>
          {connected ? (
            <button
              onClick={onDisconnect}
              className="text-xs text-red-400 hover:text-red-300 font-semibold flex items-center gap-1 px-2 py-1 rounded hover:bg-red-500/10"
            >
              <X className="w-3.5 h-3.5" /> DISCONNECT
            </button>
          ) : (
            <button
              onClick={onConnect}
              disabled={connState === "connecting"}
              className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold px-3 py-1.5 rounded border border-emerald-500/30 hover:bg-emerald-500/10 disabled:opacity-50"
            >
              {connState === "connecting" ? "..." : "CONNECT"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}