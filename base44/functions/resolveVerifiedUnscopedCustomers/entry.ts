import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { collectAuthoritativeTenantEvidence } from "../../shared/portalOwnershipEvidence.ts";
import { hardQuarantineCustomer, normalizeTenantEmail, resolveCustomerFromEvidence } from "../../shared/customerPortalSecurity.ts";

const OWNER = "mokhtartareksamara@gmail.com";
const HAJ = "hajwheels@gmail.com";
const RESOLVE_IDS = ["6a4bc2189d103b7f802da00d","6a4bc5903c7ca31dfac70e19","6a4bc613a5fe4c55b28fd322","6a4bc73f9816e5d6700ce0fc","6a4bc7d48f9fa7547cbc3752","6a4bcd39e94206092868b49e"];
const QUARANTINE_IDS = ["6a2071eea4897ad14f94e0af","6a207225ef0674c362296f0f","6a4afe341dabb85dcddc6c55","6a4afe3c4a47e24cd2b0c61c","6a4afe4303e8c0ee135379d3","6a4afe7465c97bce91d90633","6a4afe7f64dfb535e9337ddc","6a4bc09153ad068def47301f","6a4bc174f7d251bd5a108d74","6a4bc18ecdee9ddf31f51af5","6a4bc665025106b838b58d60"];

async function collectWithRateLimitRetry(sr, customerId) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try { return await collectAuthoritativeTenantEvidence(sr, customerId); }
    catch (error) {
      if (!String(error.message || "").toLowerCase().includes("rate limit") || attempt === 3) throw error;
      await new Promise((resolve) => setTimeout(resolve, 750 * (attempt + 1)));
    }
  }
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin" || normalizeTenantEmail(user.email) !== OWNER) return Response.json({ error: "Forbidden" }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const mode = body.mode === "apply" ? "apply" : "dry_run";
    if (mode === "apply" && body.confirm !== "RESOLVE_VERIFIED_17") return Response.json({ error: "Explicit confirmation required" }, { status: 400 });
    const sr = base44.asServiceRole;
    const counts = { resolved_to_haj: 0, hard_quarantined: 0, changed_since_audit: 0, failed: 0, untouched: 0 };
    const results = [];
    for (const customerId of [...RESOLVE_IDS, ...QUARANTINE_IDS]) {
      try {
        const customer = await sr.entities.Customer.get(customerId);
        const evidence = await collectWithRateLimitRetry(sr, customerId);
        if (RESOLVE_IDS.includes(customerId)) {
          if (evidence.supported_tenant !== HAJ) { counts.changed_since_audit += 1; results.push({ customer_id: customerId, outcome: "changed_since_audit", evidence: evidence.evidence_summary }); continue; }
          const resolutions = await sr.entities.PortalOwnershipResolution.filter({ customer_id: customerId, resolution_type: "relationship_evidence", resolved_tenant: HAJ, active: true }, "-resolved_at", 2);
          if (normalizeTenantEmail(customer.shop_owner_email) === HAJ && resolutions.length === 1) { counts.untouched += 1; results.push({ customer_id: customerId, outcome: "untouched" }); continue; }
          counts.resolved_to_haj += 1;
          if (mode === "apply") await resolveCustomerFromEvidence(sr, req, customer, evidence, OWNER);
          results.push({ customer_id: customerId, outcome: mode === "apply" ? "resolved_to_haj" : "would_resolve_to_haj", evidence: evidence.evidence_summary });
        } else {
          if (evidence.tenants.length || evidence.relationship_conflicts.length) { counts.changed_since_audit += 1; results.push({ customer_id: customerId, outcome: "changed_since_audit", evidence: evidence.evidence_summary }); continue; }
          const quarantines = await sr.entities.PortalOwnershipQuarantine.filter({ customer_id: customerId, active: true }, "-created_at", 2);
          if (quarantines.length === 1) { counts.untouched += 1; results.push({ customer_id: customerId, outcome: "untouched" }); continue; }
          counts.hard_quarantined += 1;
          if (mode === "apply") await hardQuarantineCustomer(sr, req, customerId, "no_authoritative_tenant_evidence", evidence.evidence_summary, OWNER, "Verified migration set: no authoritative tenant evidence");
          results.push({ customer_id: customerId, outcome: mode === "apply" ? "hard_quarantined" : "would_hard_quarantine", evidence: evidence.evidence_summary });
        }
      } catch (error) { counts.failed += 1; results.push({ customer_id: customerId, outcome: "failed", error: String(error.message || "Failed") }); }
    }
    return Response.json({ success: true, mode, counts, changes_applied: mode === "apply" ? counts.resolved_to_haj + counts.hard_quarantined : 0, results });
  } catch (error) { return Response.json({ error: error.message || "Verified resolution failed" }, { status: 500 }); }
}