// Synthetic fixtures only — no live records, no network. Stripe responses are mocked.
// Covers per-shop card checkout verification, dedupe, races with manual payments and tenant isolation.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeStore } from "./helpers/mockEntities.mjs";
import { sessionMismatch, sessionOutcome, checkoutIdempotencyKey, toMinor } from "../base44/shared/stripeCheckoutCheck.ts";
import { applyCheckoutPayment, syncLink, accountView, ownsRecord, invoiceBalance, stripeApi } from "../base44/shared/shopStripe.ts";
import { withLease } from "../base44/shared/recordLease.ts";
import { applyPayments, paymentAlreadyApplied } from "../base44/shared/invoicePaymentGuard.ts";

const SHOP_A = "shop-a@example.test";
const SHOP_B = "shop-b@example.test";
const invoiceA = (over = {}) => ({ id: "invA", shop_owner_email: SHOP_A, customer_id: "custA", total: 113, amount_paid: 0, balance_due: 113, status: "unpaid", payment_history: [], financial_lease_until: null, ...over });
const linkA = (over = {}) => ({ id: "linkA", shop_owner_email: SHOP_A, invoice_id: "invA", checkout_session_id: "cs_test_A", amount: 113, currency: "cad", status: "open", ...over });
const paidSession = (over = {}) => ({ id: "cs_test_A", status: "complete", payment_status: "paid", amount_total: 11300, currency: "cad", payment_intent: "pi_A", metadata: { invoice_id: "invA", shop: SHOP_A }, ...over });
const seed = (inv = invoiceA(), link = linkA()) => makeStore({ Invoice: [inv], StripeCheckoutLink: [link], FinancialWorkflowEvent: [] });

test("session must match link exactly: invoice, shop, CAD currency, minor-unit amount", () => {
  assert.equal(sessionMismatch(linkA(), paidSession()), "");
  assert.equal(sessionMismatch(linkA(), paidSession({ id: "cs_other" })), "session");
  assert.equal(sessionMismatch(linkA(), paidSession({ metadata: { invoice_id: "invB", shop: SHOP_A } })), "invoice", "forged invoice id");
  assert.equal(sessionMismatch(linkA(), paidSession({ metadata: { invoice_id: "invA", shop: SHOP_B } })), "shop", "other tenant");
  assert.equal(sessionMismatch(linkA(), paidSession({ currency: "usd" })), "currency");
  assert.equal(sessionMismatch(linkA(), paidSession({ amount_total: 11299 })), "amount");
  assert.equal(toMinor(0.1 + 0.2), 30);
});

test("outcomes: only complete+paid counts as paid; complete+unpaid is processing", () => {
  assert.equal(sessionOutcome(paidSession()), "paid");
  assert.equal(sessionOutcome(paidSession({ payment_status: "unpaid" })), "processing");
  assert.equal(sessionOutcome({ status: "expired" }), "expired");
  assert.equal(sessionOutcome({ status: "open", payment_status: "unpaid" }), "open");
});

test("idempotency key: racing clicks share one key; new attempt or mode gets a new one", () => {
  const k = checkoutIdempotencyKey("invA", 113, 2, true);
  assert.equal(k, checkoutIdempotencyKey("invA", 113, 2, true));
  assert.notEqual(k, checkoutIdempotencyKey("invA", 113, 3, true));
  assert.notEqual(k, checkoutIdempotencyKey("invA", 113, 2, false));
  assert.notEqual(k, checkoutIdempotencyKey("invA", 50, 2, true));
});

test("verified full payment recorded once; replays and simultaneous duplicates add nothing", async () => {
  const { entities, tables } = seed();
  await Promise.all([1, 2, 3].map(() => applyCheckoutPayment(entities, linkA(), paidSession())));
  await applyCheckoutPayment(entities, linkA(), paidSession()); // later retry
  const inv = tables.Invoice[0];
  assert.equal(inv.payment_history.length, 1);
  assert.equal(inv.amount_paid, 113); assert.equal(inv.balance_due, 0); assert.equal(inv.status, "paid");
  assert.equal(inv.payment_history[0].payment_key, "stripe:cs_test_A");
  assert.equal(tables.FinancialWorkflowEvent.length, 1);
  assert.equal(tables.StripeCheckoutLink[0].status, "paid");
});

test("mismatched session (amount / other shop) is flagged for review, invoice untouched", async () => {
  for (const s of [paidSession({ amount_total: 99999 }), paidSession({ metadata: { invoice_id: "invA", shop: SHOP_B } })]) {
    const { entities, tables } = seed();
    await applyCheckoutPayment(entities, linkA(), s);
    assert.equal(tables.Invoice[0].payment_history.length, 0);
    assert.equal(tables.Invoice[0].balance_due, 113);
    assert.equal(tables.StripeCheckoutLink[0].status, "needs_review");
  }
});

