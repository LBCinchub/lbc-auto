import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { buildCustomerPortalData, requireCustomerSession, sha256 } from "../../shared/customerPortalSecurity.ts";
import { estimateDecisionState, priorDecisionResult } from "../../shared/customerFinancialDecision.ts";

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const auth = await requireCustomerSession(base44, req);
    const body = await req.json();
    const decision = body.decision === "approve" ? "approved" : body.decision === "decline" ? "declined" : "";
    if (!decision || body.confirmed !== true) return Response.json({ error: "Confirm a valid estimate decision" }, { status: 400 });
    const signer = String(body.signer_name || "").trim().slice(0, 120);
    const note = String(body.note || "").trim().slice(0, 1000);
    const key = String(body.idempotency_key || "").trim().slice(0, 160);
    if (signer.length < 2 || key.length < 16) return Response.json({ error: "Signer name and decision reference are required" }, { status: 400 });
    const portal = await buildCustomerPortalData(auth.sr, auth.customer, auth.session.shop_owner_email);
    const estimate = portal.estimates.find((item) => item.id === body.estimate_id);
    if (!estimate) return Response.json({ error: "Document unavailable" }, { status: 404 });
    const eventAction = decision === "approved" ? "estimate_approved" : "estimate_declined";
    const prior = await auth.sr.entities.FinancialWorkflowEvent.filter({ shop_owner_email: auth.session.shop_owner_email, idempotency_key: key }, "-created_at", 5);
    const priorState = priorDecisionResult(prior, estimate.id, eventAction, auth.session.session_id);
    if (priorState === "mismatch") return Response.json({ error: "Decision reference unavailable", current_status: estimate.status }, { status: 409 });
    if (priorState === "replay") return Response.json({ success: true, replay: true, status: estimate.status, next_step: estimate.status === "approved" ? "shop_convert_to_repair_order" : "shop_review_decline", message: estimate.status === "approved" ? "Estimate approved. Your shop can now convert the approved work into a Repair Order." : "Estimate declined. The shop has been notified in the workflow record." });
    const decisionState = estimateDecisionState(estimate);
    if (!decisionState.allowed) {
      if (decisionState.currentStatus === "expired" && estimate.status === "sent") await auth.sr.entities.Estimate.update(estimate.id, { status: "expired" });
      return Response.json({ error: "Estimate is no longer available for this decision", current_status: decisionState.currentStatus }, { status: 409 });
    }
    const now = new Date().toISOString();
    const reference = await sha256(`${auth.session.session_id}:${estimate.id}:${decision}:${key}`);
    await auth.sr.entities.Estimate.update(estimate.id, { status: decision, auth_status: decision, customer_decision: decision, customer_decision_at: now, customer_decision_name: signer, customer_decision_note: note || undefined, customer_decision_reference: reference });
    await auth.sr.entities.FinancialWorkflowEvent.create({ shop_owner_email: auth.session.shop_owner_email, action: eventAction, customer_id: auth.session.customer_id, estimate_id: estimate.id, source_type: "estimate", source_id: estimate.id, session_id: auth.session.session_id, idempotency_key: key, created_at: now, actor_email: auth.session.shop_owner_email, metadata: { actor: "customer_portal", decision, note_supplied: Boolean(note) } });
    return Response.json({ success: true, status: decision, customer_decision_at: now, customer_decision_name: signer, customer_decision_note: note, next_step: decision === "approved" ? "shop_convert_to_repair_order" : "shop_review_decline", message: decision === "approved" ? "Estimate approved. Your shop can now convert the approved work into a Repair Order." : "Estimate declined. The shop has been notified in the workflow record." });
  } catch (error) {
    const sessionError = ["SESSION_REQUIRED", "AUTHORIZATION_DENIED", "CUSTOMER_HARD_QUARANTINED"].includes(error?.message);
    return Response.json({ error: sessionError ? "Session expired or unavailable" : "Financial decision unavailable" }, { status: sessionError ? 401 : 500 });
  }
}