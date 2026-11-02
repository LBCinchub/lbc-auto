import React, { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import ImportActions from "@/components/import/ImportActions";
import ImportReviewRow from "@/components/import/ImportReviewRow";
import { checkEntries, existingNote, repeatNote, startReview } from "@/lib/customerImportChecks";

const PAGE = 100;
const COLUMN_LABELS = { phone: "Phone", email: "Email", address: "Address" };
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

// Step 2: every customer found in the list, the ones that need a decision first.
export default function ImportReview({ parsed, existing, onImport, onCancel }) {
  const [start] = useState(() => startReview(parsed, existing));
  const [items, setItems] = useState(start.items);
  const [shown, setShown] = useState(PAGE);
  const checks = useMemo(() => checkEntries(items, existing, parsed.has), [items, existing, parsed.has]);
  const onField = useCallback((index, field, value) => setItems((list) => list.map((it, i) => (i === index ? { ...it, [field]: value } : it))), []);
  const selected = items.filter((it, i) => it.include && !checks[i].noName);
  const attention = start.items.filter((it) => it.attention).length;
  const noColumns = Object.keys(COLUMN_LABELS).filter((f) => !parsed.has[f]).map((f) => COLUMN_LABELS[f]);
  const actions = <ImportActions count={selected.length} onImport={() => onImport(selected)} onCancel={onCancel} />;
  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-xl border border-gray-800 bg-gray-900 p-4">
        <p className="text-white">
          Found {plural(items.length, "customer")}{parsed.skipped ? ` (${plural(parsed.skipped, "empty row")} skipped)` : ""}.{" "}
          {attention ? `${attention} need${attention === 1 ? "s" : ""} a look and ${attention === 1 ? "is" : "are"} listed first.` : "Everything looks ready."}
        </p>
        <p className="text-sm text-gray-400">Possible duplicates start unticked; tick one to import it anyway. Fill in missing details right in the list.</p>
        {noColumns.length > 0 && (
          <p className="text-sm text-amber-300">This list has no {noColumns.join(" or ")} column, so {noColumns.length === 1 ? "that detail stays" : "those details stay"} empty.</p>
        )}
        {actions}
      </div>
      <div className="space-y-2">
        {start.order.slice(0, shown).map((i) => (
          <ImportReviewRow
            key={items[i].id} index={i} item={items[i]} editable={items[i].attention} onField={onField}
            existingNote={existingNote(checks[i].existing)} repeatNote={repeatNote(checks[i].repeat)}
            missing={checks[i].missing.join(", ")} noName={checks[i].noName}
          />
        ))}
      </div>
      {start.order.length > shown && (
        <Button type="button" variant="outline" onClick={() => setShown((n) => n + PAGE)} className="border-gray-700 text-gray-300">
          Show more ({start.order.length - shown} left)
        </Button>
      )}
      {items.length > 5 && actions}
    </div>
  );
}