import { base44 } from "@/api/base44Client";
import { queryClientInstance } from "@/lib/query-client";

/**
 * Pushes the given line items into the per-shop LineItemLibrary so they
 * become autocomplete suggestions next time. Fire-and-forget — never blocks
 * the save flow. Invalidates the library cache so new items appear promptly.
 */
export function syncLineItemLibrary(lineItems) {
  if (!lineItems || !lineItems.length) return Promise.resolve();
  return base44.functions
    .invoke("syncLineItemLibrary", { line_items: lineItems })
    .then(() => queryClientInstance.invalidateQueries({ queryKey: ["lineItemLibrary"] }))
    .catch(() => {});
}