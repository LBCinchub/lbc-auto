// Layout regression guards for invoice/estimate editors on desktop (source-level; not a visual test).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("customer-profile document layer is centered in the viewport, not pinned to the right", () => {
  const s = src("src/components/customers/ProfileDocumentLayer.jsx");
  assert.doesNotMatch(s, /\bml-auto flex w-full/);
  assert.match(s, /relative mx-auto flex w-full min-w-0 flex-col/);
  assert.match(s, /lg:w-\[calc\(100%-2rem\)\] lg:max-w-\[1280px\]/);
  assert.match(s, /createPortal\(/);
  assert.match(s, /min-h-0 min-w-0 flex-1 overflow-y-auto/);
});

test("profile invoice/estimate frame is capped to the layer so Save/Cancel stays visible", () => {
  const s = src("src/components/customers/ProfileDocumentView.jsx");
  assert.match(s, /const FRAME = "lbc-editor-frame flex max-h-full min-h-0 min-w-0 flex-col overflow-hidden/);
  assert.match(s, /<RepairOrderDetail key=\{doc\.id\} orderId=\{doc\.id\} \/>/); // RO keeps scrolling the layer
});

test("invoice/estimate detail pages fit the desktop viewport with one body scroller", () => {
  for (const f of ["src/pages/InvoiceDetail.jsx", "src/pages/EstimateDetail.jsx"]) {
    assert.match(src(f), /lbc-editor-frame lbc-page-editor flex min-h-0 min-w-0 flex-col overflow-hidden/);
  }
  const css = src("src/index.css");
  assert.match(css, /@media screen and \(min-width: 1024px\) \{\s*\.lbc-page-editor \{ max-height: calc\(100vh - 4rem\); max-height: calc\(100dvh - 4rem\); \}/);
  assert.match(css, /\.lbc-editor-frame > \* \{ min-width: 0; \}/);
  for (const f of ["src/components/invoices/OriginalInvoiceEditor.jsx", "src/components/estimates/OriginalEstimateEditor.jsx"]) {
    assert.equal((src(f).match(/overflow-y-auto/g) || []).length, 1, `${f} has one vertical scroller`);
  }
});

test("create/edit dialogs keep viewport gutters and stay centered through the shared portal dialog", () => {
  assert.match(src("src/components/invoices/InvoiceFormDialog.jsx"), /lbc-max-94 lbc-editor-frame flex min-w-0 max-w-5xl sm:w-\[calc\(100vw-2rem\)\] flex-col gap-0 overflow-hidden/);
  assert.match(src("src/components/estimates/EstimateFormDialog.jsx"), /lbc-max-92 lbc-editor-frame [^"]*min-w-0 max-w-4xl sm:w-\[calc\(100vw-2rem\)\] p-0 overflow-hidden flex flex-col/);
  const d = src("src/components/ui/dialog.jsx");
  assert.match(d, /<DialogPortal>/);
  assert.match(d, /fixed left-\[50%\] top-\[50%\][^"]*translate-x-\[-50%\] translate-y-\[-50%\]/);
});

test("action bars never shrink and keep every action", () => {
  const inv = src("src/components/invoices/InvoiceEditorActions.jsx");
  assert.match(inv, /flex flex-shrink-0 flex-wrap/);
  for (const a of ["Print", "Email Invoice", "TextPdfButton", "Record Payment", "Cancel", "Save Invoice"]) assert.ok(inv.includes(a), a);
  assert.match(src("src/components/estimates/EstimateEditorActions.jsx"), /flex flex-shrink-0 flex-wrap/);
});