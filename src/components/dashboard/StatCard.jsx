import React from "react";
import { cn } from "@/lib/utils";

export default function StatCard({ title, value, icon: Icon, trend, trendLabel, color = "sky", onClick }) {
  const colors = {
    sky: "from-sky-500/20 to-sky-600/5 text-sky-400 border-sky-500/20",
    green: "from-emerald-500/20 to-emerald-600/5 text-emerald-400 border-emerald-500/20",
    amber: "from-amber-500/20 to-amber-600/5 text-amber-400 border-amber-500/20",
    purple: "from-purple-500/20 to-purple-600/5 text-purple-400 border-purple-500/20",
    rose: "from-rose-500/20 to-rose-600/5 text-rose-400 border-rose-500/20",
  };

  const iconColors = {
    sky: "bg-sky-500/20 text-sky-400",
    green: "bg-emerald-500/20 text-emerald-400",
    amber: "bg-amber-500/20 text-amber-400",
    purple: "bg-purple-500/20 text-purple-400",
    rose: "bg-rose-500/20 text-rose-400",
  };

  return (
    <div onClick={onClick} className={cn(
      "relative overflow-hidden rounded-xl border bg-gradient-to-br p-5",
      onClick ? "cursor-pointer hover:brightness-110 transition-all" : "",
      colors[color]
    )}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-400 font-medium">{title}</p>
          <p className="text-2xl font-bold text-white mt-1">{value}</p>
          {trendLabel && (
            <p className={cn("text-xs mt-2 font-medium", trend >= 0 ? "text-emerald-400" : "text-rose-400")}>
              {trend >= 0 ? "↑" : "↓"} {Math.abs(trend)}% {trendLabel}
            </p>
          )}
        </div>
        <div className={cn("p-2.5 rounded-lg", iconColors[color])}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}