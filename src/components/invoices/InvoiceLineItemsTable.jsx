import React, { useCallback, useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import LineItemRow from "@/components/invoices/LineItemRow";

export default function InvoiceLineItemsTable({ lines, onChange }) {
  // Every change builds on the newest lines (so two changes in one action, like a picked item's
  // name AND price, both stick), and the row handlers below never change, so a keystroke
  // redraws only the line being typed in instead of the whole table.
  const latest = useRef(lines);
  latest.current = lines;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const commit = useCallback((next) => { latest.current = next; onChangeRef.current(next); }, []);
  const onField = useCallback((index, field, value) => commit(latest.current.map((line, i) => (i === index ? { ...line, [field]: value } : line))), [commit]);
  const onRemove = useCallback((index) => commit(latest.current.filter((_, i) => i !== index)), [commit]);
  // A newly added line puts the cursor in its Item field, so typing lands there. Only the render
  // that adds the line does this; afterwards nothing can pull the cursor back to Item.
  const [focusIndex, setFocusIndex] = useState(-1);
  useEffect(() => { if (focusIndex !== -1) setFocusIndex(-1); }, [focusIndex]);
  const add = (type) => {
    setFocusIndex(latest.current.length);
    commit([...latest.current, { type, name: "", description: "", quantity: 1, unit_price: 0, taxable: true, source: "Manual" }]);
  };
  return <section className="py-5">
    <div className="mb-3 flex items-center justify-between"><h3 className="font-semibold text-white">Line Items</h3><div className="flex gap-2"><Button type="button" size="sm" variant="outline" onClick={() => add("labor")}><Plus /> Labor</Button><Button type="button" size="sm" variant="outline" onClick={() => add("part")}><Plus /> Part</Button></div></div>
    <div className="overflow-x-auto rounded-lg border border-gray-800"><table className="w-full min-w-[780px] table-fixed text-sm">
      <colgroup>
        <col className="w-[80px]" />
        <col className="w-[24%]" />
        <col />
        <col className="w-[96px]" />
        <col className="w-[116px]" />
        <col className="w-[100px]" />
        <col className="w-12" />
      </colgroup>
      <thead className="bg-gray-800/70 text-left text-xs uppercase tracking-wide text-gray-400"><tr><th className="px-3 py-3">Type</th><th className="px-3 py-3">Item</th><th className="px-3 py-3">Description</th><th className="px-3 py-3 text-right">Qty / Hours</th><th className="px-3 py-3 text-right">Rate / Price</th><th className="px-3 py-3 text-right">Amount</th><th /></tr></thead>
      <tbody className="divide-y divide-gray-800">{lines.map((line, index) => <LineItemRow key={`${line.source || "line"}-${index}`} line={line} index={index} autoFocus={index === focusIndex} onField={onField} onRemove={onRemove} />)}{lines.length === 0 && <tr><td colSpan="7" className="px-4 py-10 text-center text-gray-500">No line items added.</td></tr>}</tbody>
    </table></div>
  </section>;
}