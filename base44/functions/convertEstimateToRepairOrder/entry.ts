import { createClientFromRequest } from "npm:@base44/sdk@0.8.57";
import { convertEstimate, HttpError } from "../../shared/convertEstimateCore.ts";
import { LeaseBusyError } from "../../shared/recordLease.ts";

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin" && !user.business_name) return Response.json({ error: "Owner access required" }, { status: 403 });
    const { estimate_id } = await req.json();
    const result = await convertEstimate({ svc: base44.asServiceRole.entities, db: base44.entities, user, estimateId: estimate_id });
    return Response.json(result);
  } catch (error) {
    if (error instanceof HttpError) return Response.json({ error: error.message }, { status: error.status });
    if (error instanceof LeaseBusyError) return Response.json({ error: error.message }, { status: 409 });
    const missing = /not found/i.test(error?.message || "");
    return Response.json({ error: missing ? "Estimate unavailable" : "Conversion unavailable" }, { status: missing ? 404 : 400 });
  }
}