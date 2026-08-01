import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { reportCounts, runLegacyOwnershipScan } from "../../shared/legacyPortalMigration.ts";

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const mode = body.mode === "apply" ? "apply" : "dry_run";
    if (mode === "apply" && body.confirm !== "APPLY_SAFE_BACKFILLS") return Response.json({ error: "Explicit confirmation required" }, { status: 400 });
    const report = await runLegacyOwnershipScan(base44.asServiceRole, mode, user.email);
    return Response.json({ success: true, counts: reportCounts(report), review: { ambiguous_customer_ids: report.ambiguous_customer_ids, unscoped_customer_ids: report.unscoped_customer_ids, conflicting_related_records: report.conflicting_related_records, orphaned_relationships: report.orphaned_relationships, skipped_records: report.skipped_records } });
  } catch (error) {
    return Response.json({ error: error.message || "Migration scan failed" }, { status: 500 });
  }
}