// Source-level routing checks: every estimate/invoice "text the document" control opens the
// PDF-attachment flow (sendDocumentPdf), and link-based actions are labelled as links.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const FLOW = ["src/components/document-delivery/TextPdfButton.jsx", "src/components/document-delivery/TextPdfDialog.jsx", "src/components/document-delivery/useDocumentDelivery.js"];

test("PDF flow only calls sendDocumentPdf with saved type/id and never a link/legacy sender", () => {
  const all = FLOW.map(src).join("\n");
  const invokes = [...all.matchAll(/functions\.invoke\(\s*"([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(invokes)], ["sendDocumentPdf"]);
  assert.match(src(FLOW[2]), /document_type: documentType, document_id: documentId/);
  for (const bad of ["sendInvoiceAuthSMS", "sendSMS", "InvoiceSign", "CustomerPortal", "lbc-customer", "PayInvoice", "window.location", "phone:", "to:"]) {
    assert.ok(!all.includes(bad), `PDF flow must not reference ${bad}`);
  }
  // Nothing is sent on open: the only "send" action is behind the explicit button.
  assert.match(src(FLOW[2]), /action: "prepare"/);
  assert.match(src(FLOW[1]), /onClick=\{send\}/);
});

test("labels: Text Invoice PDF / Text Estimate PDF", () => {
  const b = src(FLOW[0]);
  assert.ok(b.includes('"Text Invoice PDF"') && b.includes('"Text Estimate PDF"'));
});

for (const [file, type] of [
  ["src/pages/Invoices.jsx", "invoice"], ["src/pages/Estimates.jsx", "estimate"],
  ["src/components/invoices/InvoiceEditorActions.jsx", "invoice"], ["src/components/estimates/EstimateEditorActions.jsx", "estimate"],
]) {
  test(`${file}: has the ${type} PDF text action`, () => {
    assert.match(src(file), new RegExp(`<TextPdfButton documentType="${type}" documentId=\\{`));
  });
}

test("estimate editor passes the saved estimate id; detail pages use these editors", () => {
  assert.match(src("src/components/estimates/OriginalEstimateEditor.jsx"), /estimateId=\{estimate\.id\}/);
  assert.match(src("src/pages/EstimateDetail.jsx"), /OriginalEstimateEditor/);
  assert.match(src("src/pages/InvoiceDetail.jsx"), /OriginalInvoiceEditor/);
});

test("email actions are labelled as email, not as a generic Send", () => {
  for (const f of ["src/components/invoices/InvoiceEditorActions.jsx", "src/components/estimates/EstimateEditorActions.jsx"]) {
    assert.ok(!/"Send"/.test(src(f)), `${f} still has a bare "Send" label`);
  }
  assert.ok(src("src/pages/Invoices.jsx").includes('title="Email Invoice"'));
  assert.ok(src("src/pages/Estimates.jsx").includes('title="Email Estimate"'));
});

test("legacy signature link is explicit, confirmed, and separate from the PDF action", () => {
  const inv = src("src/pages/Invoices.jsx");
  assert.ok(inv.includes("Request Signature (Link)"));
  assert.ok(!inv.includes("Send Auth SMS"));
  const fn = inv.slice(inv.indexOf("const sendAuthSMS"), inv.indexOf("const { data: invoices"));
  assert.ok(fn.indexOf("window.confirm") > -1 && fn.indexOf("window.confirm") < fn.indexOf("sendInvoiceAuthSMS"));
  assert.ok(!FLOW.map(src).join("").includes("sendAuthSMS"));
});

test("Stripe payment-link text is labelled Send Payment Link", () => {
  const s = src("src/components/invoices/StripeLinkActions.jsx");
  assert.ok(s.includes("Send Payment Link") && !s.includes("Text customer"));
});