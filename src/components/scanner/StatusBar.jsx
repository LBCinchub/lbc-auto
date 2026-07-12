import React, { useEffect, useState } from "react";
import { Activity, Clock } from "lucide-react";

export default function StatusBar({ adapterName, protocol, vehicleInfo, sessionStart }) {
  const [elapsed, setElapsed] = useState("00:00:00");

  useEffect(() => {
    if (!sessionStart) return;
    const tick = () => {
      const sec = Math.floor((Date.now() - sessionStart) / 1000);
      const h = Math.floor(sec / 3600);
      const m = Math.floor((sec % 3600) / 60);
      const s = sec % 60;
      setElapsed(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [sessionStart]);

  return (
    <div className="bg-gray-950 border border-gray-800 rounded-xl px-4 py-2.5 flex items-center justify-between text-xs font-mono">
      <div className="flex items-center gap-2">
        <Activity className="w-3.5 h-3.5 text-fuchsia-500" />
        <span className="text-fuchsia-400 font-bold">LBC AUTO AI SCANNER</span>
        <span className="text-gray-600">|</span>
        <span className="text-gray-500">Pro License</span>
      </div>
      <div className="flex items-center gap-3 text-gray-500">
        {adapterName && (
          <span>
            <span className="text-emerald-500">●</span> {adapterName}
          </span>
        )}
        {protocol && (
          <>
            <span className="text-gray-700">|</span>
            <span>{protocol}</span>
          </>
        )}
        {vehicleInfo && (
          <>
            <span className="text-gray-700">|</span>
            <span className="text-gray-400">{vehicleInfo}</span>
          </>
        )}
        <span className="text-gray-700">|</span>
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" /> {elapsed}
        </span>
      </div>
    </div>
  );
}