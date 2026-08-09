import { base44 } from "@/api/base44Client";

// One-time: stamp shop_owner_email onto Mechanic / TimeEntry / PaymentRecord
// records the current user owns (created by them) but that pre-date the
// shop_owner_email field. RLS scopes each .list() to the caller's own records,
// so this only ever touches records the caller can already read — it never
// reaches across tenants. Idempotent via a localStorage flag keyed by email.
export async function backfillTenantOwnership(userEmail) {
  if (!userEmail) return;
  const flag = `lbc_tenant_backfill_${userEmail}`;
  if (localStorage.getItem(flag)) return;
  try {
    const [mechanics, entries, payments] = await Promise.all([
      base44.entities.Mechanic.list("-created_date", 1000),
      base44.entities.TimeEntry.list("-created_date", 1000),
      base44.entities.PaymentRecord.list("-created_date", 1000),
    ]);
    const mechUpdates = mechanics
      .filter((m) => !m.shop_owner_email)
      .map((m) => ({ id: m.id, shop_owner_email: userEmail }));
    const entryUpdates = entries
      .filter((e) => !e.shop_owner_email)
      .map((e) => ({ id: e.id, shop_owner_email: userEmail }));
    const payUpdates = payments
      .filter((p) => !p.shop_owner_email)
      .map((p) => ({ id: p.id, shop_owner_email: userEmail }));
    if (mechUpdates.length) await base44.entities.Mechanic.bulkUpdate(mechUpdates);
    if (entryUpdates.length) await base44.entities.TimeEntry.bulkUpdate(entryUpdates);
    if (payUpdates.length) await base44.entities.PaymentRecord.bulkUpdate(payUpdates);
    localStorage.setItem(flag, "done");
  } catch (e) {
    console.warn("Tenant ownership backfill failed", e);
  }
}