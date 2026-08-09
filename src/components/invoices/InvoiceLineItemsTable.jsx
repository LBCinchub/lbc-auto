import React, { useLayoutEffect, useRef } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

// Auto-growing textarea that starts at one line (matching the input height)
// and expands vertically as the user types, so long descriptions wrap instead
// of being clipped. Box styling mirrors the single-line Input used by Qty/Rate.
function DescriptionInput({ value, onChange }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, [value]);
  return (
    <Textarea
      ref={ref}
      value={value || ""}
      onChange={onChange}
      rows={1}
      className="min-h-[36px] resize-none overflow-hidden border-gray-700 bg-gray-950 px-3 py-2 leading-snug text-white"
    />
  );
}

export default function InvoiceLineItemsTable({ lines, onChange }) {
  const update = (index, field, value) => onChange(lines.map((line, i) => i === index ? { ...line, [field]: value } : line));
  const add = type => onChange([...lines, { type, description: "", quantity: 1, unit_price: 0, taxable: true, source: "Manual" }]);
  return <section className="py-5">
    <div className="mb-3 flex items-center justify-between"><h3 className="font-semibold text-white">Line Items</h3><div className="flex gap-2"><Button type="button" size="sm" variant="outline" onClick={() => add("labor")}><Plus /> Labor</Button><Button type="button" size="sm" variant="outline" onClick={() => add("part")}><Plus /> Part</Button></div></div>
    <div className="overflow-x-auto rounded-lg border border-gray-800"><table className="w-full min-w-[860px] table-fixed text-sm">
      <colgroup>
        <col className="w-[88px]" />
        <col />
        <col className="w-[104px]" />
        <col className="w-[124px]" />
        <col className="w-[104px]" />
        <col className="w-12" />
      </colgroup>
      <thead className="bg-gray-800/70 text-left text-xs uppercase tracking-wide text-gray-400"><tr><th className="px-3 py-3">Type</th><th className="px-3 py-3">Description</th><th className="px-3 py-3 text-right">Qty / Hours</th><th className="px-3 py-3 text-right">Rate / Price</th><th className="px-3 py-3 text-right">Amount</th><th /></tr></thead>
      <tbody className="divide-y divide-gray-800">{lines.map((line, index) => <tr key={`${line.source || "line"}-${index}`} className="bg-gray-900/40 align-top">
        <td className="px-3 py-2"><select value={line.type} onChange={e => update(index, "type", e.target.value)} className="h-9 rounded-md border border-gray-700 bg-gray-950 px-2 text-white"><option value="labor">Labor</option><option value="part">Part</option></select></td>
        <td className="px-3 py-2"><DescriptionInput value={line.description} onChange={e => update(index, "description", e.target.value)} /></td>
        <td className="px-3 py-2"><Input type="number" min="0" step="0.01" value={line.quantity} onChange={e => update(index, "quantity", e.target.value)} className="border-gray-700 bg-gray-950 text-right text-white" /></td>
        <td className="px-3 py-2"><Input type="number" min="0" step="0.01" value={line.unit_price} onChange={e => update(index, "unit_price", e.target.value)} className="border-gray-700 bg-gray-950 text-right text-white" /></td>
        <td className="px-3 py-2 text-right font-medium text-white tabular-nums">${((Number(line.quantity) || 0) * (Number(line.unit_price) || 0)).toFixed(2)}</td>
        <td className="px-2 py-2 text-right"><button type="button" onClick={() => onChange(lines.filter((_, i) => i !== index))} className="text-gray-500 hover:text-rose-400"><Trash2 className="h-4 w-4" /></button></td>
      </tr>)}{lines.length === 0 && <tr><td colSpan="6" className="px-4 py-10 text-center text-gray-500">No line items added.</td></tr>}</tbody>
    </table></div>
  </section>;
}