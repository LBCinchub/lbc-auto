// Haj Wheels owner-email migration: hajwheels@gmail.com -> info@hajwheels.com
// Modes: "preview" (read-only, default), "execute", "rollback".
// execute/rollback require admin + exact confirm string + verified identity.
// Only tenant fields change. created_by_id, customer contact emails,
// financial values and other shops are never touched. Nothing is deleted.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

const OLD = "hajwheels@gmail.com";
const NEW = "info@hajwheels.com";
const CONFIRM = "MIGRATE-HAJ-TO-INFO@2026-09-30";
const SHOP_IDENTITY = "haj rims and tires";

const SPEC = [
  ["Customer", "shop_owner_email"], ["Vehicle", "shop_owner_email"], ["Appointment", "shop_email"],
  ["ChatMessage", "shop_email"], ["LineItemLibrary", "shop_owner_email"], ["Mechanic", "shop_owner_email"],
  ["PaymentRecord", "shop_owner_email"], ["TimeEntry", "shop_owner_email"], ["ShopOffer", "shop_owner_email"],
  ["CustomerMessage", "shop_owner_email"], ["CustomerNotification", "shop_owner_email"],
  ["CustomerReview", "shop_owner_email"], ["DiagnosticScan", "shop_owner_email"],
  ["CustomerPortalSession", "shop_owner_email"], ["CustomerPasscode", "shop_owner_email"],
  ["PortalActivationCode", "shop_owner_email"], ["FinancialWorkflowEvent", "shop_owner_email"],
  ["WebBookingKey", "shop_owner_email"], ["WebBookingReceipt", "shop_owner_email"],
  ["ShopBookingAlias", "shop_owner_email"],
];

async function count(entities, value) {
  const out = {};
  for (const [name, field] of SPEC) {
    const recs = await entities[name].filter({ [field]: value }, null, 5000);
    out[name] = recs.length;
  }
  return out;
}

async function verifyIdentity(entities) {
  const u = (await entities.User.filter({ email: NEW }, null, 1))[0];
  const checks = {
    new_account_exists: !!u,
    shop_name_matches: !!u && String(u.business_name || "").trim().toLowerCase() === SHOP_IDENTITY,
  };
  return { verified: checks.new_account_exists && checks.shop_name_matches, checks };
}

async function moveAll(entities, from, to) {
  const results = {};
  for (const [name, field] of SPEC) {
    let total = 0;
    for (let i = 0; i < 20; i++) {
      const res = await entities[name].updateMany({ [field]: from }, { $set: { [field]: to } });
      total += res?.modified_count ?? res?.modifiedCount ?? 0;
      if (!res?.has_more) break;
    }
    results[name] = total;
  }
  return results;
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const mode = body.mode || "preview";
    const e = base44.asServiceRole.entities;

    if (mode === "preview") {
      return Response.json({
        mode, applied: false,
        old_email_records: await count(e, OLD),
        conflicts_new_email_records: await count(e, NEW),
        identity: await verifyIdentity(e),
      });
    }

    if (body.confirm !== CONFIRM) {
      return Response.json({ error: "CONFIRMATION_REQUIRED", applied: false }, { status: 403 });
    }

    if (mode === "execute") {
      const identity = await verifyIdentity(e);
      if (!identity.verified) return Response.json({ error: "IDENTITY_NOT_VERIFIED", identity, applied: false }, { status: 403 });
      const conflicts = await count(e, NEW);
      if (Object.values(conflicts).some((n) => n > 0)) {
        return Response.json({ error: "CONFLICT_BLOCKED", conflicts, applied: false }, { status: 409 });
      }
      const results = await moveAll(e, OLD, NEW);
      console.log("Haj migration executed by", user.email, results);
      return Response.json({ mode, applied: true, results, remaining_old: await count(e, OLD) });
    }

    if (mode === "rollback") {
      const results = await moveAll(e, NEW, OLD);
      console.log("Haj migration rolled back by", user.email, results);
      return Response.json({ mode, applied: true, results, remaining_new: await count(e, NEW) });
    }

    return Response.json({ error: "UNKNOWN_MODE" }, { status: 400 });
  } catch (error) {
    console.error("migrateHajTenantEmail error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}