// Shared upsert logic for the per-shop Line Item Library.
// Used by both the `syncLineItemLibrary` backend function and the
// `financialDocumentAction` invoice workflow so estimates, invoices,
// and repair orders all feed the same tenant-scoped autocomplete source.

export async function upsertLineItems(base44, tenant: string, rawLines: any[]) {
  const lines = (rawLines || [])
    .map((l) => ({
      name: String(l.name || l.description || "").trim(),
      type: l.type === "labor" ? "labor" : "part",
      unit_price: Number(l.unit_price ?? l.rate ?? 0) || 0,
    }))
    .filter((l) => l.name);

  // Dedupe by type + case-insensitive name, keeping the last unit_price seen.
  const map = new Map<string, { name: string; type: string; unit_price: number }>();
  for (const l of lines) {
    const key = `${l.type}::${l.name.toLowerCase()}`;
    map.set(key, l);
  }

  for (const l of map.values()) {
    const existing = await base44.asServiceRole.entities.LineItemLibrary.filter(
      { shop_owner_email: tenant, item_name: l.name, type: l.type },
      "-created_date",
      1
    );
    if (existing[0]) {
      await base44.asServiceRole.entities.LineItemLibrary.update(existing[0].id, {
        last_unit_price: l.unit_price,
        times_used: (Number(existing[0].times_used) || 0) + 1,
      });
    } else {
      await base44.asServiceRole.entities.LineItemLibrary.create({
        shop_owner_email: tenant,
        item_name: l.name,
        type: l.type,
        last_unit_price: l.unit_price,
        times_used: 1,
      });
    }
  }
}