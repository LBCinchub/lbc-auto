// In-memory entity store with the query operators the staff assistant uses.
const match = (row, q) => Object.entries(q || {}).every(([k, cond]) => {
  if (k === '$or') return cond.some((c) => match(row, c));
  const v = row[k];
  if (cond === null) return v === null || v === undefined;
  if (cond && typeof cond === 'object' && !Array.isArray(cond)) {
    return Object.entries(cond).every(([op, x]) => {
      if (op === '$in') return x.includes(v);
      if (op === '$ne') return v !== x;
      if (op === '$gte') return v != null && v >= x;
      if (op === '$lte') return v != null && v <= x;
      if (op === '$lt') return v != null && v < x;
      if (op === '$gt') return v != null && v > x;
      if (op === '$regex') return v != null && new RegExp(x, cond.$options || '').test(String(v));
      if (op === '$options') return true;
      throw new Error('unsupported op ' + op);
    });
  }
  return v === cond;
});

export function createStore() {
  const tables = {};
  let seq = 0, tick = 0;
  const stamp = () => new Date(Date.UTC(2026, 10, 10, 12, 0, tick++)).toISOString();
  const table = (name) => (tables[name] ||= []);
  const entity = (name, by, fail) => ({
    async get(id) { if (fail?.[name]) throw new Error('down'); const r = table(name).find((x) => x.id === id); if (!r) throw new Error('404'); return structuredClone(r); },
    async filter(q, sort, limit = 50, skip = 0) {
      if (fail?.[name]) throw new Error('down');
      return table(name).filter((r) => match(r, q)).slice(skip, skip + limit).map((r) => structuredClone(r));
    },
    async create(data) { const t = stamp(); const r = { ...structuredClone(data), id: `${name}_${++seq}`, created_by_id: by, created_date: t, updated_date: t }; table(name).push(r); return structuredClone(r); },
    async update(id, data) { const r = table(name).find((x) => x.id === id); Object.assign(r, structuredClone(data), { updated_date: stamp() }); return structuredClone(r); },
    async updateMany(q, { $set }) { const rows = table(name).filter((r) => match(r, q)); rows.forEach((r) => Object.assign(r, $set, { updated_date: stamp() })); return { updated: rows.length }; },
  });
  const client = (by, fail) => new Proxy({}, { get: (_, name) => entity(name, by, fail) });
  return { tables, client, seed: (name, by, data) => client(by).create ? entity(name, by).create(data) : null };
}