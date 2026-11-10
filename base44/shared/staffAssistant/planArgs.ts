// Planner reply contract. Verified against the live structured-output model (2026-11-10):
// - args {type:'object'} with no properties came back as {} every time, dropping the search text;
// - an args object declaring every field came back with EVERY field filled (type "part", quantity 0,
//   status "scheduled"), indistinguishable from real values;
// - a list of {key, value} pairs came back with only the keys the staff actually stated.
// So args are pairs; estimate lines are a separate list with text numbers ("" = not stated).
// The schema only shapes the reply. Tool names and keys are allowlists; validateArgs still decides.
const LINE = { type: 'object', properties: { type: { type: 'string', enum: ['part', 'labor'] }, name: { type: 'string' }, quantity: { type: 'string' }, unit_price: { type: 'string' } }, required: ['type', 'name'] };

export function planSchema(caps: any[]) {
  const keys = [...new Set(caps.flatMap((c) => Object.keys(c.args || {}).filter((k) => c.args[k].type !== 'lines')))];
  const args = { type: 'array', items: { type: 'object', properties: { key: { type: 'string', enum: keys }, value: { type: 'string' } }, required: ['key', 'value'] } };
  return {
    type: 'object',
    properties: {
      calls: { type: 'array', items: { type: 'object', properties: { name: { type: 'string', enum: caps.map((c) => c.name) }, args, lines: { type: 'array', items: LINE } }, required: ['name', 'args'] } },
      unsupported: { type: 'string', enum: ['none', 'payments', 'delete', 'messaging', 'conversion'] },
    },
    required: ['calls', 'unsupported'],
  };
}

const num = (v: any) => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : null);
const blank = (v: any) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');

// Model call -> plain args for validateArgs. Only keys in the tool's own spec survive; blanks are
// "not stated". Also accepts a plain args object (older shape) so nothing depends on one format.
export function callArgs(spec: any, call: any) {
  const src: any = {};
  const raw = call?.args;
  const pairs = Array.isArray(raw) ? raw.map((p: any) => [p?.key, p?.value]) : raw && typeof raw === 'object' ? Object.entries(raw) : [];
  for (const [k, v] of pairs) {
    if (typeof k !== 'string' || !Object.prototype.hasOwnProperty.call(spec, k) || k in src || blank(v)) continue;
    const t = spec[k].type;
    if (t === 'boolean') { const s = String(v).toLowerCase(); if (s === 'true' || s === 'false') src[k] = s === 'true'; else src[k] = v; continue; }
    if (t === 'lines') continue;
    src[k] = v;
  }
  const linesKey = Object.keys(spec).find((k) => spec[k].type === 'lines');
  const lines = Array.isArray(call?.lines) && call.lines.length ? call.lines : linesKey && Array.isArray(raw?.[linesKey]) && raw[linesKey].length ? raw[linesKey] : null;
  if (linesKey && lines) src[linesKey] = lines.map((l: any) => ({ type: l?.type, name: l?.name, quantity: num(l?.quantity), unit_price: num(l?.unit_price) }));
  return src;
}