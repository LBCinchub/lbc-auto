import React from "react";

export default function PageSkeleton({ rows = 5, headerHeight = "h-10", rowHeight = "h-20" }) {
  return (
    <div className="space-y-4 animate-pulse">
      <div className={`${headerHeight} rounded-xl bg-gray-800/30 w-1/3`} />
      <div className="h-10 rounded-xl bg-gray-800/30" />
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className={`${rowHeight} rounded-xl bg-gray-800/30`} />
        ))}
      </div>
    </div>
  );
}