import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { GENERIC_AUTH_ERROR, auditEvent, hashPasscode, requireCustomerSession, revokeSessions, validateNewPasscode, verifyPasscode } from "../../shared/customerPortalSecurity.ts";

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const auth = await requireCustomerSession(base44, req);
    const body = await req.json();
    if (!validateNewPasscode(body.new_passcode)) return Response.json({ error: "Passcode must be 6–12 non-trivial digits" }, { status: 400 });
    const records = await auth.sr.entities.CustomerPasscode.filter({ customer_id: auth.session.customer_id, shop_owner_email: auth.session.shop_owner_email }, "-updated_at", 2);
    if (records.length !== 1 || !(await verifyPasscode(body.current_passcode, records[0].passcode_salt, records[0].passcode_hash))) return Response.json({ error: GENERIC_AUTH_ERROR }, { status: 401 });
    const derived = await hashPasscode(body.new_passcode);
    await auth.sr.entities.CustomerPasscode.update(records[0].id, { passcode_hash: derived.hash, passcode_salt: derived.salt, failed_attempts: 0, locked_until: "1970-01-01T00:00:00.000Z", updated_at: new Date().toISOString() });
    await revokeSessions(auth.sr, auth.session.customer_id, auth.session.shop_owner_email, auth.session.session_id);
    await auditEvent(auth.sr, req, "passcode_changed", { customerId: auth.session.customer_id, shopOwnerEmail: auth.session.shop_owner_email, sessionId: auth.session.session_id });
    return Response.json({ success: true });
  } catch {
    return Response.json({ error: GENERIC_AUTH_ERROR }, { status: 401 });
  }
}