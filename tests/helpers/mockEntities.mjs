// In-memory entity store with NON-unique creates and async yields between calls, so racing
// requests interleave. updateMany({ id, cond }) is applied atomically (as the platform documents
// for single-id conditional updates). `failOn` injects crashes after a given write.
const tick = () => new Promise((r) => setTimeout(r, Math.random() * 3));
const match = (rec, q) => Object.entries(q).every(([k, v]) => {
  if (v && typeof v === "object" && !Array.isArray(v)) {
    if ("$exists" in v) return v.$exists ? rec[k] !== undefined : rec[k] === undefined;
    if ("$lt" in v) return rec[k] !== undefined && rec[k] < v.$lt;
  }
  return rec[k] === v;
});

export function makeStore(seed = {}, { failOn } = {}) {
  const tables = {};
  let n = 0;
  const table = (name) => (tables[name] ||= []);
  for (const [name, rows] of Object.entries(seed)) table(name).push(...rows.map((r) => ({ ...r })));
  const crash = (op, name) => { if (failOn && failOn(op, name)) throw new Error(`simulated crash after ${op} ${name}`); };
  const api = (name) => ({
    async get(id) { await tick(); const r = table(name).find((x) => x.id === id); if (!r) throw new Error(`${name} not found`); return { ...r }; },
    async filter(q) { await tick(); return table(name).filter((r) => match(r, q)).map((r) => ({ ...r })); },
    async create(data) { await tick(); const rec = { id: `${name}_${++n}`, created_by_id: "userA", ...data }; table(name).push(rec); crash("create", name); return { ...rec }; },
    async update(id, data) { await tick(); const r = table(name).find((x) => x.id === id); Object.assign(r, data); crash("update", name); return { ...r }; },
    async updateMany(q, { $set }) { await tick(); const rows = table(name).filter((r) => match(r, q)); rows.forEach((r) => Object.assign(r, $set)); return { updated: rows.length }; },
  });
  const entities = new Proxy({}, { get: (_, name) => api(name) });
  return { entities, tables };
}