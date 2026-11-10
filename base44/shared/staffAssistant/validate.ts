// Minimal schema validation for model-proposed tool arguments. Unknown keys are dropped; a bad value
// is an error (never coerced into something the staff member did not ask for).
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const clean = (s: string) => s.replace(/[\u0000-\u001f<>`]/g, ' ').replace(/\s+/g, ' ').trim();

export type Spec = Record<string, { type: 'string' | 'number' | 'int' | 'boolean' | 'date' | 'id' | 'enum' | 'lines'; max?: number; min?: number; values?: string[]; required?: boolean; desc?: string }>;

export function validateArgs(spec: Spec, raw: any) {
  const args: any = {};
  const errors: string[] = [];
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  for (const [key, s] of Object.entries(spec)) {
    let v = src[key];
    if (v === undefined || v === null || v === '') { if (s.required) errors.push(`${key} is required`); continue; }
    if (s.type === 'string' || s.type === 'id') {
      if (typeof v !== 'string' && typeof v !== 'number') { errors.push(`${key} must be text`); continue; }
      v = clean(String(v)).slice(0, s.type === 'id' ? 64 : (s.max || 120));
      if (s.type === 'id' && !/^[A-Za-z0-9_-]+$/.test(v)) { errors.push(`${key} is not a valid id`); continue; }
    } else if (s.type === 'number' || s.type === 'int') {
      v = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
      if (typeof v !== 'number' || !Number.isFinite(v) || (s.type === 'int' && !Number.isInteger(v))) { errors.push(`${key} must be a number`); continue; }
      if ((s.min != null && v < s.min) || (s.max != null && v > s.max)) { errors.push(`${key} is out of range`); continue; }
    } else if (s.type === 'boolean') {
      if (typeof v !== 'boolean') { errors.push(`${key} must be true or false`); continue; }
    } else if (s.type === 'date') {
      if (typeof v !== 'string' || !DATE.test(v) || Number.isNaN(Date.parse(v + 'T00:00:00Z'))) { errors.push(`${key} must be YYYY-MM-DD`); continue; }
    } else if (s.type === 'enum') {
      v = String(v).toLowerCase();
      if (!s.values!.includes(v)) { errors.push(`${key} must be one of ${s.values!.join(', ')}`); continue; }
    } else if (s.type === 'lines') {
      if (!Array.isArray(v) || v.length > (s.max || 20)) { errors.push(`${key} must be a list of at most ${s.max || 20} lines`); continue; }
      v = v.map((l: any) => ({
        type: l?.type === 'labor' ? 'labor' : l?.type === 'part' ? 'part' : null,
        name: clean(String(l?.name ?? '')).slice(0, 80),
        quantity: typeof l?.quantity === 'number' && Number.isFinite(l.quantity) ? l.quantity : null,
        unit_price: typeof l?.unit_price === 'number' && Number.isFinite(l.unit_price) ? l.unit_price : null,
      }));
      if (v.some((l: any) => !l.type || !l.name)) { errors.push(`${key}: every line needs a type (part or labor) and a name`); continue; }
    }
    args[key] = v;
  }
  return { args, errors };
}

export const specText = (spec: Spec) => Object.entries(spec).map(([k, s]) => `${k}${s.required ? '*' : ''}: ${s.type === 'enum' ? s.values!.join('|') : s.type}${s.desc ? ` (${s.desc})` : ''}`).join(', ');

// A number counts as staff-provided only if it literally appears in the staff member's own messages.
export function mentioned(n: any, text: string) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return false;
  const nums = (String(text).replace(/,/g, '').match(/\d+(?:\.\d+)?/g) || []).map(Number);
  return nums.some((x) => Math.abs(x - n) < 1e-9);
}
export const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const textQuery = (fields: string[], q: string) => ({ $or: fields.map((f) => ({ [f]: { $regex: esc(q.slice(0, 60)), $options: 'i' } })) });