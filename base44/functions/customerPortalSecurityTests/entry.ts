import { assertCustomerTenantOwnership, findTenantCustomersByPhone, hardQuarantineCustomer, hashPasscode, normalizePhone, normalizeTenantEmail, projectSafeRecord, randomToken, requireCustomerSession, safeEstimateLaborItems, safeEstimatePartsItems, safeInvoiceLineItems, safePayments, sessionIsActive, sha256, validateNewPasscode, verifyPasscode } from "../../shared/customerPortalSecurity.ts";
import { estimateDecisionState, priorDecisionResult } from "../../shared/customerFinancialDecision.ts";

export default async function() {
  try {
    const checks = [];
    const test = (name, pass) => checks.push({ name, pass: Boolean(pass) });
    test("normalizes North American 10 digits", normalizePhone("(613) 555-0199") === "6135550199");
    test("normalizes leading country code", normalizePhone("1-613-555-0199") === "6135550199");
    test("rejects partial phone", normalizePhone("5550199") === "");
    test("normalizes tenant email", normalizeTenantEmail(" Shop@Example.COM ") === "shop@example.com");
    test("rejects repeated passcode", !validateNewPasscode("111111"));
    test("rejects sequential passcode", !validateNewPasscode("123456"));
    test("accepts non-trivial passcode", validateNewPasscode("864209"));
    const passcodeResult = await hashPasscode("864209", "00112233445566778899aabbccddeeff");
    test("PBKDF2 verifies correct passcode", await verifyPasscode("864209", passcodeResult.salt, passcodeResult.hash));
    test("PBKDF2 rejects wrong passcode", !(await verifyPasscode("864208", passcodeResult.salt, passcodeResult.hash)));
    test("opaque token has high entropy length", randomToken(32).length === 64);
    test("SHA-256 token hashing is deterministic", await sha256("token") === await sha256("token"));
    const now = Date.now();
    test("expired session rejected", !sessionIsActive({ revoked: false, expires_at: new Date(now - 1).toISOString() }, now));
    test("revoked session rejected", !sessionIsActive({ revoked: true, expires_at: new Date(now + 10000).toISOString() }, now));
    test("active session accepted", sessionIsActive({ revoked: false, expires_at: new Date(now + 10000).toISOString() }, now));
    const tenant = "shop@example.com";
    const makeMock = (session) => ({ asServiceRole: { entities: {
      CustomerPortalSession: { filter: async () => [session], update: async () => ({}) },
      CustomerPasscode: { filter: async () => [{ portal_access_enabled: true }] },
      PortalOwnershipQuarantine: { filter: async () => [] },
      Customer: { get: async () => ({ id: "customer-a", shop_owner_email: tenant }) },
    } } });
    const request = new Request("https://test.local", { method: "POST", headers: { Authorization: "Bearer opaque-test-token", "Content-Type": "application/json" }, body: JSON.stringify({ customer_id: "forged-customer-b", shop_email: "other@example.com" }) });
    let expiredRejected = false;
    try { await requireCustomerSession(makeMock({ customer_id: "customer-a", shop_owner_email: tenant, revoked: false, expires_at: new Date(now - 1).toISOString() }), request); } catch { expiredRejected = true; }
    test("requireCustomerSession rejects expired record", expiredRejected);
    let revokedRejected = false;
    try { await requireCustomerSession(makeMock({ customer_id: "customer-a", shop_owner_email: tenant, revoked: true, expires_at: new Date(now + 10000).toISOString() }), request); } catch { revokedRejected = true; }
    test("requireCustomerSession rejects revoked record", revokedRejected);
    const derived = await requireCustomerSession(makeMock({ id: "session-record", session_id: "safe-session-id", customer_id: "customer-a", shop_owner_email: tenant, revoked: false, expires_at: new Date(now + 10000).toISOString() }), request);
    test("forged payload identity is ignored", derived.session.customer_id === "customer-a" && derived.session.shop_owner_email === tenant);
    let tenantDenied = false;
    try { await assertCustomerTenantOwnership({ entities: { PortalOwnershipQuarantine: { filter: async () => [] }, Customer: { get: async () => ({ id: "customer-b", shop_owner_email: "other@example.com" }) } } }, "customer-b", tenant); } catch { tenantDenied = true; }
    test("cross-tenant customer ownership denied", tenantDenied);
    const quarantinedCustomer = { id: "customer-a", phone: "6135550199", shop_owner_email: tenant };
    const quarantinedSr = { entities: { PortalOwnershipQuarantine: { filter: async () => [{ id: "q1", active: true }] }, Customer: { get: async () => quarantinedCustomer } } };
    const lookupSr = { entities: { ...quarantinedSr.entities, User: { filter: async () => [{ id: "u1" }] }, Customer: { ...quarantinedSr.entities.Customer, filter: async () => [quarantinedCustomer] } } };
    const quarantinedMatches = await findTenantCustomersByPhone(lookupSr, tenant, "6135550199");
    test("active quarantine blocks activation and login lookup", quarantinedMatches.length === 0);
    let setupDenied = false;
    try { await assertCustomerTenantOwnership(quarantinedSr, "customer-a", tenant); } catch { setupDenied = true; }
    test("active quarantine blocks passcode setup", setupDenied);
    const quarantinedSession = makeMock({ id: "session-record", customer_id: "customer-a", shop_owner_email: tenant, revoked: false, expires_at: new Date(now + 10000).toISOString() });
    quarantinedSession.asServiceRole.entities.PortalOwnershipQuarantine.filter = async () => [{ id: "q1", active: true }];
    let sessionDenied = false;
    try { await requireCustomerSession(quarantinedSession, request); } catch { sessionDenied = true; }
    test("active quarantine blocks session validation and portal data", sessionDenied);
    const writes = { sessions: [], passcodes: [] };
    const quarantineMock = { entities: {
      PortalOwnershipQuarantine: { filter: async () => [], create: async () => ({ id: "q1" }) },
      CustomerPortalSession: { filter: async () => [{ id: "s1" }], bulkUpdate: async (rows) => { writes.sessions.push(...rows); } },
      CustomerPasscode: { filter: async () => [{ id: "p1", portal_access_enabled: true }], bulkUpdate: async (rows) => { writes.passcodes.push(...rows); } },
      CustomerSecurityEvent: { create: async () => ({}) },
    } };
    await hardQuarantineCustomer(quarantineMock, new Request("https://test.local"), "customer-a", "no_authoritative_tenant_evidence", { tenants: [] }, tenant, "test");
    test("quarantine revokes sessions and disables passcodes", writes.sessions[0]?.revoked === true && writes.passcodes[0]?.portal_access_enabled === false);
    const safe = projectSafeRecord({ id: "1", status: "paid", technician_notes: "private", discount: 99, cost_price: 10, customer_id: "secret" }, ["id", "status"]);
    test("customer response strips internal fields", safe.id === "1" && safe.status === "paid" && !("technician_notes" in safe) && !("discount" in safe) && !("cost_price" in safe) && !("customer_id" in safe));
    const labor = safeEstimateLaborItems([{ description: "Brake service", hours: 2, rate: 120, total: 240, cost_price: 40, markup: 3, technician_note: "private" }])[0];
    const parts = safeEstimatePartsItems([{ name: "Pad", part_number: "P1", quantity: 1, unit_price: 80, total: 80, supplier_cost: 20, markup_formula: "private" }])[0];
    const lines = safeInvoiceLineItems([{ description: "Brake service", type: "labor", quantity: 2, unit_price: 120, total: 240, source: "private", cost: 10 }])[0];
    const payments = safePayments([{ date: "2026-08-01", amount: 50, method: "card", note: "cashier-private", cashier_name: "private" }])[0];
    test("nested estimate labor fields are allowlisted", labor.description === "Brake service" && !("cost_price" in labor) && !("markup" in labor) && !("technician_note" in labor));
    test("nested estimate parts fields are allowlisted", parts.name === "Pad" && !("supplier_cost" in parts) && !("markup_formula" in parts));
    test("nested invoice and payment fields are allowlisted", lines.total === 240 && !("source" in lines) && !("cost" in lines) && payments.amount === 50 && !("note" in payments) && !("cashier_name" in payments));
    const future = new Date(Date.now() + 86400000).toISOString().slice(0, 10); const past = "2020-01-01";
    test("sent estimate decision is allowed", estimateDecisionState({ status: "sent", valid_until: future }).allowed);
    for (const status of ["draft", "approved", "declined", "invoiced", "cancelled"]) test(`${status} estimate decision is rejected`, !estimateDecisionState({ status, valid_until: future }).allowed);
    test("expired estimate decision is rejected", !estimateDecisionState({ status: "sent", valid_until: past }).allowed && estimateDecisionState({ status: "sent", valid_until: past }).currentStatus === "expired");
    test("explicit pending authorization maps to sent eligibility", estimateDecisionState({ status: "draft", auth_status: "pending", valid_until: future }).allowed);
    const event = { estimate_id: "estimate-a", action: "estimate_approved", session_id: "session-a" };
    test("matching decision replay is idempotent", priorDecisionResult([event], "estimate-a", "estimate_approved", "session-a") === "replay");
    test("cross-document decision key mismatch is rejected", priorDecisionResult([event], "estimate-b", "estimate_approved", "session-a") === "mismatch");
    return Response.json({ passed: checks.every((item) => item.pass), checks });
  } catch (error) {
    return Response.json({ passed: false, error: error.message }, { status: 500 });
  }
}