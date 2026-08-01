import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { assertCustomerTenantOwnership, auditEvent, normalizePhone, normalizeTenantEmail, randomActivationCode, revokeSessions, sha256 } from "../../shared/customerPortalSecurity.ts";

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const sr = base44.asServiceRole;
    const body = await req.json();
    const tenant = normalizeTenantEmail(user.email);
    const customer = await assertCustomerTenantOwnership(sr, body.customer_id, tenant);
    const action = String(body.action || "status");
    const records = await sr.entities.CustomerPasscode.filter({ customer_id: customer.id, shop_owner_email: tenant }, "-updated_at", 10);
    const record = records[0] || null;
    if (action === "status") {
      const sessions = await sr.entities.CustomerPortalSession.filter({ customer_id: customer.id, shop_owner_email: tenant, revoked: false }, "-created_at", 500);
      return Response.json({ enabled: record ? record.portal_access_enabled !== false : false, configured: Boolean(record), activation_required: !record, eligible_for_activation: Boolean(normalizePhone(customer.phone)), failed_attempts: record?.failed_attempts || 0, locked_until: record?.locked_until && new Date(record.locked_until).getTime() > Date.now() ? record.locked_until : null, active_sessions: sessions.filter((s) => new Date(s.expires_at).getTime() > Date.now()).length });
    }
    if (action === "issue_shop_code") {
      if (!normalizePhone(customer.phone)) return Response.json({ error: "A valid customer phone is required" }, { status: 400 });
      const code = randomActivationCode();
      const now = new Date();
      await sr.entities.PortalActivationCode.create({ customer_id: customer.id, shop_owner_email: tenant, code_hash: await sha256(code), created_at: now.toISOString(), expires_at: new Date(now.getTime() + 10 * 60 * 1000).toISOString(), issued_by: user.email, delivery_method: "shop_issued", attempts: 0, revoked: false });
      await auditEvent(sr, req, "activation_code_issued", { customerId: customer.id, shopOwnerEmail: tenant, metadata: { delivery_method: "shop_issued" } });
      return Response.json({ success: true, activation_code: code, expires_at: new Date(now.getTime() + 10 * 60 * 1000).toISOString() });
    }
    if (action === "reset_lockout" && record) await sr.entities.CustomerPasscode.update(record.id, { failed_attempts: 0, locked_until: "1970-01-01T00:00:00.000Z", updated_at: new Date().toISOString() });
    if ((action === "enable" || action === "disable") && record) {
      await sr.entities.CustomerPasscode.update(record.id, { portal_access_enabled: action === "enable", updated_at: new Date().toISOString() });
      if (action === "disable") await revokeSessions(sr, customer.id, tenant);
    }
    if (action === "revoke_sessions") await revokeSessions(sr, customer.id, tenant);
    if (!["reset_lockout", "enable", "disable", "revoke_sessions"].includes(action)) return Response.json({ error: "Unsupported action" }, { status: 400 });
    return Response.json({ success: true });
  } catch {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
}