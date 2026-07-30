import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { auditEvent, findTenantCustomersByPhone, getRequestMeta, normalizePhone, normalizeTenantEmail, randomActivationCode, sendActivationSms, sha256 } from "../../shared/customerPortalSecurity.ts";

const GENERIC = { success: true, message: "If access is available, activation instructions will be provided through the configured channel." };

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;
    const body = await req.json();
    const tenant = normalizeTenantEmail(body.shop_identifier || body.shop_email);
    const phone = normalizePhone(body.phone);
    if (!tenant || !phone) return Response.json(GENERIC);
    const phoneHash = await sha256(`${tenant}:${phone}`);
    const requestMeta = getRequestMeta(req);
    const ipHash = await sha256(`${tenant}:${requestMeta.ip || "unknown"}`);
    const recent = await sr.entities.CustomerSecurityEvent.filter({ shop_owner_email: tenant, event_type: "activation_code_issued" }, "-created_at", 100);
    const cutoff = Date.now() - 15 * 60 * 1000;
    const active = recent.filter((e) => new Date(e.created_at).getTime() > cutoff);
    if (active.filter((e) => e.metadata?.phone_hash === phoneHash).length >= 3 || active.filter((e) => e.metadata?.ip_hash === ipHash).length >= 10) return Response.json(GENERIC);
    const matches = await findTenantCustomersByPhone(sr, tenant, phone);
    const emailConfirmation = normalizeTenantEmail(body.email_confirmation);
    const eligible = emailConfirmation ? matches.filter((c) => normalizeTenantEmail(c.email) === emailConfirmation) : matches;
    if (eligible.length !== 1) return Response.json(GENERIC);
    const customer = eligible[0];
    const passcodes = await sr.entities.CustomerPasscode.filter({ customer_id: customer.id, shop_owner_email: tenant }, "-updated_at", 2);
    if (passcodes.length === 1 && passcodes[0].portal_access_enabled === false) return Response.json(GENERIC);
    const code = randomActivationCode();
    const shops = await sr.entities.User.filter({ email: tenant }, null, 1);
    const sent = await sendActivationSms(phone, code, shops[0]?.business_name || "Your auto shop");
    await sr.entities.PortalActivationCode.create({ customer_id: customer.id, shop_owner_email: tenant, code_hash: await sha256(code), created_at: new Date().toISOString(), expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), issued_by: "customer_request", delivery_method: sent ? "sms" : "shop_issued", attempts: 0, revoked: false });
    await auditEvent(sr, req, "activation_code_issued", { customerId: customer.id, shopOwnerEmail: tenant, metadata: { delivery_method: sent ? "sms" : "shop_issued", phone_hash: phoneHash, ip_hash: ipHash } });
    return Response.json(GENERIC);
  } catch {
    return Response.json(GENERIC);
  }
}