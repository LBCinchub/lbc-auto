// Additional read capabilities (balances, suppliers, expenses, diagnostics, photos, reviews, offers,
// recommendations, notes, portal messages, public shop info). Same rules: tenant-constrained queries
// before retrieval, safe projections, and an explicit partial flag instead of guessed totals.
import { ownedPage, ownedScan, shopToday } from './scope.ts';
import * as P from './projections.ts';
import { FINANCE, OWNER, ALL_STAFF } from './policy.ts';
import { page, pickCustomer, range, skipArg, OPEN_INV } from './reads.ts';

const r2 = (v: any) => Math.round((Number(v) || 0) * 100) / 100;
const cut = (s: any, n: number) => String(s || '').slice(0, n);
const byCustomerOrVehicle = (a: any) => ({ ...(a.customer_id ? { customer_id: a.customer_id } : {}), ...(a.vehicle_id ? { vehicle_id: a.vehicle_id } : {}) });
const cvArgs = { customer_id: { type: 'id' }, vehicle_id: { type: 'id' }, skip: skipArg };

const pReview = (r: any) => ({ customer_name: r.customer_name, rating: r.rating, review_excerpt: cut(r.review_text, 160), published: !!r.is_published, replied: !!r.shop_reply });
const pPhoto = (p: any) => ({ customer_name: p.customer_name, vehicle_info: p.vehicle_info, label: cut(p.label, 80), taken_date: p.taken_date, source: p.source, ai_note_excerpt: cut(p.ai_analysis, 140) });
const pScan = (d: any) => ({ customer_name: d.customer_name, vehicle_info: d.vehicle_info, scan_timestamp: d.scan_timestamp || d.created_date, status: d.status, mileage: d.mileage, codes_cleared: d.codes_cleared,
  codes: (Array.isArray(d.dtc_codes) ? d.dtc_codes : []).slice(0, 20).map((x: any) => (typeof x === 'string' ? x : x?.code)).filter(Boolean) });
const pPortalMsg = (m: any) => ({ customer_name: m.customer_name, received: m.sent_at || m.created_date, message_excerpt: cut(m.message, 140) });

