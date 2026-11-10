// Labor-time intent and job parsing (pure, no data access). Separates repair labor time from the
// shop's hourly labor rate and from employee timesheets. Never invents a vehicle or job.
const HOURS_RE = [
  /\b(lab(ou?|o)?r|lbr|labr)\s*(h|hr|hrs|hours?|time|times)\b/i,
  /\bbook\s*(time|hours?|hrs?)\b/i,
  /\bflat\s*rate\s*(time|hours?|hrs?)?\b/i,
  /\bhow\s+(many|much)\s+(h|hr|hrs|hours?|time)\b/i,
  /\bhow\s+long\s+(does|do|to|will|would|for|is|it)\b/i,
];
const RATE_RE = /\b(lab(ou?|o)?r|hourly|shop|my)\s*rate\b|\bper\s+hour\b|\bcharge\s+an\s+hour\b/i;
const TIMESHEET_RE = /\b(clock(ed)?(\s*(in|out))?|timesheets?|time\s*cards?|hours\s+worked|worked|payroll)\b|\bdid\s+\w+\s+work\b/i;
const GENERAL_RE = /\b[PBCU][0-9]{4}\b|\b(adjust|multiplier|rust\s*factor)\b/i; // codes / how-to stay general advice

export function laborIntent(text: string): 'repair_hours' | 'labor_rate' | 'timesheet' | null {
  const t = String(text || '');
  if (TIMESHEET_RE.test(t)) return 'timesheet';
  const hours = HOURS_RE.some((r) => r.test(t));
  if (hours && !GENERAL_RE.test(t)) return 'repair_hours';
  if (!hours && RATE_RE.test(t)) return 'labor_rate';
  return null;
}
export const mentionsRate = (t: string) => RATE_RE.test(String(t || ''));

const MAKES = ['acura', 'alfa', 'audi', 'bmw', 'buick', 'cadillac', 'chevrolet', 'chevy', 'chrysler', 'dodge', 'fiat', 'ford', 'genesis', 'gmc', 'honda', 'hyundai', 'infiniti', 'jaguar', 'jeep', 'kia', 'lexus', 'lincoln', 'mazda', 'mercedes', 'mercedes-benz', 'mini', 'mitsubishi', 'nissan', 'pontiac', 'porsche', 'ram', 'saturn', 'scion', 'subaru', 'tesla', 'toyota', 'volkswagen', 'vw', 'volvo'];
const STOP = new Set(['how', 'many', 'much', 'long', 'h', 'hr', 'hrs', 'hour', 'hours', 'labor', 'labour', 'labr', 'lbr', 'lab', 'book', 'time', 'times', 'flat', 'rate', 'for', 'to', 'on', 'a', 'an', 'the', 'do', 'does', 'it', 'take', 'is', 'what', 'whats', 's', 'of', 'my', 'this', 'that', 'in', 'at', 'with', 'and', 'please', 'check', 'checking', 'look', 'up', 'me', 'give', 'i', 'im', 'you', 'can', 'need', 'get', 'would', 'will', 'should', 'be', 'we', 'our', 'usually', 'typical', 'about', 'charge', 'charged', 'did', 'use', 'used', 'previously', 'before', 'last', 'shop', 'hi', 'hey', 'ok', 'yes', 'its', 'car', 'vehicle', 'truck', 'suv', 'engine', 'job', 'repair', 'work', 'service', 'fix', 'lbc', 'auto', 'ai', 'asking', 'ask', 'asked', 'him', 'her', 'he', 'she', 'them', 'help', 'tell', 'know', 'want', 'quote', 'roughly', 'approx', 'average', 'normally', 'there', 'thanks', 'thank']);
const VERBS = new Set(['replace', 'replacing', 'replacement', 'install', 'r&r', 'rr', 'remove', 'change', 'swap', 'do', 'doing']);
const SIDES = ['front', 'rear', 'left', 'right', 'lh', 'rh', 'driver', 'passenger', 'both', 'all', 'four', '4', 'upper', 'lower', 'inner', 'outer'];
const SIDED = /\b(brakes?|pads?|rotors?|calipers?|struts?|shocks?|bearings?|hubs?|control\s*arms?|axles?|cv|tie\s*rods?|ball\s*joints?|sway|links?|springs?)\b/i;

const words = (t: string) => String(t || '').toLowerCase().replace(/[^a-z0-9.&\- ]/g, ' ').split(/\s+/).filter(Boolean);
export const stem = (w: string) => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w);
export const tokensOf = (t: string) => new Set(words(t).map(stem));
export const SIDE_WORDS = SIDES;
export const title = (s: string) => s.replace(/\b[a-z]/g, (c) => c.toUpperCase());

export function parseVehicle(text: string) {
  const w = words(text);
  const yi = w.findIndex((x) => /^(19[6-9]\d|20[0-4]\d)$/.test(x));
  const mi = w.findIndex((x) => MAKES.includes(x));
  const disp = String(text).match(/\b(\d\.\d)\s*l?\b/i)?.[1];
  const engine = disp ? `${disp}L` : (String(text).match(/\b(v6|v8|i4|4\s*cyl|6\s*cyl|8\s*cyl)\b/i)?.[1] || '');
  const year = yi >= 0 ? w[yi] : '';
  const make = mi >= 0 ? w[mi] : '';
  const after = (i: number) => (i >= 0 && w[i + 1] && !STOP.has(w[i + 1]) && !/^\d/.test(w[i + 1]) ? w[i + 1] : '');
  const model = make ? after(mi) : (year ? after(yi) : '');
  const used = new Set([year, make, model].filter(Boolean));
  return { year, make, model, engine, used, complete: !!(year && model), label: title([year, make, model, engine].filter(Boolean).join(' ')) };
}

export function parseJob(text: string, vehicleUsed: Set<string> = new Set()) {
  const w = words(text).filter((x) => !vehicleUsed.has(x) && !/^(19|20)\d\d$/.test(x) && !/^\d\.\d/.test(x));
  const core = w.filter((x) => !STOP.has(x) && !VERBS.has(x) && !MAKES.includes(x));
  const sides = core.filter((x) => SIDES.includes(x));
  const tokens = [...new Set(core.filter((x) => !SIDES.includes(x)).map(stem))];
  const label = title(core.filter((x) => !SIDES.includes(x)).join(' '));
  const needsSide = tokens.length > 0 && SIDED.test(core.join(' ')) && !sides.length;
  return { tokens, sides, label, complete: tokens.length > 0, needsSide };
}

// Questions to ask when essentials are missing (never a guess).
export function missingQuestions(vehicle: any, job: any) {
  const q: string[] = [];
  if (!vehicle.complete) q.push(vehicle.year || vehicle.make || vehicle.model ? `Which Exact Vehicle Is It? I Have "${vehicle.label}". Give Year, Make And Model (And Engine If It Matters).` : 'Which Vehicle? Give Year, Make And Model (And Engine If It Matters).');
  if (!job.complete) q.push('Which Repair? Name The Exact Job (E.g. Front Brake Pads And Rotors, Water Pump, Timing Belt).');
  else if (job.needsSide) q.push(`Which Side Or Axle For ${job.label}? (Front, Rear, Left, Right Or Both)`);
  return q;
}