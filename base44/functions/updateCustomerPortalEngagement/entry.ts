import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { requireCustomerSession } from "../../shared/customerPortalSecurity.ts";

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const auth = await requireCustomerSession(base44, req);
    const body = await req.json();
    if (body.action === "review") {
      const rating = Number(body.rating);
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) return Response.json({ error: "Invalid rating" }, { status: 400 });
      const existing = await auth.sr.entities.CustomerReview.filter({ customer_id: auth.session.customer_id, shop_owner_email: auth.session.shop_owner_email }, "-created_date", 2);
      const values = { shop_owner_email: auth.session.shop_owner_email, customer_id: auth.session.customer_id, customer_name: auth.customer.full_name || "Customer", rating, review_text: String(body.review_text || "").slice(0, 2000), is_published: true };
      const review = existing[0] ? await auth.sr.entities.CustomerReview.update(existing[0].id, values) : await auth.sr.entities.CustomerReview.create(values);
      return Response.json({ success: true, review });
    }
    const offers = await auth.sr.entities.ShopOffer.filter({ id: body.offer_id, shop_owner_email: auth.session.shop_owner_email, is_active: true }, null, 2);
    if (offers.length !== 1) return Response.json({ error: "Unavailable" }, { status: 404 });
    const offer = offers[0];
    if (body.action === "reaction") {
      const allowed = ["thumbsup", "fire", "heart", "wow"];
      if (!allowed.includes(body.reaction)) return Response.json({ error: "Invalid reaction" }, { status: 400 });
      const reactions = { ...(offer.reactions || {}), [body.reaction]: (offer.reactions?.[body.reaction] || 0) + 1 };
      await auth.sr.entities.ShopOffer.update(offer.id, { reactions });
      return Response.json({ success: true, reactions });
    }
    if (body.action === "comment") {
      const text = String(body.text || "").trim().slice(0, 1000);
      if (!text) return Response.json({ error: "Comment required" }, { status: 400 });
      const comment = { customer_name: auth.customer.full_name || "Customer", text, created_at: new Date().toISOString() };
      const comments = [...(offer.comments || []), comment];
      await auth.sr.entities.ShopOffer.update(offer.id, { comments });
      return Response.json({ success: true, comment });
    }
    return Response.json({ error: "Unsupported action" }, { status: 400 });
  } catch {
    return Response.json({ error: "Session expired or unavailable" }, { status: 401 });
  }
}