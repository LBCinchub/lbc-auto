// Customer profile document actions: parity with the main list pages, shared handlers,
// overlay layer behavior, tab persistence and handler pending/error/success paths.
// All side effects run against in-memory fakes: no records, payments, texts or emails.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { register } from "node:module";

register("./helpers/documentActionsLoader.mjs", import.meta.url);
const fake = await import("./helpers/fakeBase44Client.mjs");
const pdf = await import("./helpers/fakeJsPdf.mjs");
const A = await import("../src/lib/documentActions.js");
const { profileDocumentPath } = await import("../src/lib/customerDocuments.js");

const src = (f) => readFileSync(f, "utf8");
let confirmAnswer = true;
const alerts = [];
globalThis.window = { confirm: () => confirmAnswer, alert: (m) => alerts.push(m), location: { origin: "https://example.test" } };
globalThis.alert = (m) => alerts.push(m);
beforeEach(() => { fake.reset(); confirmAnswer = true; alerts.length = 0; });

// ── Parity matrix: every action on the main list card, and where it lives on the profile card ──
const MATRIX = {
  invoice: {
    page: "src/pages/Invoices.jsx", profile: "src/components/document-actions/InvoiceProfileActions.jsx",
    rows: [
      ["Email Invoice", "email"], ["TextPdfButton", "text"], ["Record Payment", "pay"], ["Request Signature (Link)", "sign"],
      ["Download PDF", "pdf"], ["Print", "print"], ["Send to Repair Order", "ro"], ["Edit Payment History", "history"],
      ["Edit Invoice", "open"], ["Open Invoice Detail", "open"], ["handleDelete", "delete"],
    ],
  },
  estimate: {
    page: "src/pages/Estimates.jsx", profile: "src/components/document-actions/EstimateProfileActions.jsx",
    rows: [
      ["Approve", "approve"], ["Convert to Repair Order", "ro"], ["Convert to Invoice", "inv"], ["Cash Out", "cashout"],
      ["Email Estimate", "email"], ["TextPdfButton", "text"], ["openEdit", "open"], ["handleDelete", "delete"],
    ],
  },
  repair_order: {
    page: "src/pages/RepairOrders.jsx", profile: "src/components/document-actions/RepairOrderProfileActions.jsx",
    rows: [
      ["Send Email", "email"], ["History", "history"], ["Cashout", "cashout"], ["Generate Invoice", "inv"],
      ["Edit", "open"], ["Delete", "delete"],
    ],
  },
};

for (const [type, m] of Object.entries(MATRIX)) {
  test(`parity: every ${type} main-page action exists on the profile card`, () => {
    const page = src(m.page), profile = src(m.profile);
    for (const [mainMarker, profileId] of m.rows) {
      assert.ok(page.includes(mainMarker), `${m.page} no longer has "${mainMarker}"; update the matrix`);
      assert.ok(profile.includes(`id: "${profileId}"`), `${m.profile} is missing action "${profileId}" for "${mainMarker}"`);
    }
  });
}

