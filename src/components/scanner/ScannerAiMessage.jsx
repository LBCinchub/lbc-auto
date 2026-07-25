import React from "react";
import { Button } from "@/components/ui/button";
import { FileText, Printer, Save, Wrench } from "lucide-react";

export default function ScannerAiMessage({ message, isLatest, showRepairActions, onRepairOrder, onEstimate, onPrint, onSave }) {
  const assistant = message.role === "assistant";
  return <div className={assistant ? "flex justify-start" : "flex justify-end"}>
    <div className={`max-w-[92%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap leading-relaxed ${assistant ? "bg-gray-800 text-gray-200" : "bg-sky-600 text-white"}`}>
      {message.content}
      {assistant && isLatest && <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-gray-700">
        {showRepairActions && <Button size="sm" onClick={onRepairOrder} className="bg-sky-600 hover:bg-sky-700"><Wrench className="w-3.5 h-3.5" /> Add To Repair Order</Button>}
        {showRepairActions && <Button size="sm" onClick={onEstimate} className="bg-emerald-600 hover:bg-emerald-700"><FileText className="w-3.5 h-3.5" /> Create Estimate</Button>}
        <Button size="sm" variant="outline" onClick={onPrint} className="border-gray-600 text-gray-200"><Printer className="w-3.5 h-3.5" /> Print Explanation</Button>
        <Button size="sm" variant="outline" onClick={onSave} className="border-gray-600 text-gray-200"><Save className="w-3.5 h-3.5" /> Save AI Notes</Button>
      </div>}
    </div>
  </div>;
}