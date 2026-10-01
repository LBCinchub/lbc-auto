// Canonical saved-estimate service — STAGED SOURCE. Not imported by any deployed function.
// It saves only when every injected adapter is a verified, configured implementation.
// Platform facts (docs.base44.com, Entity Schemas): entities have NO unique constraints and
// read-then-create "narrows the window for duplicates but doesn't close it". So the claim/number
// adapter must be an atomic store; none is configured here, and this module never substitutes one.
import { validateProposal, verifiedReceipt, receiptCopyText, EstimateError } from './staffEstimateCore.ts';

const r2 = (v: number) => Math.round(v * 100) / 100;

export const SERVICE_BLOCKERS = {
  membership: 'Shop membership is unverified: no ShopMembership schema is applied and no verified owner memberships are enrolled',
  claims: 'No atomic claim and numbering store is configured (platform entities have no unique constraint or atomic create)',
  writer: 'No server estimate writer is bound to the verified shop owner',
  deployment: 'The staff AI function has not been deployed with this service',
};

// PROPOSED schema — source only. NOT applied to base44/entities. Locked: server role only.
export const PROPOSED_SHOP_MEMBERSHIP_SCHEMA = {
  name: 'ShopMembership', type: 'object',
  properties: {
    shop_id: { type: 'string' }, owner_user_id: { type: 'string' }, owner_email: { type: 'string', format: 'email' },
    member_user_id: { type: 'string' }, role: { type: 'string', enum: ['owner', 'estimator'] },
    status: { type: 'string', enum: ['pending', 'verified', 'revoked'], default: 'pending' },
    verified_by: { type: 'string' }, verified_at: { type: 'string', format: 'date-time' },
    verification_evidence: { type: 'string', description: 'e.g. Stripe customer/subscription id matched to owner' },
  },
  required: ['shop_id', 'owner_user_id', 'owner_email', 'member_user_id', 'role', 'status'],
  rls: Object.fromEntries(['read', 'create', 'update', 'delete'].map((op) => [op, { user_condition: { role: 'shop_membership_service' } }])),
};

/* Adapter contracts
 membership: { verified: true, resolve(userId) => { shop_id, owner_user_id, owner_email, role, status, tax_rate, tax_applies_to } | null }
 claims:     { atomic: true,
               claim({ key, payload_hash }) => { state: 'acquired', number, token }      // new key, or expired lease taken over
                                             | { state: 'in_progress' }                 // live lease held by another request
                                             | { state: 'committed', estimate_id, number }
                                             | { state: 'conflict' },                   // same key, different payload
               commit({ key, token, estimate_id }) }                                    // numbers are per-shop sequential, never reused
 writer:     { create(record) => { id }, get(id), findByNumber(number) }                // owner-bound session; RLS unchanged
 auditor:    { record(event) }                                                          // optional; failure never undoes a save */
export function capability(deps: any) {
  const reasons: string[] = [];
  if (deps?.membership?.verified !== true) reasons.push(SERVICE_BLOCKERS.membership);
  if (deps?.claims?.atomic !== true) reasons.push(SERVICE_BLOCKERS.claims);
  if (!deps?.writer) reasons.push(SERVICE_BLOCKERS.writer);
  return { available: reasons.length === 0, reasons };
}

async function sha256(s: string) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

// Server-side totals: same rules as the manual editor (qty>0 lines only, tax_applies_to), no discount.
export function computeTotals(lines: any[], tax: { rate: number; applies_to: string }) {
  const live = lines.filter((l) => l.quantity > 0);
  const sum = (f: (l: any) => boolean) => live.filter(f).reduce((s, l) => s + r2(l.quantity * l.unit_price), 0);
  const labor = sum((l) => l.type === 'labor');
  const parts = sum((l) => l.type !== 'labor');
  const taxable = tax.applies_to === 'none' ? 0 : tax.applies_to === 'labor' ? labor : tax.applies_to === 'parts' ? parts : labor + parts;
  const taxAmount = r2((taxable * tax.rate) / 100);
  return { labor_total: r2(labor), parts_total: r2(parts), tax_amount: taxAmount, grand_total: r2(labor + parts + taxAmount) };
}