test("main pages and profile cards call the same shared handlers", () => {
  const uses = {
    "src/pages/Invoices.jsx": ["requestInvoiceSignature", "deleteDocument", "downloadInvoicePdf"],
    "src/components/document-actions/InvoiceProfileActions.jsx": ["requestInvoiceSignature", "deleteDocument", "downloadInvoicePdf", "PaymentReceiptDialog", "PaymentHistoryManager", "InvoicePrintView", "TextPdfDialog"],
    "src/pages/Estimates.jsx": ["approveEstimate", "convertEstimateToRepairOrder", "emailEstimate", "estimateCashoutSource", "deleteDocument"],
    "src/components/document-actions/EstimateProfileActions.jsx": ["approveEstimate", "convertEstimateToRepairOrder", "emailEstimate", "estimateCashoutSource", "deleteDocument", "InvoiceFormDialog", "TextPdfDialog"],
    "src/pages/RepairOrders.jsx": ["generateInvoiceFromRepairOrder", "repairOrderCashoutSource", "deleteDocument", "RepairOrderHistoryDialog"],
    "src/components/document-actions/RepairOrderProfileActions.jsx": ["generateInvoiceFromRepairOrder", "repairOrderCashoutSource", "deleteDocument", "RepairOrderHistoryDialog"],
  };
  for (const [f, names] of Object.entries(uses)) for (const n of names) assert.ok(src(f).includes(n), `${f} must use ${n}`);
  // The old inline copies are gone from the main pages.
  assert.ok(!src("src/pages/Invoices.jsx").includes("new jsPDF("));
  assert.ok(!src("src/pages/Estimates.jsx").includes('functions.invoke("convertEstimateToRepairOrder"'));
  assert.ok(!src("src/pages/RepairOrders.jsx").includes('functions.invoke("financialDocumentAction"'));
});

