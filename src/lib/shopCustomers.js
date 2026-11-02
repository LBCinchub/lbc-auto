import { base44 } from "@/api/base44Client";

// Every customer of the signed-in shop: the ones its owner created plus the ones stamped with
// the shop's email, newest first. Used by the Customers list and the importer's duplicate check.
export async function fetchShopCustomers(user) {
  if (!user) return [];
  const [byCreated, byShopEmail] = await Promise.all([
    base44.entities.Customer.filter({ created_by: user.email }, "-created_date", 10000),
    base44.entities.Customer.filter({ shop_owner_email: user.email }, "-created_date", 10000),
  ]);
  const seen = new Set();
  const merged = [...byCreated, ...byShopEmail].filter((c) => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });
  return merged.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
}