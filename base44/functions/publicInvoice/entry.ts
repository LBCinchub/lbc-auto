import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    await base44.auth.me();
    return Response.json({ error: "Document unavailable" }, { status: 404 });
  } catch {
    return Response.json({ error: "Document unavailable" }, { status: 404 });
  }
}