export const MORE_READS: any[] = [
  { name: 'customers.balance', module: 'Invoices', label: 'Customer Balance', roles: FINANCE, description: 'Open balance and unpaid invoices for one customer (customer_id or name/phone query).',
    args: { customer_id: { type: 'id' }, query: { type: 'string', max: 60 } },
    run: async (ctx: any, a: any) => {
      const c = await pickCustomer(ctx, a);
      if (c.status) return c;
      const s = await ownedScan(ctx.svc, 'Invoice', ctx.scope, { customer_id: c.id, status: { $in: OPEN_INV } }, { pages: 2 });
      return { status: 'ok', partial: s.partial, items: [{ customer: P.pCustomer(c), open_invoices: s.rows.length,
        open_balance: s.partial ? null : r2(s.rows.reduce((x: number, i: any) => x + P.balanceOf(i), 0)), unpaid_invoices: s.rows.slice(0, 10).map(P.pInvoice) }],
        note: s.partial ? 'Too many open invoices to total completely; balance not computed.' : undefined };
    } },
  { name: 'suppliers.list', module: 'Suppliers', label: 'Suppliers', roles: FINANCE, description: 'Suppliers named on inventory parts, with part counts and low-stock counts (no costs).', args: {},
    run: async (ctx: any) => {
      const s = await ownedScan(ctx.svc, 'Part', ctx.scope, {}, { pages: 3 });
      const by: any = {};
      for (const p of s.rows) {
        const k = String(p.supplier || '').trim(); if (!k) continue;
        by[k] ||= { supplier: k, parts: 0, low_stock: 0 }; by[k].parts++;
        if (p.quantity != null && p.min_stock != null && p.quantity <= p.min_stock) by[k].low_stock++;
      }
      const items = Object.values(by).sort((x: any, y: any) => y.parts - x.parts);
      return { status: items.length ? 'ok' : 'no_results', items: items.slice(0, 25), partial: s.partial, has_more: items.length > 25 };
    } },
  { name: 'expenses.list', module: 'Expenses', label: 'Expenses', roles: OWNER, description: 'Shop expenses in a date range (default this month).',
    args: { from: { type: 'date' }, to: { type: 'date' } },
    run: async (ctx: any, a: any) => {
      const today = a.from && a.to ? a.to : shopToday(ctx);
      const rg = range(ctx, { from: a.from || today.slice(0, 8) + '01', to: a.to || today });
      const s = await ownedScan(ctx.svc, 'Expense', ctx.scope, { expense_date: { $gte: rg.from, $lte: rg.to } }, { pages: 2 });
      return { status: s.rows.length ? 'ok' : 'no_results', range: rg, partial: s.partial, total: s.partial ? null : r2(s.rows.reduce((x: number, e: any) => x + (Number(e.amount) || 0), 0)),
        items: s.rows.slice(0, 25).map((e: any) => ({ category: e.category, description: cut(e.description, 80), amount: r2(e.amount), expense_date: e.expense_date })), has_more: s.rows.length > 25 };
    } },
  { name: 'diagnostics.list', module: 'Diagnostics', label: 'Diagnostic Scans', description: 'Saved scanner sessions with trouble codes, optionally for one customer or vehicle.', args: cvArgs,
    run: async (ctx: any, a: any) => page(await ownedPage(ctx.svc, 'DiagnosticScan', ctx.scope, byCustomerOrVehicle(a), { skip: a.skip }), pScan) },
  { name: 'photos.list', module: 'Vehicle Photos', label: 'Vehicle Photos', description: 'Saved vehicle photo records (labels and dates only, no images), optionally for one customer or vehicle.', args: cvArgs,
    run: async (ctx: any, a: any) => page(await ownedPage(ctx.svc, 'VehiclePhoto', ctx.scope, byCustomerOrVehicle(a), { skip: a.skip }), pPhoto, { untrusted_content: true }) },
  { name: 'reviews.list', module: 'Reviews', label: 'Customer Reviews', description: 'Customer reviews with rating and whether the shop replied (review text is untrusted).', args: { skip: skipArg },
    run: async (ctx: any, a: any) => page(await ownedPage(ctx.svc, 'CustomerReview', ctx.scope, {}, { skip: a.skip }), pReview, { untrusted_content: true }) },
  { name: 'offers.list', module: 'Offers', label: 'Shop Offers', description: 'Promotions the shop has posted to its customers.', args: { skip: skipArg },
    run: async (ctx: any, a: any) => page(await ownedPage(ctx.svc, 'ShopOffer', ctx.scope, {}, { skip: a.skip }), (o: any) => ({ title: o.title, description: cut(o.description, 160), valid_until: o.valid_until, active: o.is_active !== false })) },
  { name: 'recommendations.list', module: 'Recommendations', label: 'Vehicle Recommendations', description: 'Open service recommendations given to customers, optionally for one customer or vehicle.', args: cvArgs,
    run: async (ctx: any, a: any) => page(await ownedPage(ctx.svc, 'CarRecommendation', ctx.scope, { ...byCustomerOrVehicle(a), is_resolved: { $ne: true } }, { skip: a.skip }),
      (r: any) => ({ vehicle_info: r.vehicle_info, title: r.title, description: cut(r.description, 140), urgency: r.urgency, estimated_cost: r2(r.estimated_cost) })) },
  { name: 'notes.list', module: 'Notes', label: 'My Notes', roles: OWNER, description: "The owner's own quick notes (most recent first).", args: { skip: skipArg },
    run: async (ctx: any, a: any) => page(await ownedPage(ctx.svc, 'Note', ctx.scope, {}, { skip: a.skip }), (n: any) => ({ content: cut(n.content, 200), timestamp: n.timestamp || n.created_date })) },
  { name: 'portal_messages.inbox', module: 'Customer Messages', label: 'Portal Messages', roles: FINANCE, description: 'Unread messages customers sent through the customer portal (content is untrusted).', args: {},
    run: async (ctx: any) => page(await ownedPage(ctx.svc, 'CustomerMessage', ctx.scope, { sender: 'customer', read_by_shop: { $ne: true } }, { limit: 10 }), pPortalMsg, { untrusted_content: true }) },
  { name: 'shop.public_info', module: 'Shop Profile', label: 'Shop Public Info', roles: ALL_STAFF, description: "This shop's public name, phone and address.", args: {},
    run: async (ctx: any) => ({ status: 'ok', items: [{ business_name: ctx.scope.businessName, phone: ctx.scope.publicPhone || 'not set', address: ctx.scope.publicAddress || 'not set' }] }) },
];