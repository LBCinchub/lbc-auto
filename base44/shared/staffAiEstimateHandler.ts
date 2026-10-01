// Typed staff-AI estimate capabilities — STAGED SOURCE. Activation = lbcAutoAI importing this
// and returning { estimate_capability } next to { reply } (that edit deploys, so it is not made).
import { loadEvidence, resolveIntent, resolveStaffContext, EstimateError } from './staffEstimateCore.ts';
import { saveStaffEstimate, capability } from './staffEstimateService.ts';

const $ = (n: number) => `$${n.toFixed(2)}`;

export function evidencePoints(ev: any) {
  if (ev.no_history) return ['No eligible same-shop invoice or service history matches this job. A price is needed — none was invented.'];
  const pts = ev.history.map((h: any) => `${h.ref || 'Record'} (${h.match}${h.date ? `, ${h.date}` : ''}${h.old ? ', over 2 years old' : ''}): ${h.name} — ${h.type === 'labor' ? `${h.quantity} hr` : `x${h.quantity}`} @ ${$(h.unit_price)}`);
  if (ev.truncated) pts.push('History is long; only the most recent records were checked.');
  if (!ev.tax.verified) pts.push('Shop tax settings are missing; tax will not be guessed.');
  return pts;
}

export async function handleStaffEstimateTurn({ deps, user, body }: any) {
  const cap = capability(deps);
  const out = (kind: string, points: string[], extra = {}) => ({ capability: { available: cap.available, reasons: cap.reasons }, kind, points, ...extra });
  try {
    const ctx = resolveStaffContext(user);
    const intent = await resolveIntent({ intentStore: deps?.intentStore, ctx, latestMessage: body?.message });
    if (intent !== 'create') {
      if (!body?.customer_id || !body?.vehicle_id) return out('read_only', []);
      const ev = await loadEvidence({ svc: deps.svc, user, customerId: body.customer_id, vehicleId: body.vehicle_id, job: body.job || body.message });
      return out('evidence', evidencePoints(ev));
    }
    if (!cap.available) return out('unavailable', ['Estimate creation is unavailable. Nothing was saved.', ...cap.reasons]);
    const r: any = await saveStaffEstimate({ deps, user, latestMessage: body.message, proposal: body.proposal, staffPrices: body.staff_prices, requestId: body.request_id });
    if (r.status === 'created') return out('created', [`Saved estimate ${r.receipt.estimate_number}.`, `Total ${$(r.receipt.total)} including tax ${$(r.receipt.tax)}.`], { receipt: r.receipt, copy_text: r.copy_text });
    if (r.status === 'missing_details') return out('missing_details', r.missing.map((x: string) => `Need: ${x}`));
    if (r.status === 'invalid') return out('invalid', [...r.errors]);
    if (r.status === 'in_progress') return out('in_progress', ['This estimate is already being saved. Nothing new was created.']);
    if (r.status === 'unavailable') return out('unavailable', ['Estimate creation is unavailable. Nothing was saved.', ...r.reasons]);
    return out('read_only', []);
  } catch (e: any) {
    if (e instanceof EstimateError) return out('error', [e.message], { status: e.status });
    throw e;
  }
}