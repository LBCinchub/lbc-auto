// Read-only, tenant-scoped lookup of hours this shop previously billed for a job. Hours come only
// from stored labor hours, or from an invoice labor line whose quantity x verified shop rate = its
// total with no discount. A price alone is never turned into hours.
import { ownedScan, stampedOwned } from './scope.ts';
import { textQuery } from './validate.ts';
import { stem, tokensOf, SIDE_WORDS } from './laborTime.ts';

const SCAN = { pages: 1, size: 150 }; // newest 150 of each document type
const SOURCES = [
  { entity: 'Estimate', num: 'estimate_number', label: 'Estimate', date: 'estimate_date', path: '/EstimateDetail/' },
  { entity: 'RepairOrder', num: 'order_number', label: 'Repair Order', date: '', path: '/RepairOrderDetail/' },
  { entity: 'Invoice', num: 'invoice_number', label: 'Invoice', date: 'invoice_date', path: '/InvoiceDetail/' },
];
const r2 = (n: number) => Math.round(n * 100) / 100;

export function laborLines(entity: string, rec: any, rate: number | null) {
  if (entity === 'Invoice') {
    const discounted = Number(rec.discount) > 0;
    return (rec.line_items || []).filter((l: any) => l?.type === 'labor').map((l: any) => {
      const q = Number(l.quantity), p = Number(l.unit_price), t = Number(l.total);
      const verified = !discounted && rate != null && q > 0 && Math.abs(p - rate) < 0.01 && Math.abs(q * p - t) < 0.02;
      return { name: [l.name, l.description].filter(Boolean).join(' - '), hours: verified ? q : null };
    });
  }
  return (rec.labor_items || []).map((l: any) => ({ name: [l.description, l.details].filter(Boolean).join(' - '), hours: Number(l.hours) > 0 ? Number(l.hours) : null }));
}

export function classify(job: any, vehicle: any, lineName: string, vehicleInfo: string) {
  const t = tokensOf(lineName);
  const hit = job.tokens.filter((x: string) => t.has(x)).length / job.tokens.length;
  const lineSides = SIDE_WORDS.filter((s) => t.has(s));
  const sideOk = !job.sides.length || job.sides.some((s: string) => lineSides.includes(s));
  const v = tokensOf(vehicleInfo);
  const sameModel = !!vehicle.model && v.has(stem(vehicle.model));
  const sameYear = !!vehicle.year && v.has(vehicle.year);
  if (hit === 1 && sideOk && sameModel && sameYear) return 'exact';
  if (hit === 1 || (hit >= 0.5 && sameModel)) return 'comparable';
  return null;
}

export async function laborHistory(ctx: any, vehicle: any, job: any) {
  const scans = await Promise.all(SOURCES.map((s) => ownedScan(ctx.svc, s.entity, ctx.scope, {}, SCAN)));
  const items: any[] = [];
  let withoutHours = 0, checked = 0, partial = false;
  scans.forEach((s: any, i: number) => {
    const src = SOURCES[i];
    partial = partial || s.partial;
    checked += s.rows.length;
    for (const rec of s.rows) for (const line of laborLines(src.entity, rec, ctx.scope.laborRate)) {
      const kind = classify(job, vehicle, line.name, rec.vehicle_info || '');
      if (!kind) continue;
      if (line.hours == null) { withoutHours++; continue; }
      items.push({ kind, hours: r2(line.hours), source: src.label, number: rec[src.num] || '', date: String((src.date && rec[src.date]) || rec.created_date || '').slice(0, 10),
        vehicle: String(rec.vehicle_info || '').slice(0, 60), line: line.name.slice(0, 80), open_path: src.path + rec.id });
    }
  });
  items.sort((a, b) => (a.kind === b.kind ? b.date.localeCompare(a.date) : a.kind === 'exact' ? -1 : 1));
  return { status: items.length ? 'ok' : 'no_results', items: items.slice(0, 5), total_matches: items.length, lines_without_hours: withoutHours, records_checked: checked, partial };
}

// Price Library stores last prices only; reported so staff know a price exists but has no hours.
export async function priceLibraryHits(ctx: any, job: any) {
  const key = [...job.tokens].sort((a: string, b: string) => b.length - a.length)[0];
  if (!key) return 0;
  const rows = await ctx.svc.LineItemLibrary.filter({ shop_owner_email: ctx.scope.tenant, type: 'labor', ...textQuery(['item_name'], key) }, '-times_used', 5);
  return rows.filter((r: any) => stampedOwned(r, ctx.scope)).length;
}