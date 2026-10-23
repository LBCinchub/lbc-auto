// Pure helpers for RepairOrderFormDialog saves.
const num = (v, fallback = 0) => { const n = parseFloat(v); return Number.isFinite(n) ? n : fallback; };

// Blank/invalid rate falls back to the default; a legitimate 0 rate is preserved.
export const laborRate = (row, fallback = 120) => (row?.rate === "" || row?.rate == null ? fallback : num(row.rate, fallback));

// Schema stores numbers; the form keeps strings while typing. Coerce before persisting.
export function normalizeLaborItems(items = [], fallbackRate = 120) {
  return items.map((r) => { const hours = num(r.hours); const rate = laborRate(r, fallbackRate); return { ...r, hours, rate, total: Math.round(hours * rate * 100) / 100 }; });
}
export function normalizeParts(parts = []) {
  return parts.map((p) => { const quantity = num(p.quantity); const unit_price = num(p.unit_price); return { ...p, quantity, unit_price, total: Math.round(quantity * unit_price * 100) / 100 }; });
}

// Only the quantity increase since the last persisted state is deducted, so re-saving or
// retrying never deducts the same parts again.
export function inventoryDeltas(previous = [], next = []) {
  const sum = (rows) => rows.reduce((m, p) => (p.part_id ? m.set(p.part_id, (m.get(p.part_id) || 0) + num(p.quantity)) : m), new Map());
  const before = sum(previous); const after = sum(next);
  return [...after].map(([part_id, qty]) => ({ part_id, delta: qty - (before.get(part_id) || 0) })).filter((d) => d.delta > 0);
}

// Create vs edit is decided only by a persisted id, never by a prefill object's truthiness.
export const isPersisted = (record) => !!record?.id;