import { base44 } from "@/api/base44Client";

const BATCH = 100;
const recordKey = (c) => `${c.full_name}|${c.phone || ""}|${c.email || ""}`;

function customerData(item, shopEmail) {
  const data = { full_name: item.name.trim(), phone: item.phone.trim(), shop_owner_email: shopEmail };
  if (item.email.trim()) data.email = item.email.trim();
  if (item.address.trim()) data.address = item.address.trim();
  return data;
}

// Adds the chosen customers, and the vehicles listed with them, to the signed-in shop, 100 at a
// time. If a save fails it stops there and reports how many were added before it.
export async function importCustomers(items, shopEmail, onProgress) {
  const result = { customers: 0, vehicles: 0 };
  try {
    for (let start = 0; start < items.length; start += BATCH) {
      const batch = items.slice(start, start + BATCH).map((item) => ({ item, data: customerData(item, shopEmail) }));
      const created = await base44.entities.Customer.bulkCreate(batch.map((b) => b.data));
      result.customers += created.length;
      const byKey = new Map();
      for (const c of created) byKey.set(recordKey(c), [...(byKey.get(recordKey(c)) || []), c]);
      const vehicles = batch.flatMap(({ item, data }) => {
        const customer = byKey.get(recordKey(data))?.shift();
        if (!customer) return [];
        return item.vehicles.map((v) => ({ customer_id: customer.id, customer_name: customer.full_name, shop_owner_email: shopEmail, make: v.make, model: v.model, year: v.year }));
      });
      if (vehicles.length) result.vehicles += (await base44.entities.Vehicle.bulkCreate(vehicles)).length;
      onProgress(Math.min(start + BATCH, items.length));
    }
  } catch (e) {
    result.error = e?.message || "Something went wrong while saving.";
  }
  return result;
}