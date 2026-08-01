import React from "react";
export default function FinancialWorkflowShell({ children }) {
  return <div className="fixed inset-0 z-[10020] bg-gray-950 md:bg-black/80 md:p-4"><div role="dialog" aria-modal="true" className="mx-auto flex h-full w-full max-w-7xl flex-col overflow-hidden bg-gray-950 md:rounded-2xl md:border md:border-gray-800 md:shadow-2xl">{children}</div></div>;
}