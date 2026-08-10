import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { reportCounts, runLegacyOwnershipScan } from "../../shared/legacyPortalMigration.ts";

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin" && user.role !== "owner") return Response.json({ error: "Forbidden" }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const mode = body.mode === "apply" ? "apply" : "dry_run";
    if (mode === "apply" && body.confirm !== "APPLY_SAFE_BACKFILLS") return Response.json({ error: "Explicit confirmation required" }, { status: 400 });
    const sr = base44.asServiceRole;
    const report = await runLegacyOwnershipScan(sr, mode, user.email);
    const ownershipEvidence = report.ownership_evidence;
    for (const summary of Object.values(ownershipEvidence)) {
      if (summary.tenants.length > 1) for (const group of summary.tenants) for (const record of group.records) report.conflicting_related_records.push({ entity: record.type, id: record.id, reason: "authoritative_tenant_conflict" });
      for (const record of summary.relationship_conflicts) report.conflicting_related_records.push({ entity: record.type, id: record.id, reason: "relationship_points_to_multiple_customers" });
    }
    report.conflicting_related_records = [...new Map(report.conflicting_related_records.map((item) => [`${item.entity}:${item.id}:${item.reason}`, item])).values()];
    return Response.json({ success: true, counts: reportCounts(report), review: { ambiguous_customer_ids: report.ambiguous_customer_ids, hard_quarantined_customer_ids: report.hard_quarantined_customer_ids, unresolved_unscoped_customer_ids: report.unresolved_unscoped_customer_ids, conflicting_related_records: report.conflicting_related_records, orphaned_relationships: report.orphaned_relationships, skipped_records: report.skipped_records, ownership_evidence: ownershipEvidence } });
  } catch (error) {
    return Response.json({ error: error.message || "Migration scan failed" }, { status: 500 });
  }
}