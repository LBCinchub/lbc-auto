import { base44 } from "@/api/base44Client";
import { mergeById } from "@/lib/mergeById";

// Service-created records (website bookings) for the signed-in shop, verified server-side.
// Read-only: these rows are marked _shop_scoped and may not be editable under creator-only RLS.
export async function fetchShopScoped(entity, extra = {}, maxPages = 5) {
  const out = [];
  let skip = 0;
  for (let i = 0; i < maxPages; i++) {
    const { data } = await base44.functions.invoke("shopScopedRecords", { entity, limit: 200, skip, ...extra });
    out.push(...(data?.items || []));
    if (!data?.has_more) break;
    skip = data.next_skip;
  }
  return out;
}


export async function withShopRecords(entity, ownPromise, extra) {
  const [own, scoped] = await Promise.all([ownPromise, fetchShopScoped(entity, extra)]);
  return mergeById(own, scoped);
}