test("all staff profile entry points use the action cards and the in-profile layer", () => {
  const details = src("src/pages/CustomerDetails.jsx");
  for (const t of ['type="estimate"', 'type="repair_order"', 'type="invoice"']) assert.ok(details.includes(`<CustomerDocumentCard key`) && details.includes(t));
  assert.ok(details.includes("<ProfileDocumentLayer") && details.includes('onOpenRepairOrder={(id) => openDoc("repair_order", id)}'));
  const profile = src("src/pages/CustomerProfile.jsx");
  assert.ok(profile.includes("<ProfileDocumentLayer") && profile.includes("onOpen={openDoc}"));
  const dialog = src("src/components/customers/CustomerProfileDialog.jsx");
  assert.ok(!/navigate\(`\/(InvoiceDetail|EstimateDetail|RepairOrderDetail)\//.test(dialog), "quick view must open documents inside the profile");
  assert.equal((dialog.match(/profileDocumentPath\(customer\.id/g) || []).length, 4);
  const card = src("src/components/customers/CustomerDocumentCard.jsx");
  assert.ok(card.includes("Balance Due") && card.includes(">Total<"), "readable total and balance labels");
});

test("quick view links land on the right profile tab with the document open", () => {
  assert.equal(profileDocumentPath("c1", "invoice", "i9"), "/CustomerDetails?id=c1&tab=invoices&doc=invoice&docId=i9");
  assert.equal(profileDocumentPath("c1", "repair_order", "r1"), "/CustomerDetails?id=c1&tab=repairorders&doc=repair_order&docId=r1");
  assert.equal(profileDocumentPath("c1", "estimate", "e 1"), "/CustomerDetails?id=c1&tab=estimates&doc=estimate&docId=e+1");
  assert.equal(profileDocumentPath(null, "invoice", "i9"), null);
  assert.equal(profileDocumentPath("c1", "payment", "x"), null);
});

test("layer: portals above the profile, full screen on phones, no backdrop dismissal, focus kept and restored", () => {
  const layer = src("src/components/customers/ProfileDocumentLayer.jsx");
  assert.ok(layer.includes("createPortal(") && layer.includes("document.body"));
  assert.ok(layer.includes('aria-modal="true"') && layer.includes("w-full") && layer.includes("lbc-dvh-screen"));
  assert.ok(!/bg-black\/70"[^>]*onClick/.test(layer), "backdrop must not close the layer");
  assert.ok(layer.includes("restore?.focus?.()") && layer.includes("panel.current?.focus()"));
  assert.ok(layer.includes('e.key === "Tab"') && layer.includes("window.confirm("), "Tab is trapped; Escape asks before closing");
  assert.ok(layer.includes("nestedLayerOpen()"), "nested dialogs/menus keep their own Escape/Tab");
  assert.ok(layer.includes('document.body.style.overflow = "hidden"') && layer.includes("overflow-y-auto"), "one scroller");
  assert.ok(src("src/components/customers/ProfileDocumentView.jsx").includes("flex max-h-full min-h-0 min-w-0 flex-col overflow-hidden"), "editor frame fits the layer so its action bar stays visible");
});

test("tabs and context survive refresh/back/close", () => {
  const ws = src("src/hooks/useProfileWorkspace.js");
  assert.ok(ws.includes('searchParams.get("tab")') && ws.includes('searchParams.get("doc")'));
  assert.ok(ws.includes("{ replace: true }") && ws.includes("profileDoc: true") && ws.includes("navigate(-1)"));
  assert.ok(!ws.includes("window.scrollTo(0, 0)"), "opening the layer must not move the profile");
  assert.ok(ws.includes("onClosed?.()"), "summaries refetch after the layer closes");
  const details = src("src/pages/CustomerDetails.jsx");
  assert.ok(details.includes('activationMode="manual"') && details.includes("loading && !customer ?"));
  assert.ok(!details.includes("<AutoAIBubble"));
});

test("action menu: grouped, labeled, one request at a time, 44px touch targets", () => {
  const bar = src("src/components/document-actions/DocumentActionBar.jsx");
  for (const g of ["View & Edit", "Send, Print & Signature", "Payments & Conversions", "Danger Zone"]) assert.ok(bar.includes(g));
  assert.ok(bar.includes('aria-label="More Actions"') && bar.includes("min-h-[44px]") && bar.includes("disabled={locked"));
  const busy = src("src/components/document-actions/useBusyAction.js");
  assert.ok(busy.includes("if (lock.current) return;") && busy.includes("finally"));
});

test("action state: offered actions follow saved state; existing links open, never recreate", () => {
  assert.deepEqual(A.invoiceActionState({ status: "unpaid" }), { canPay: true, signed: false, hasHistory: false, linkedRepairOrderId: null });
  assert.equal(A.invoiceActionState({ status: "paid", amount_paid: 10 }).canPay, false);
  assert.equal(A.invoiceActionState({ status: "paid", amount_paid: 10 }).hasHistory, true);
  assert.equal(A.invoiceActionState({ status: "partial", auth_status: "approved", repair_order_id: "r1" }).linkedRepairOrderId, "r1");
  assert.equal(A.estimateActionState({ status: "declined" }).canApprove, false);
  assert.equal(A.estimateActionState({ status: "approved", linked_repair_order_id: "r2", linked_invoice_id: "i2" }).linkedRepairOrderId, "r2");
  assert.equal(A.repairOrderActionState({ linked_invoice_id: "i3", history: [{}] }).linkedInvoiceId, "i3");
  const est = src("src/components/document-actions/EstimateProfileActions.jsx");
  assert.ok(est.includes('s.linkedRepairOrderId\n      ? { id: "ro", label: "View Repair Order"'));
  assert.ok(src("src/components/document-actions/RepairOrderProfileActions.jsx").includes('s.linkedInvoiceId\n      ? { id: "inv", label: "View Invoice"'));
});

test("delete: cancelled confirmation does nothing; confirmed runs the RLS-enforced delete; denial surfaces", async () => {
  confirmAnswer = false;
  assert.equal(await A.deleteDocument("Invoice", "i1"), false);
  assert.equal(fake.calls.length, 0);
  confirmAnswer = true;
  assert.equal(await A.deleteDocument("RepairOrder", "r1"), true);
  assert.deepEqual(fake.calls[0], ["delete", "RepairOrder", "r1"]);
  fake.script.failEntity = "Estimate";
  await assert.rejects(A.deleteDocument("Estimate", "e1"), /denied/);
});

test("signature request: needs a phone and a confirmation; server error is shown, not swallowed", async () => {
  assert.equal(await A.requestInvoiceSignature({ id: "i1" }, ""), false);
  assert.equal(fake.calls.length, 0);
  confirmAnswer = false;
  assert.equal(await A.requestInvoiceSignature({ id: "i1" }, "6135550100"), false);
  assert.equal(fake.calls.length, 0);
  confirmAnswer = true;
  fake.script.invoke.sendInvoiceAuthSMS = { ok: true };
  assert.equal(await A.requestInvoiceSignature({ id: "i1" }, "6135550100"), true);
  assert.deepEqual(fake.calls[0][2], { invoice_id: "i1", phone: "6135550100", app_url: "https://example.test" });
  fake.script.invoke.sendInvoiceAuthSMS = Object.assign(new Error("x"), { response: { data: { error: "Forbidden: other shop" } } });
  assert.equal(await A.requestInvoiceSignature({ id: "i1" }, "6135550100"), false);
  assert.match(alerts.at(-1), /Forbidden: other shop/);
});

test("conversions: confirm first, server decides; repeat returns the same linked record", async () => {
  confirmAnswer = false;
  assert.equal(await A.convertEstimateToRepairOrder({ id: "e1" }), null);
  assert.equal(await A.generateInvoiceFromRepairOrder({ id: "r1" }), null);
  assert.equal(fake.calls.length, 0);
  confirmAnswer = true;
  fake.script.invoke.convertEstimateToRepairOrder = { repair_order: { id: "r7" } };
  assert.equal((await A.convertEstimateToRepairOrder({ id: "e1" })).id, "r7");
  assert.equal((await A.convertEstimateToRepairOrder({ id: "e1" })).id, "r7");
  fake.script.invoke.convertEstimateToRepairOrder = Object.assign(new Error("x"), { response: { data: { error: "Estimate must be approved" } } });
  assert.equal(await A.convertEstimateToRepairOrder({ id: "e2" }), null);
  assert.match(alerts.at(-1), /must be approved/);
  fake.script.invoke.financialDocumentAction = (p) => ({ invoice: { id: `inv-for-${p.source_id}` } });
  const a = await A.generateInvoiceFromRepairOrder({ id: "r1" });
  const b = await A.generateInvoiceFromRepairOrder({ id: "r1" });
  assert.equal(a.id, b.id);
  const keys = fake.calls.filter((c) => c[1] === "financialDocumentAction").map((c) => c[2].idempotency_key);
  assert.deepEqual(keys, ["repair-order-invoice:r1", "repair-order-invoice:r1"]);
});

test("estimate email: marks sent only after a confirmed send; approve skips already-approved", async () => {
  assert.equal(await A.emailEstimate(async () => false, { id: "e1" }, null), false);
  assert.equal(fake.calls.length, 0);
  assert.equal(await A.emailEstimate(async () => true, { id: "e1" }, "a@b.c"), true);
  assert.deepEqual(fake.calls[0], ["update", "Estimate", "e1", { status: "sent", auth_status: "pending" }]);
  assert.equal(await A.approveEstimate({ id: "e1", status: "approved" }), false);
  fake.script.failEntity = "Estimate";
  const err = console.error; console.error = () => {};
  assert.equal(await A.approveEstimate({ id: "e2", status: "sent" }), false);
  console.error = err;
});

test("cash out payloads are built from saved values only (no processor claim, balance from saved totals)", () => {
  const e = A.estimateCashoutSource({ id: "e1", grand_total: 113, amount_paid: 13, linked_invoice_id: "i1" });
  assert.equal(e.balance_due, 100); assert.equal(e._source, "estimate"); assert.equal(e.linked_invoice_id, "i1");
  const r = A.repairOrderCashoutSource({ id: "r1", total_cost: 50 });
  assert.equal(r.balance_due, 50); assert.equal(r.linked_invoice_id, null);
  A.downloadInvoicePdf({ invoice_number: "INV-1", created_date: "2026-01-01", customer_name: "A", vehicle_info: "V", status: "paid" });
  assert.deepEqual(pdf.saved, ["Invoice-INV-1.pdf"]);
});