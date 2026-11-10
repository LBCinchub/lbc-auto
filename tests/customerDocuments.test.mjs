// Pure tests — no network, SDK or data writes. Run: node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

globalThis.window = { history: { state: null }, location: { pathname: "/CustomerProfile/c1", search: "?tab=history" } };
const { safeReturnTo, hasInAppHistory, documentPath, openDocument, describeDocument, matchDocumentPath, matchListPath } = await import("../src/lib/customerDocuments.js");

test("routes each type to its canonical main-module detail page with the real id", () => {
  assert.equal(documentPath("invoice", "inv_1"), "/InvoiceDetail/inv_1");
  assert.equal(documentPath("estimate", "est_1"), "/EstimateDetail/est_1");
  assert.equal(documentPath("repair_order", "ro_1"), "/RepairOrderDetail/ro_1");
  assert.equal(documentPath("payment", "x"), null);
  assert.equal(documentPath("invoice", ""), null);
});

test("openDocument remembers the originating profile including its tab", () => {
  const calls = [];
  openDocument((...a) => calls.push(a), "invoice", "inv_9");
  assert.deepEqual(calls, [["/InvoiceDetail/inv_9", { state: { returnTo: "/CustomerProfile/c1?tab=history" } }]]);
  openDocument((...a) => calls.push(a), "invoice", null);
  assert.equal(calls.length, 1);
});

test("return target only accepts same-app paths", () => {
  assert.equal(safeReturnTo("/CustomerDetails?id=abc&tab=invoices"), "/CustomerDetails?id=abc&tab=invoices");
  for (const bad of ["https://evil.example", "//evil.example", "/\\evil", "javascript:alert(1)", null, 5]) assert.equal(safeReturnTo(bad), null);
});

test("in-app history detection uses the router index", () => {
  window.history.state = null; assert.equal(hasInAppHistory(), false);
  window.history.state = { idx: 0 }; assert.equal(hasInAppHistory(), false);
  window.history.state = { idx: 3 }; assert.equal(hasInAppHistory(), true);
});

test("summaries use saved values only, with balance just for open invoices", () => {
  const inv = describeDocument("invoice", { id: "abcdefghij", status: "partial", total: 200, balance_due: 50, line_items: [{ name: "Pads" }, { name: "Rotors" }, { name: "Labor" }] });
  assert.equal(inv.number, "abcdefgh");
  assert.equal(inv.total, 200);
  assert.equal(inv.balance, 50);
  assert.equal(inv.items, "Pads, Rotors +1 More");
  assert.equal(describeDocument("invoice", { status: "paid", total: 10, balance_due: 5 }).balance, null);
  assert.equal(describeDocument("estimate", { estimate_number: "EST-1", grand_total: 99 }).total, 99);
  const ro = describeDocument("repair_order", { order_number: "RO-2", total_cost: 75, description: "Brakes", mechanic_name: "Sam" });
  assert.deepEqual([ro.label, ro.number, ro.title, ro.total, ro.mechanic], ["Repair Order", "RO-2", "Brakes", 75, "Sam"]);
});

test("document links map into the profile; other paths pass through", () => {
  assert.deepEqual(matchDocumentPath("/InvoiceDetail/inv_1"), { type: "invoice", id: "inv_1" });
  assert.deepEqual(matchDocumentPath("/EstimateDetail/e%201"), { type: "estimate", id: "e 1" });
  assert.deepEqual(matchDocumentPath("/RepairOrderDetail/ro_1"), { type: "repair_order", id: "ro_1" });
  for (const p of ["/InvoiceDetail/", "/InvoiceDetail/a/b", "/Invoices", "/Settings", "https://x/InvoiceDetail/1", null]) assert.equal(matchDocumentPath(p), null);
  assert.deepEqual(matchListPath("/Estimates", "c1"), { tab: "estimates" });
  assert.deepEqual(matchListPath("/RepairOrders", "c1"), { tab: "repairorders" });
  assert.deepEqual(matchListPath("/Invoices", "c1"), { tab: "invoices" });
  assert.deepEqual(matchListPath("/CustomerDetails?id=c1", "c1"), { tab: null });
  assert.equal(matchListPath("/CustomerDetails?id=other", "c1"), null);
  assert.equal(matchListPath("/Invoices?q=x", "c1"), null);
  assert.equal(matchListPath("/Billing", "c1"), null);
});

test("staff customer profile opens the canonical editors in place and keeps tab state stable", () => {
  const details = readFileSync("src/pages/CustomerDetails.jsx", "utf8");
  for (const t of ['"estimate"', '"repair_order"', '"invoice"']) assert.ok(details.includes(`type=${t} doc=`));
  assert.ok(details.includes("onOpen={openDoc}"));
  assert.ok(!details.includes("window.location.href"));
  assert.ok(details.includes('activationMode="manual"'), "tabs must not switch on programmatic focus");
  assert.ok(details.includes("loading && !customer ?"), "reloads must not unmount the tabs");
  assert.ok(!details.includes("<AutoAIBubble"), "layout already renders the assistant");
  const view = readFileSync("src/components/customers/ProfileDocumentView.jsx", "utf8");
  for (const c of ["OriginalInvoiceEditor", "OriginalEstimateEditor", "RepairOrderDetail"]) assert.ok(view.includes(`<${c}`));
  for (const f of ["src/components/invoices/OriginalInvoiceEditor.jsx", "src/components/estimates/OriginalEstimateEditor.jsx", "src/pages/RepairOrderDetail.jsx", "src/components/invoices/InvoiceEditorHeader.jsx", "src/components/estimates/EstimateEditorHeader.jsx"]) {
    const src = readFileSync(f, "utf8");
    assert.ok(src.includes("useDocumentNavigate()"), `${f} must use the profile-aware navigate`);
    assert.ok(!/\buseNavigate\(\)/.test(src), `${f} still uses raw useNavigate`);
  }
  const ws = readFileSync("src/hooks/useProfileWorkspace.js", "utf8");
  assert.ok(ws.includes("profileDoc: true") && ws.includes("navigate(-1)"), "opening pushes history; closing steps back");
  const profile = readFileSync("src/pages/CustomerProfile.jsx", "utf8");
  for (const t of ['"repair_order"', '"estimate"', '"invoice"']) assert.ok(profile.includes(`type: ${t}`) || profile.includes(`type=${t}`));
  for (const p of ["src/pages/InvoiceDetail.jsx", "src/pages/EstimateDetail.jsx"]) {
    const src = readFileSync(p, "utf8");
    assert.ok(src.includes("OriginalInvoiceEditor") || src.includes("OriginalEstimateEditor"));
    assert.ok(src.includes("useSmartBack"));
  }
});