// Recipient-aware disclosure policy. Applied on the SERVER to every tool result BEFORE it reaches
// the model or the browser. Prompt wording is never relied on for access control.
export const ROLES = ['owner', 'staff', 'technician'] as const;
export const FINANCE = ['owner', 'staff'];
export const OWNER = ['owner'];
export const ALL_STAFF = [...ROLES];

// Never disclosed on any surface, to any role: credentials, tokens, PINs, signatures, private file
// links, internal costs/margins, leases, tenant keys and private customer note logs.
const NEVER = new Set(['cost_price', 'notes_log', 'pin', 'auth_token', 'token', 'token_hash', 'api_key', 'credential_hash', 'encrypted_secret_key',
  'passcode_hash', 'salt', 'media_token_hash', 'customer_signature', 'photo_base64', 'photo_url', 'photo_uri', 'financial_lease_owner',
  'financial_lease_until', 'shop_owner_email', 'shop_email', 'created_by_id', 'created_by', 'margin']);

// Field-level limits per staff role (payroll and pay rates are owner-only; technicians see no money).
const ROLE_HIDE: Record<string, Set<string>> = {
  owner: new Set(),
  staff: new Set(['hourly_rate', 'daily_rate', 'pay_type']),
  technician: new Set(['hourly_rate', 'daily_rate', 'pay_type', 'total', 'amount_paid', 'balance_due', 'grand_total', 'total_cost', 'unit_price', 'rate',
    'last_unit_price', 'sale_price', 'payment_history', 'open_balance', 'invoiced_total', 'collected_amount_paid', 'expenses', 'total_paid', 'amount',
    'price_estimate', 'estimated_cost', 'tax_amount']),
};

export const rolesFor = (cap: any) => cap.roles || (cap.kind && cap.kind !== 'read' ? OWNER : ALL_STAFF);
export const roleAllows = (role: string, cap: any) => rolesFor(cap).includes(role);

function strip(v: any, hide: Set<string>): any {
  if (Array.isArray(v)) return v.map((x) => strip(x, hide));
  if (!v || typeof v !== 'object') return v;
  const out: any = {};
  for (const [k, x] of Object.entries(v)) if (!NEVER.has(k) && !hide.has(k)) out[k] = strip(x, hide);
  return out;
}
export function enforceStaffDisclosure(role: string, result: any) {
  const hide = ROLE_HIDE[role];
  if (!hide) return { status: 'forbidden', message: 'Your role is not recognised, so nothing was shown.' };
  return strip(result, hide);
}

// ── Customer surface: a verified customer session sees ONLY its own documents, customer-visible
// pricing and receipts. No internal notes, technician notes, ghost/split math, discount rules or costs.
const r2 = (n: any) => Math.round((Number(n) || 0) * 100) / 100;
export function customerCanSee(doc: any, session: any) {
  const stamp = String(doc?.shop_owner_email || doc?.shop_email || '').toLowerCase();
  return !!doc && !!session?.customer_id && doc.customer_id === session.customer_id && (!stamp || stamp === String(session.shop_owner_email || '').toLowerCase());
}
export function customerSafeDocument(doc: any, session: any) {
  if (!customerCanSee(doc, session)) return null;
  const lines = [...(doc.line_items || []), ...(doc.parts_items || []), ...(doc.labor_items || [])].slice(0, 40)
    .map((l: any) => ({ name: l.name || l.description, quantity: l.quantity ?? l.hours, unit_price: l.unit_price ?? l.rate, total: r2(l.total) }));
  return {
    number: doc.invoice_number || doc.estimate_number || doc.order_number, status: doc.status, vehicle_info: doc.vehicle_info,
    date: doc.invoice_date || doc.estimate_date || doc.created_date, lines, tax_amount: r2(doc.tax_amount),
    total: r2(doc.total ?? doc.grand_total ?? doc.total_cost), amount_paid: r2(doc.amount_paid),
    receipts: (doc.payment_history || []).slice(0, 20).map((p: any) => ({ date: p.date, amount: r2(p.amount), method: p.method })),
  };
}

// ── Public / website surface: only explicitly public shop facts. Name or phone typed by a visitor
// is never authentication, so no customer, vehicle, document or appointment data is ever included.
export const PUBLIC_FACT_FIELDS = ['name', 'phone', 'address', 'services', 'public_pricing'];
export const publicFacts = (f: any) => Object.fromEntries(PUBLIC_FACT_FIELDS.filter((k) => f?.[k] !== undefined && f[k] !== '').map((k) => [k, f[k]]));