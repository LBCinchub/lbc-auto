import React from "react";
import { Input } from "@/components/ui/input";
import { money } from "@/components/financial-workflow/financialMath";

const Row = ({ label, value, strong, accent }) => <div className={`flex justify-between ${strong ? "border-t border-gray-700 pt-3 text-base font-bold text-white" : "text-sm text-gray-400"}`}><span>{label}</span><span className={accent || "text-gray-200"}>{value}</span></div>;
export default function InvoiceTotalsSection({ draft, totals, onChange }) {
  const set = (field, value) => onChange({ ...draft, [field]: value });
  return <div className="grid gap-5 border-t border-gray-800 pt-5 md:grid-cols-[1fr_340px]">
    <div className="grid grid-cols-2 gap-3">
      <label className="text-xs text-gray-400">Tax Rate (%)<Input type="number" min="0" max="100" value={draft.tax_rate} onChange={e => set("tax_rate", e.target.value)} className="mt-1 border-gray-700 bg-gray-950 text-white" /></label>
      <label className="text-xs text-gray-400">Tax Applies To<select value={draft.tax_applies_to} onChange={e => set("tax_applies_to", e.target.value)} className="mt-1 h-9 w-full rounded-md border border-gray-700 bg-gray-950 px-3 text-white"><option value="both">Labor & Parts</option><option value="labor">Labor</option><option value="parts">Parts</option><option value="none">No Tax</option></select></label>
      <label className="text-xs text-gray-400">Discount Type<select value={draft.discount_type} onChange={e => set("discount_type", e.target.value)} className="mt-1 h-9 w-full rounded-md border border-gray-700 bg-gray-950 px-3 text-white"><option value="$">Fixed ($)</option><option value="%">Percent (%)</option></select></label>
      <label className="text-xs text-gray-400">Discount<Input type="number" min="0" value={draft.discount || 0} onChange={e => set("discount", e.target.value)} className="mt-1 border-gray-700 bg-gray-950 text-white" /></label>
    </div>
    <div className="space-y-2 rounded-lg bg-gray-800/50 p-4"><Row label="Parts" value={money(totals.parts)} /><Row label="Labor" value={money(totals.labor)} /><Row label="Subtotal" value={money(totals.subtotal)} />{totals.discount > 0 && <Row label="Discount" value={`-${money(totals.discount)}`} accent="text-emerald-400" />}<Row label={`Tax (${Number(draft.tax_rate) || 0}%)`} value={money(totals.tax)} /><Row label="Total" value={money(totals.total)} strong /><Row label="Amount Paid" value={money(totals.paid)} accent="text-emerald-400" /><Row label="Balance Due" value={money(totals.balance)} strong /></div>
  </div>;
}