test("partial: link for the remaining balance completes the invoice", async () => {
  const inv = invoiceA({ amount_paid: 13, balance_due: 100, status: "partial", payment_history: [{ date: "d", amount: 13, method: "cash" }] });
  const { entities, tables } = seed(inv, linkA({ amount: 100 }));
  await applyCheckoutPayment(entities, linkA({ amount: 100 }), paidSession({ amount_total: 10000 }));
  assert.equal(tables.Invoice[0].balance_due, 0);
  assert.equal(tables.Invoice[0].payment_history.length, 2);
});

test("simultaneous manual cash + Stripe for the full balance never overpays", async () => {
  for (let run = 0; run < 10; run++) {
    const { entities, tables } = seed();
    const manual = withLease(entities, "Invoice", "invA", async () => {
      const cur = await entities.Invoice.get("invA");
      if (paymentAlreadyApplied(cur, "manual-1")) return;
      try { await entities.Invoice.update("invA", applyPayments(cur, [{ amount: 113, method: "cash" }], "d", "manual-1").update); } catch { /* over balance */ }
    }, { delayMs: 5 });
    await Promise.all([manual, applyCheckoutPayment(entities, linkA(), paidSession())]);
    const inv = tables.Invoice[0];
    assert.equal(inv.amount_paid, 113, "exactly one full payment applied");
    assert.equal(inv.payment_history.length, 1);
    const linkStatus = tables.StripeCheckoutLink[0].status;
    assert.equal(linkStatus, inv.payment_history[0].payment_key === "stripe:cs_test_A" ? "paid" : "needs_review", "Stripe link flagged when manual payment won");
  }
});

test("syncLink: processing is never closed; open+close expires; paid is applied", async () => {
  const realFetch = globalThis.fetch;
  const calls = [];
  const respond = (session) => { globalThis.fetch = async (url, init) => { calls.push({ url: String(url), method: init.method }); return new Response(JSON.stringify(String(url).endsWith("/expire") ? { status: "expired" } : session), { status: 200 }); }; };
  try {
    let store = seed();
    respond(paidSession({ payment_status: "unpaid" }));
    const r1 = await syncLink(store.entities, "sk_test_x", linkA(), { close: true });
    assert.equal(r1.processing, true);
    assert.ok(!calls.some((c) => c.url.endsWith("/expire")), "processing session not expired");

    store = seed(); calls.length = 0;
    respond({ id: "cs_test_A", status: "open", payment_status: "unpaid" });
    const r2 = await syncLink(store.entities, "sk_test_x", linkA(), { close: true });
    assert.equal(r2.status, "cancelled");

    store = seed();
    respond(paidSession());
    const r3 = await syncLink(store.entities, "sk_test_x", linkA());
    assert.equal(r3.status, "paid");
    assert.equal(store.tables.Invoice[0].balance_due, 0);
  } finally { globalThis.fetch = realFetch; }
});

test("stripeApi sends the idempotency key header only when given", async () => {
  const realFetch = globalThis.fetch;
  const seen = [];
  globalThis.fetch = async (_u, init) => { seen.push(init.headers["Idempotency-Key"]); return new Response("{}", { status: 200 }); };
  try {
    await stripeApi("sk_test_x", "POST", "checkout/sessions", { a: "1" }, "lbc-checkout:invA:11300:0:in_app");
    await stripeApi("sk_test_x", "GET", "account");
    assert.deepEqual(seen, ["lbc-checkout:invA:11300:0:in_app", undefined]);
  } finally { globalThis.fetch = realFetch; }
});

test("tenant isolation: another shop's invoice is never owned; forged stamps don't help", () => {
  assert.equal(ownsRecord(invoiceA(), SHOP_A, "uA"), true);
  assert.equal(ownsRecord(invoiceA(), SHOP_B, "uB"), false);
  assert.equal(ownsRecord({ id: "x", created_by_id: "uA" }, SHOP_B, "uB"), false);
  assert.equal(ownsRecord(null, SHOP_A, "uA"), false);
  assert.equal(invoiceBalance({ total: 113, amount_paid: 13 }), 100);
});

test("browser view of a connection never carries the secret key", () => {
  const view = accountView({ mode: "test", encrypted_secret_key: "v2.abc.def", key_last4: "1234", publishable_key: "pk_test_123", charges_enabled: true, stripe_account_id: "acct_1" });
  const text = JSON.stringify(view);
  assert.ok(!text.includes("v2.abc.def") && !text.includes("sk_") && !text.includes("acct_1"));
  assert.equal(view.in_app_ready, true);
  assert.equal(accountView({ mode: "live", charges_enabled: undefined }).charges_enabled, false, "unknown readiness is not ready");
});