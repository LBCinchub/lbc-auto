import React, { memo } from "react";
import { Input } from "@/components/ui/input";
import { formatPhone } from "@/utils/formatPhone";

const FIELDS = [
  { key: "name", label: "Name", type: "text" },
  { key: "phone", label: "Phone", type: "tel" },
  { key: "email", label: "Email", type: "email" },
  { key: "address", label: "Address", type: "text" },
];

// One customer from the list. Entries that need a decision show their details as editable
// fields; the rest are one summary line. The tick decides whether the customer is imported.
function ImportReviewRow({ index, item, editable, existingNote, repeatNote, missing, noName, onField }) {
  const title = item.name || `Row ${item.rows[0]}: no name`;
  const vehicles = item.vehicles.map((v) => v.text).join(", ");
  const details = [formatPhone(item.phone), item.email, item.address, vehicles].filter(Boolean).join(" · ");
  const notes = [
    noName && ["text-red-400", "Add a name to import this customer."],
    existingNote && ["text-amber-300", `${existingNote}.`],
    repeatNote && ["text-amber-300", `${repeatNote}.`],
    missing && ["text-amber-300", `Missing ${missing}: fill it in below or import without it.`],
  ].filter(Boolean);
  return (
    <div className={`rounded-lg border p-3 ${editable ? "border-amber-500/30 bg-gray-900" : "border-gray-800 bg-gray-900/60"}`}>
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-sky-500" checked={item.include && !noName} disabled={noName}
          onChange={(e) => onField(index, "include", e.target.checked)} aria-label={`Import ${title}`}
        />
        <span className="min-w-0 flex-1">
          <span className="block break-words font-medium text-white">{title}</span>
          {!editable && <span className="block break-words text-sm text-gray-400">{details || "No other details"}</span>}
        </span>
        <span className="shrink-0 text-xs text-gray-500">{item.rows.length > 1 ? `Rows ${item.rows.join(", ")}` : `Row ${item.rows[0]}`}</span>
      </label>
      {editable && (
        <div className="mt-2 space-y-2 pl-7">
          {notes.map(([tone, text]) => <p key={text} className={`text-sm ${tone}`}>{text}</p>)}
          <div className="grid gap-2 sm:grid-cols-2">
            {FIELDS.map((f) => (
              <Input
                key={f.key} type={f.type} placeholder={f.label} aria-label={`${f.label}, row ${item.rows[0]}`} value={item[f.key]}
                onChange={(e) => onField(index, f.key, e.target.value)} className="border-gray-700 bg-gray-950 text-white"
              />
            ))}
          </div>
          {vehicles && <p className="text-xs text-gray-400">Vehicles: {vehicles}</p>}
        </div>
      )}
    </div>
  );
}

export default memo(ImportReviewRow);