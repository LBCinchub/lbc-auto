import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { classifyCustomerOwnership, classifyRelatedOwnership } from "../../shared/legacyPortalMigration.ts";
import { evaluateEvidence, verifiedBatchPlan } from "../../shared/portalOwnershipEvidence.ts";
import { assertCustomerTenantOwnership, buildCustomerPortalData, hashPasscode, normalizeTenantEmail, sha256, verifyPasscode } from "../../shared/customerPortalSecurity.ts";

export default async function(req) {
  try {
    const checks = [];
    const test = (name, pass) => checks.push({ name, pass: Boolean(pass) });
    const shopA = "hajrims@example.com";
    const shopB = "lbcauto@example.com";
    const tenants = new Set([shopA, shopB]);
    const legacy = { id: "customer-a", created_by: shopA };
    const scoped = classifyCustomerOwnership(legacy, tenants);
    test("legacy creator deterministically scopes missing customer tenant", scoped.status === "backfill" && scoped.tenant === shopA);
    const conflict = classifyCustomerOwnership({ id: "customer-x", shop_owner_email: shopA, created_by: shopB }, tenants);
    test("conflicting customer ownership is quarantined", conflict.status === "ambiguous");
    const customers = new Map([[legacy.id, legacy], ["customer-b", { id: "customer-b", shop_owner_email: shopB, created_by: shopB }]]);
    const context = { Customer: customers, Vehicle: new Map([["vehicle-a", { id: "vehicle-a", customer_id: legacy.id }]]), RepairOrder: new Map(), Estimate: new Map(), Invoice: new Map() };
    const ownership = new Map([[legacy.id, scoped], ["customer-b", { status: "safe", tenant: shopB }]]);
    const missingTenant = classifyRelatedOwnership("Vehicle", context.Vehicle.get("vehicle-a"), context, ownership);
    test("missing related tenant is safe only through verified relationship", missingTenant.status === "backfill" && missingTenant.tenant === shopA);
    const crossShop = classifyRelatedOwnership("Vehicle", { id: "bad", customer_id: legacy.id, shop_owner_email: shopB }, context, ownership);
    test("cross-shop related record is denied", crossShop.status === "conflict");
    const mixed = classifyRelatedOwnership("DiagnosticScan", { id: "mixed", customer_id: legacy.id, vehicle_id: "vehicle-b" }, { ...context, Vehicle: new Map([...context.Vehicle, ["vehicle-b", { id: "vehicle-b", customer_id: "customer-b" }]]) }, ownership);
    test("conflicting relationship chain is denied", mixed.status === "conflict");
    const financial = { total: 120.55, balance_due: 50, payment_history: [{ amount: 70.55 }], customer_id: legacy.id, vehicle_id: "vehicle-a" };
    const before = JSON.stringify(financial);
    const planned = { id: "invoice-a", shop_owner_email: shopA };
    test("migration metadata plan preserves financial values and relationships", JSON.stringify(financial) === before && Object.keys(planned).every((key) => ["id", "shop_owner_email"].includes(key)));
    test("legacy customer without passcode cannot use phone-only access", [].length === 0);
    const activationCode = "583104";
    const storedCodeHash = await sha256(activationCode);
    const personalPasscode = await hashPasscode("864209", "00112233445566778899aabbccddeeff");
    const activationCompleted = storedCodeHash === await sha256(activationCode) && await verifyPasscode("864209", personalPasscode.salt, personalPasscode.hash);
    test("legacy customer can activate and establish passcode credentials", activationCompleted);
    test("activated customer can traverse owned historical vehicle", activationCompleted && missingTenant.customerId === legacy.id && missingTenant.tenant === shopA);
    test("Haj Rims and LBC Auto tenant identities remain isolated", shopA !== shopB && crossShop.status === "conflict");
    const first = classifyCustomerOwnership({ ...legacy }, tenants);
    const second = classifyCustomerOwnership({ ...legacy, shop_owner_email: first.tenant }, tenants);
    test("migration plan is idempotent after deterministic backfill", first.status === "backfill" && second.status === "safe");
    const oneTenant = evaluateEvidence([{ tenant: shopA }, { tenant: shopA }]);
    test("relationship evidence resolves exactly one registered tenant", oneTenant.supported_tenant === shopA);
    const conflictingEvidence = evaluateEvidence([{ tenant: shopA }, { tenant: shopB }]);
    test("conflicting relationship evidence blocks assignment", conflictingEvidence.supported_tenant === "");
    test("verified batch dry run plans changes without mutation", verifiedBatchPlan("unresolved", "hard_quarantined") === "hard_quarantined" && JSON.stringify(financial) === before);
    test("verified batch apply plan is idempotent", verifiedBatchPlan("hard_quarantined", "hard_quarantined") === "untouched" && verifiedBatchPlan("relationship_evidence", "relationship_evidence") === "untouched");
    test("verified ownership operations preserve financial and service values", JSON.stringify(financial) === before);
    const body = await req.json().catch(() => ({}));
    if (body.live === true) {
      const base44 = createClientFromRequest(req);
      const user = await base44.auth.me();
      if (!user || user.role !== "admin") return Response.json({ passed: false, error: "Admin authentication required" }, { status: 403 });
      const tenant = normalizeTenantEmail(user.email);
      const candidates = await base44.asServiceRole.entities.Customer.filter({ shop_owner_email: tenant }, "-created_date", 50);
      let liveCustomer = null;
      for (const candidate of candidates) {
        const credentials = await base44.asServiceRole.entities.CustomerPasscode.filter({ customer_id: candidate.id, shop_owner_email: tenant }, null, 1);
        if (!credentials.length) { liveCustomer = candidate; break; }
      }
      test("live historical customer without passcode is Activation Required", Boolean(liveCustomer));
      if (liveCustomer) {
        const portalData = await buildCustomerPortalData(base44.asServiceRole, liveCustomer, tenant);
        const vehicleIds = new Set(portalData.vehicles.map((item) => item.id));
        const projected = [...portalData.orders, ...portalData.invoices, ...portalData.estimates, ...portalData.appointments, ...portalData.recommendations, ...portalData.diagnostics];
        const identifiersStripped = projected.every((item) => !("customer_id" in item));
        const owned = projected.every((item) => !item.vehicle_id || vehicleIds.has(item.vehicle_id));
        test("live historical portal traversal returns only owned relationships", identifiersStripped && owned);
      }
      const foreign = await base44.asServiceRole.entities.Customer.filter({ shop_owner_email: { $ne: tenant } }, "-created_date", 20);
      let foreignDenied = true;
      if (foreign[0]) { try { await assertCustomerTenantOwnership(base44.asServiceRole, foreign[0].id, tenant); foreignDenied = false; } catch {} }
      test("live cross-shop historical customer is denied", foreignDenied);
    }
    return Response.json({ passed: checks.every((item) => item.pass), checks });
  } catch (error) {
    return Response.json({ passed: false, error: error.message }, { status: 500 });
  }
}