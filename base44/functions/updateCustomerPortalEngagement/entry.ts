import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { auditEvent, buildCustomerPortalData, requireCustomerSession } from "../../shared/customerPortalSecurity.ts";

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const auth = await requireCustomerSession(base44, req);
    const body = await req.json();
    if (body.action === "notification_read") {
      const portal = await buildCustomerPortalData(auth.sr, auth.customer, auth.session.shop_owner_email);
      const notification = portal.notifications.find((item) => item.id === body.notification_id);
      if (!notification) return Response.json({ error: "Notification unavailable" }, { status: 404 });
      if (!notification.is_read) await auth.sr.entities.CustomerNotification.update(notification.id, { is_read: true });
      return Response.json({ success: true });
    }
    if (body.action === "messages_read") {
      const portal = await buildCustomerPortalData(auth.sr, auth.customer, auth.session.shop_owner_email);
      const unread = portal.messages.filter((item) => item.sender === "shop" && !item.read_by_customer);
      if (unread.length) await auth.sr.entities.CustomerMessage.bulkUpdate(unread.map((item) => ({ id: item.id, read_by_customer: true })));
      return Response.json({ success: true, updated: unread.length });
    }
    if (body.action === "estimate_decision") {
      const decision = body.decision === "approve" ? "approved" : body.decision === "decline" ? "declined" : "";
      if (!decision) return Response.json({ error: "Invalid decision" }, { status: 400 });
      const portal = await buildCustomerPortalData(auth.sr, auth.customer, auth.session.shop_owner_email);
      const estimate = portal.estimates.find((item) => item.id === body.estimate_id);
      if (!estimate) return Response.json({ error: "Estimate unavailable" }, { status: 404 });
      if (["invoiced", "cancelled"].includes(estimate.status)) return Response.json({ error: "This estimate can no longer be changed" }, { status: 409 });
      await auth.sr.entities.Estimate.update(estimate.id, { status: decision, auth_status: decision === "approved" ? "approved" : "none" });
      await auditEvent(auth.sr, req, "estimate_decision", { customerId: auth.session.customer_id, shopOwnerEmail: auth.session.shop_owner_email, sessionId: auth.session.session_id, metadata: { estimate_id: estimate.id, decision } });
      return Response.json({ success: true, status: decision });
    }
    if (body.action === "book_appointment") {
      const portal = await buildCustomerPortalData(auth.sr, auth.customer, auth.session.shop_owner_email);
      const vehicle = portal.vehicles.find((item) => item.id === body.vehicle_id);
      const serviceType = String(body.service_type || "").trim().slice(0, 160);
      const date = String(body.date || ""); const timeSlot = String(body.time_slot || "").trim().slice(0, 60);
      if (!vehicle || !serviceType || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !timeSlot) return Response.json({ error: "Complete every appointment field" }, { status: 400 });
      if (new Date(`${date}T23:59:59`) < new Date()) return Response.json({ error: "Choose a future appointment date" }, { status: 400 });
      const appointment = await auth.sr.entities.Appointment.create({ customer_id: auth.session.customer_id, customer_name: auth.customer.full_name || "Customer", vehicle_id: vehicle.id, vehicle_info: [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" "), service_type: serviceType, date, time_slot: timeSlot, notes: String(body.notes || "").trim().slice(0, 1000) || undefined, status: "scheduled", source: "web_booking", customer_phone: auth.customer.phone || "", customer_email_address: auth.customer.email || undefined, shop_email: auth.session.shop_owner_email });
      return Response.json({ success: true, appointment: { id: appointment.id, vehicle_id: vehicle.id, vehicle_info: appointment.vehicle_info, service_type: serviceType, date, time_slot: timeSlot, status: "scheduled" } });
    }
    if (body.action === "review") {
      const rating = Number(body.rating);
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) return Response.json({ error: "Invalid rating" }, { status: 400 });
      const existing = await auth.sr.entities.CustomerReview.filter({ customer_id: auth.session.customer_id, shop_owner_email: auth.session.shop_owner_email }, "-created_date", 2);
      const values = { shop_owner_email: auth.session.shop_owner_email, customer_id: auth.session.customer_id, customer_name: auth.customer.full_name || "Customer", rating, review_text: String(body.review_text || "").slice(0, 2000), is_published: true };
      const review = existing[0] ? await auth.sr.entities.CustomerReview.update(existing[0].id, values) : await auth.sr.entities.CustomerReview.create(values);
      return Response.json({ success: true, review: { id: review.id, rating: review.rating, review_text: review.review_text, is_published: review.is_published, shop_reply: review.shop_reply, shop_replied_at: review.shop_replied_at, created_date: review.created_date } });
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