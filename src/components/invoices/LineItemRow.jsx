import React, { memo } from "react";
import { Trash2 } from "lucide-react";
import ItemNameAutocomplete from "@/components/shared/ItemNameAutocomplete";
import LineNumberInput from "@/components/invoices/LineNumberInput";
import LineDescriptionInput from "@/components/invoices/LineDescriptionInput";

// A click anywhere in a cell puts the cursor in that cell's field: in the padding just off the
// box (mousedown), and for clicks that don't move the cursor by themselves (click), so the
// next keys typed never land in the field that had the cursor before (e.g. "Oil Change1").
const focusCellField = (e) => {
  const field = e.currentTarget.querySelector("input, textarea");
  if (!field) return;
  if (e.type === "mousedown") {
    if (e.target !== e.currentTarget) return;
    e.preventDefault();
  } else if (document.activeElement === field) return;
  field.focus();
};

// One line item. Its handlers never change, so typing in this line redraws only this line.
// Every control's label names its line ("Line 2 Rate / Price"), so screen readers and
// test tools can tell the labor row's fields from the part row's.
function LineItemRow({ line, index, autoFocus, onField, onRemove }) {
  const n = index + 1;
  const amount = (Number(line.quantity) || 0) * (Number(line.unit_price) || 0);
  return (
    <tr className="bg-gray-900/40 align-top">
      <td className="px-3 py-2"><select aria-label={`Line ${n} Type`} value={line.type} onChange={(e) => onField(index, "type", e.target.value)} className="h-9 rounded-md border border-gray-700 bg-gray-950 px-2 text-white"><option value="labor">Labor</option><option value="part">Part</option></select></td>
      <td className="px-3 py-2" onMouseDown={focusCellField} onClick={focusCellField}><ItemNameAutocomplete autoFocus={autoFocus} ariaLabel={`Line ${n} Item name`} placeholder="Item name" value={line.name || ""} type={line.type} onChange={(name) => onField(index, "name", name)} onPriceSelect={(price) => onField(index, "unit_price", price)} className="border-gray-700 bg-gray-950 text-white" /></td>
      <td className="px-3 py-2" onMouseDown={focusCellField} onClick={focusCellField}><LineDescriptionInput ariaLabel={`Line ${n} Description`} value={line.description} onChange={(e) => onField(index, "description", e.target.value)} /></td>
      <td className="px-3 py-2" onMouseDown={focusCellField} onClick={focusCellField}><LineNumberInput ariaLabel={`Line ${n} Qty / Hours`} value={line.quantity} onChange={(v) => onField(index, "quantity", v)} className="border-gray-700 bg-gray-950 text-right text-white" /></td>
      <td className="px-3 py-2" onMouseDown={focusCellField} onClick={focusCellField}><LineNumberInput ariaLabel={`Line ${n} Rate / Price`} value={line.unit_price} onChange={(v) => onField(index, "unit_price", v)} className="border-gray-700 bg-gray-950 text-right text-white" /></td>
      <td className="px-3 py-2 text-right font-medium text-white tabular-nums">${amount.toFixed(2)}</td>
      <td className="px-2 py-2 text-right"><button type="button" aria-label={`Remove line ${n}`} onClick={() => onRemove(index)} className="text-gray-500 hover:text-rose-400"><Trash2 className="h-4 w-4" /></button></td>
    </tr>
  );
}

export default memo(LineItemRow);