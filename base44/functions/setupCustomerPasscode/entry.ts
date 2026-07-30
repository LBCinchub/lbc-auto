import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { GENERIC_AUTH_ERROR, assertCustomerTenantOwnership, auditEvent, hashPasscode, normalizePhone, normalizeTenantEmail, revokeSessions, sha256, validateNewPasscode } from "../../shared/customerPortalSecurity.ts";

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;
    const body = await req.json();
    const tenant = normalizeTenantEmail(body.shop_identifier || body.shop_email);
    const phone = normalizePhone(body.phone);
    const codeHash = await sha256(String(body.activation_code || ""));
    if (!tenant || !phone || !validateNewPasscode(body.new_passcode)) return Response.json({ error: GENERIC_AUTH_ERROR }, { status: 401 });
    const codes = await sr.entities.PortalActivationCode.filter({ shop_owner_email: tenant, code_hash: codeHash, revoked: false }, "-created_at", 2);
    if (codes.length !== 1) return Response.json({ error: GENERIC_AUTH_ERROR }, { status: 401 });
    const code = codes[0];
    if (code.used_at || code.attempts >= 5 || new Date(code.expires_at).getTime() <= Date.now()) return Response.json({ error: GENERIC_AUTH_ERROR }, { status: 401 });
    const customer = await assertCustomerTenantOwnership(sr, code.customer_id, tenant);
    if (normalizePhone(customer.phone) !== phone) {
      await sr.entities.PortalActivationCode.update(code.id, { attempts: (code.attempts || 0) + 1 });
      return Response.json({ error: GENERIC_AUTH_ERROR }, { status: 401 });
    }
    const now = new Date().toISOString();
    const derived = await hashPasscode(body.new_passcode);
    const existing = await sr.entities.CustomerPasscode.filter({ customer_id: customer.id, shop_owner_email: tenant }, "-updated_at", 10);
    if (existing.length) {
      await sr.entities.CustomerPasscode.update(existing[0].id, { passcode_hash: derived.hash, passcode_salt: derived.salt, failed_attempts: 0, locked_until: "1970-01-01T00:00:00.000Z", portal_access_enabled: true, updated_at: now });
      if (existing.length > 1) await sr.entities.CustomerPasscode.deleteMany({ customer_id: customer.id, shop_owner_email: tenant, id: { $ne: existing[0].id } });
    } else {
      await sr.entities.CustomerPasscode.create({ customer_id: customer.id, shop_owner_email: tenant, passcode_hash: derived.hash, passcode_salt: derived.salt, created_at: now, updated_at: now, failed_attempts: 0, portal_access_enabled: true });
    }
    await sr.entities.PortalActivationCode.update(code.id, { used_at: now });
    await revokeSessions(sr, customer.id, tenant);
    await auditEvent(sr, req, "activation_code_used", { customerId: customer.id, shopOwnerEmail: tenant });
    await auditEvent(sr, req, existing.length ? "passcode_changed" : "passcode_created", { customerId: customer.id, shopOwnerEmail: tenant });
    return Response.json({ success: true });
  } catch {
    return Response.json({ error: GENERIC_AUTH_ERROR }, { status: 401 });
  }
}