export async function saveStaffEstimate({ deps, user, latestMessage, proposal, staffPrices, requestId, today }: any) {
  const cap = capability(deps);
  if (!cap.available) return { status: 'unavailable', created: false, reasons: cap.reasons };
  if (!user?.id) throw new EstimateError('unauthorized', 'Sign in required', 401);
  const m = await deps.membership.resolve(user.id);
  // Estimator role needs a shop field on Estimate to keep owner visibility under current RLS; owner only for now.
  if (!m || m.status !== 'verified' || m.role !== 'owner' || m.owner_user_id !== user.id) throw new EstimateError('forbidden', 'Not a verified owner of this shop', 403);
  if (typeof requestId !== 'string' || requestId.length < 16) throw new EstimateError('invalid', 'A request id is required');
  const shopUser = { id: m.owner_user_id, email: m.owner_email, tax_rate: m.tax_rate, tax_applies_to: m.tax_applies_to };
  const v: any = await validateProposal({ svc: deps.svc, user: shopUser, latestMessage, intentStore: deps.intentStore, proposal, staffPrices });
  if (v.status !== 'ready_but_disabled') return { ...v, created: false };
  const { customer_id, vehicle_id, lines, tax } = v.resolved;
  const [customer, vehicle] = await Promise.all([deps.svc.Customer.get(customer_id), deps.svc.Vehicle.get(vehicle_id)]);
  const totals = computeTotals(lines, tax);
  const record = {
    customer_id, vehicle_id, customer_name: customer.full_name || '',
    vehicle_info: [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' '),
    service_reason: String(proposal.job || '').slice(0, 200),
    labor_items: lines.filter((l: any) => l.type === 'labor').map((l: any) => ({ description: l.name, details: '', hours: l.quantity, rate: l.unit_price, total: r2(l.quantity * l.unit_price) })),
    parts_items: lines.filter((l: any) => l.type === 'part').map((l: any) => ({ name: l.name, details: '', part_number: '', quantity: l.quantity, unit_price: l.unit_price, total: r2(l.quantity * l.unit_price) })),
    ...totals, tax_rate: tax.rate, tax_applies_to: tax.applies_to, discount: 0, discount_type: '$',
    estimate_date: today || new Date().toISOString().slice(0, 10), status: 'draft', auth_status: 'none', amount_paid: 0,
  };
  const key = await sha256(`${user.id}|${m.shop_id}|${requestId}`);
  const payload_hash = await sha256(JSON.stringify({ shop: m.shop_id, actor: user.id, record: { ...record, estimate_date: undefined } }));
  const c = await deps.claims.claim({ key, payload_hash });
  if (c.state === 'conflict') throw new EstimateError('conflict', 'This request id was already used for a different estimate', 409);
  if (c.state === 'in_progress') return { status: 'in_progress', created: false };
  let saved: any;
  if (c.state === 'committed') saved = await deps.writer.get(c.estimate_id);
  else {
    saved = await deps.writer.findByNumber(c.number); // recovery after an uncertain earlier commit
    if (saved && saved.grand_total !== record.grand_total) throw new EstimateError('conflict', 'Recovered estimate does not match this request', 409);
    if (!saved) { const created = await deps.writer.create({ ...record, estimate_number: c.number }); saved = await deps.writer.get(created?.id); }
  }
  const receipt = verifiedReceipt(saved, saved?.id, shopUser);
  if (!receipt) throw new EstimateError('save_unconfirmed', 'The estimate save could not be confirmed; retry with the same request id', 503);
  if (c.state === 'acquired') await deps.claims.commit({ key, token: c.token, estimate_id: saved.id });
  let audit = 'skipped';
  if (deps.auditor) { try { await deps.auditor.record({ action: 'create', estimate_id: saved.id, actor: user.id, shop_id: m.shop_id, key }); audit = 'recorded'; } catch (_) { audit = 'pending'; } }
  return { status: 'created', created: true, replay: c.state === 'committed', receipt, copy_text: receiptCopyText(receipt), audit };
}