import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { auditEvent, hardQuarantineCustomer, normalizeTenantEmail, resolveCustomerFromEvidence } from "../../shared/customerPortalSecurity.ts";
import { collectAuthoritativeTenantEvidence } from "../../shared/portalOwnershipEvidence.ts";

const PLATFORM_OWNER = "mokhtartareksamara@gmail.com";
const QUARANTINE_REASONS = new Set(["no_authoritative_tenant_evidence", "conflicting_tenant_evidence", "test_or_anonymous_record", "manual_security_hold"]);

const RELATED = ["Vehicle", "RepairOrder", "Estimate", "Invoice", "Appointment", "CustomerMessage", "CustomerNotification", "CarRecommendation", "CustomerReview", "DiagnosticScan"];

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin" && user.role !== "owner") return Response.json({ error: "Forbidden" }, { status: 403 });
    const sr = base44.asServiceRole;
    const body = await req.json();
    const tenant = normalizeTenantEmail(user.email);
    const action = String(body.action || "");
    const isPlatformOwner = tenant === PLATFORM_OWNER;
    if (["assign_from_relationship_evidence", "hard_quarantine_unscoped_customer"].includes(action) && !isPlatformOwner) return Response.json({ error: "Platform owner authorization required" }, { status: 403 });
    if (action === "acknowledge_quarantine") {
      if (!RELATED.includes(body.entity) || !body.record_id) return Response.json({ error: "Invalid record" }, { status: 400 });
      const record = await sr.entities[body.entity].get(body.record_id);
      if (!record) return Response.json({ error: "Not found" }, { status: 404 });
      await auditEvent(sr, req, "ownership_resolved", { shopOwnerEmail: tenant, metadata: { action, entity: body.entity, record_id: body.record_id, outcome: "kept_quarantined" } });
      return Response.json({ success: true, outcome: "kept_quarantined" });
    }
    let customer = null;
    try { customer = await sr.entities.Customer.get(body.customer_id); } catch { return Response.json({ error: "Not found" }, { status: 404 }); }
    if (!customer) return Response.json({ error: "Not found" }, { status: 404 });
    if (action === "assign_from_relationship_evidence") {
      const evidence = await collectAuthoritativeTenantEvidence(sr, customer.id);
      if (!evidence.supported_tenant) return Response.json({ error: evidence.tenants.length ? "Conflicting authoritative tenant evidence" : "No authoritative tenant evidence", evidence: evidence.evidence_summary }, { status: 409 });
      const resolvedTenant = await resolveCustomerFromEvidence(sr, req, customer, evidence, tenant);
      return Response.json({ success: true, resolved_tenant: resolvedTenant, evidence: evidence.evidence_summary });
    }
    if (action === "hard_quarantine_unscoped_customer") {
      if (!QUARANTINE_REASONS.has(body.reason)) return Response.json({ error: "Invalid quarantine reason" }, { status: 400 });
      const evidence = await collectAuthoritativeTenantEvidence(sr, customer.id);
      if (evidence.supported_tenant) return Response.json({ error: "A single authoritative tenant exists; quarantine is not permitted" }, { status: 409 });
      const hasConflict = evidence.tenants.length > 1 || evidence.relationship_conflicts.length > 0;
      if (body.reason === "no_authoritative_tenant_evidence" && hasConflict) return Response.json({ error: "Conflicting evidence requires the conflicting-evidence quarantine reason" }, { status: 409 });
      if (body.reason === "conflicting_tenant_evidence" && !hasConflict) return Response.json({ error: "No conflicting evidence was found" }, { status: 409 });
      const access = await hardQuarantineCustomer(sr, req, customer.id, body.reason, evidence.evidence_summary, tenant, body.review_notes);
      return Response.json({ success: true, outcome: "hard_quarantined", evidence: evidence.evidence_summary, access });
    }
    const explicit = normalizeTenantEmail(customer.shop_owner_email);
    let creator = normalizeTenantEmail(customer.created_by);
    if (!creator && customer.created_by_id) {
      const creatorUser = await sr.entities.User.get(customer.created_by_id);
      const isShopProfile = creatorUser && (creatorUser.business_name || creatorUser.subscription_status || creatorUser.trial_started_date || creatorUser.setup_fee_paid || creatorUser.plan_tier);
      if (isShopProfile) creator = normalizeTenantEmail(creatorUser.email);
    }
    let resolvedTenant = "";
    let resolutionType = "";
    if (action === "confirm_explicit" && explicit === tenant && creator && creator !== tenant) { resolvedTenant = tenant; resolutionType = action; }
    if (action === "confirm_creator" && creator === tenant && explicit && explicit !== tenant) { resolvedTenant = tenant; resolutionType = action; }
    if (!resolvedTenant) return Response.json({ error: "Resolution is not permitted for this shop" }, { status: 403 });
    const active = await sr.entities.PortalOwnershipResolution.filter({ customer_id: customer.id, active: true }, "-resolved_at", 50);
    if (active.length) await sr.entities.PortalOwnershipResolution.bulkUpdate(active.map((item) => ({ id: item.id, active: false })));
    await sr.entities.PortalOwnershipResolution.create({ customer_id: customer.id, resolved_tenant: resolvedTenant, resolution_type: resolutionType, resolved_by: tenant, resolved_at: new Date().toISOString(), active: true });
    await auditEvent(sr, req, "ownership_resolved", { customerId: customer.id, shopOwnerEmail: tenant, metadata: { action: resolutionType } });
    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message || "Resolution failed" }, { status: 500 });
  }
}