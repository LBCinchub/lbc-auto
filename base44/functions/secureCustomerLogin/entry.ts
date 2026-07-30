import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { GENERIC_AUTH_ERROR, auditEvent, findTenantCustomersByPhone, issueSession, normalizePhone, normalizeTenantEmail, verifyPasscode } from "../../shared/customerPortalSecurity.ts";

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;
    const body = await req.json();
    const tenant = normalizeTenantEmail(body.shop_identifier || body.shop_email);
    const phone = normalizePhone(body.phone);
    const passcode = String(body.passcode || "");
    if (!tenant || !phone || !passcode) return Response.json({ error: GENERIC_AUTH_ERROR }, { status: 401 });
    const customers = await findTenantCustomersByPhone(sr, tenant, phone);
    const verified = [];
    const attemptedRecords = [];
    for (const customer of customers) {
      const records = await sr.entities.CustomerPasscode.filter({ customer_id: customer.id, shop_owner_email: tenant }, "-updated_at", 2);
      if (records.length !== 1) continue;
      const record = records[0];
      if (record.portal_access_enabled === false || (record.locked_until && new Date(record.locked_until).getTime() > Date.now())) continue;
      attemptedRecords.push(record);
      if (await verifyPasscode(passcode, record.passcode_salt, record.passcode_hash)) verified.push({ customer, record });
    }
    if (verified.length !== 1) {
      if (attemptedRecords.length) {
        const now = new Date().toISOString();
        const updates = attemptedRecords.map((record) => {
          const failures = (record.failed_attempts || 0) + 1;
          return { id: record.id, failed_attempts: failures, locked_until: failures >= 5 ? new Date(Date.now() + 30 * 60 * 1000).toISOString() : "1970-01-01T00:00:00.000Z", updated_at: now };
        });
        await sr.entities.CustomerPasscode.bulkUpdate(updates);
        const maxFailures = Math.max(...updates.map((item) => item.failed_attempts));
        await auditEvent(sr, req, maxFailures >= 5 ? "lockout" : "login_failed", { shopOwnerEmail: tenant, metadata: { failed_attempts: maxFailures, profiles_checked: updates.length } });
      } else {
        await auditEvent(sr, req, "login_failed", { shopOwnerEmail: tenant });
      }
      const delayLevel = attemptedRecords.length ? Math.max(...attemptedRecords.map((record) => record.failed_attempts || 0)) + 1 : 1;
      await new Promise((resolve) => setTimeout(resolve, Math.min(1200, 150 * delayLevel)));
      return Response.json({ error: GENERIC_AUTH_ERROR }, { status: 401 });
    }
    const { customer, record } = verified[0];
    await sr.entities.CustomerPasscode.update(record.id, { failed_attempts: 0, locked_until: "1970-01-01T00:00:00.000Z", updated_at: new Date().toISOString() });
    const issued = await issueSession(sr, req, customer.id, tenant);
    await auditEvent(sr, req, "login_success", { customerId: customer.id, shopOwnerEmail: tenant, sessionId: issued.sessionId });
    await auditEvent(sr, req, "session_issued", { customerId: customer.id, shopOwnerEmail: tenant, sessionId: issued.sessionId });
    const shops = await sr.entities.User.filter({ email: tenant }, null, 1);
    return Response.json({ success: true, token: issued.token, expires_at: issued.expiresAt, customer: { display_name: customer.full_name || "Customer" }, shop: { display_name: shops[0]?.business_name || "Auto Shop" } }, { headers: { "Set-Cookie": `lbc_customer_session=${issued.token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=28800` } });
  } catch {
    return Response.json({ error: GENERIC_AUTH_ERROR }, { status: 401 });
  }
}