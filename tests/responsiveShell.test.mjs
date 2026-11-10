// Source-level guards for the shared responsive shell. These do not replace rendered/device testing.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("drawer: accessible names, scroll lock restored on close, Escape and desktop resize close it", () => {
  const s = src("src/components/layout/Sidebar.jsx");
  assert.match(s, /aria-label="Open Navigation Menu"/);
  assert.match(s, /aria-label="Close Navigation Menu"/);
  assert.match(s, /const prev = document\.body\.style\.overflow;[\s\S]*document\.body\.style\.overflow = prev;/);
  assert.match(s, /e\.key === "Escape"/);
  assert.match(s, /min-width: 1024px/);
  assert.match(s, /lbc-dvh-screen/);
  assert.match(s, /collapsedPref && !mobileOpen/);
});

test("dialogs fit the visible viewport with a vh fallback; print is untouched", () => {
  const css = src("src/index.css");
  assert.match(css, /\.lbc-dialog-fit \{\s*max-height: calc\(100vh - 1rem\);\s*max-height: calc\(100dvh - 1rem\);/);
  assert.match(css, /@media screen and \(max-width: 767px\)[\s\S]*font-size: 16px !important/);
  assert.match(src("src/components/ui/dialog.jsx"), /"lbc-dialog-fit /);
  assert.match(src("src/components/invoices/InvoiceFormDialog.jsx"), /lbc-max-94/);
  assert.match(src("src/components/estimates/EstimateFormDialog.jsx"), /lbc-max-92/);
  assert.match(src("src/components/orders/RepairOrderFormDialog.jsx"), /lbc-fit-90/);
  assert.doesNotMatch(src("src/components/orders/RepairOrderFormDialog.jsx"), /height: "90vh"/);
});

test("financial editors: body can shrink, action bar never does; AI widget lifts over dialog bars", () => {
  assert.match(src("src/components/invoices/OriginalInvoiceEditor.jsx"), /min-h-0 max-h-\[72vh\] overflow-y-auto/);
  assert.match(src("src/components/estimates/OriginalEstimateEditor.jsx"), /min-h-0 max-h-\[72vh\] overflow-y-auto/);
  for (const f of ["src/components/invoices/InvoiceEditorActions.jsx", "src/components/estimates/EstimateEditorActions.jsx"]) {
    assert.match(src(f), /flex-shrink-0[^"]*safe-area-inset-bottom/);
  }
  assert.match(src("src/components/shared/AutoAIBubble.jsx"), /detailMode \|\| shellOpen \|\| dialogOpen \? 92 : 20/);
});

test("wide tables scroll inside their own box instead of being clipped", () => {
  assert.doesNotMatch(src("src/pages/TimeTracking.jsx"), /border-gray-800 overflow-hidden">\s*<table/);
  assert.doesNotMatch(src("src/components/orders/RepairOrderFormDialog.jsx"), /overflow-hidden">\s*<table/);
  assert.match(src("src/components/analytics/PaymentGroupTable.jsx"), /<div className="overflow-x-auto">\s*<table/);
  assert.match(src("src/components/invoices/InvoiceLineItemsTable.jsx"), /overflow-x-auto[^>]*><table className="w-full min-w-\[780px\]/);
});