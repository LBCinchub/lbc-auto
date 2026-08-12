import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { upsertLineItems } from "../../shared/lineItemLibrary.ts";

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin" && !user.business_name) {
      return Response.json({ error: "Owner or admin access required" }, { status: 403 });
    }
    const body = await req.json();
    const tenant = String(user.email || "").toLowerCase();
    await upsertLineItems(base44, tenant, body.line_items || []);
    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error?.message || "Line item sync failed" }, { status: 400 });
  }
}