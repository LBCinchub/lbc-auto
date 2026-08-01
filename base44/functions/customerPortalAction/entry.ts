import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { auditEvent, buildCustomerPortalData, requireCustomerSession } from "../../shared/customerPortalSecurity.ts";

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const auth = await requireCustomerSession(base44, req);
    const body = await req.json();
    const action = String(body.action || "");
    const data = await buildCustomerPortalData(auth.sr, auth.customer, auth.session.shop_owner_email);
    if (action === "mark_notifications_read") {
      const requested = new Set(Array.isArray(body.notification_ids) ? body.notification_ids : []);
      const records = data.notifications.filter((item) => requested.has(item.id) && !item.is_read);
      if (records.length) await auth.sr.entities.CustomerNotification.bulkUpdate(records.map((item) => ({ id: item.id, is_read: true })));
      return Response.json({ success: true, updated_ids: records.map((item) => item.id) });
    }
    if (action === "mark_messages_read") {
      const records = data.messages.filter((item) => item.sender === "shop" && !item.read_by_customer);
      if (records.length) await auth.sr.entities.CustomerMessage.bulkUpdate(records.map((item) => ({ id: item.id, read_by_customer: true })));
      return Response.json({ success: true, updated_ids: records.map((item) => item.id) });
    }
    if (action === "book_appointment") {
      const vehicle = data.vehicles.find((item) => item.id === body.vehicle_id);
      const serviceType = String(body.service_type || "").trim().slice(0, 200);
      const date = String(body.date || ""); const timeSlot = String(body.time_slot || "").trim().slice(0, 80);
      if (!vehicle || !serviceType || !/^\d{4}-\d{2}-\d{2}$/.test(date) || date < new Date().toISOString().slice(0, 10) || !timeSlot) return Response.json({ error: "Please complete the appointment details" }, { status: 400 });
      const vehicleInfo = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ");
      const appointment = await auth.sr.entities.Appointment.create({ customer_id: auth.session.customer_id, customer_name: auth.customer.full_name, vehicle_id: vehicle.id, vehicle_info: vehicleInfo, service_type: serviceType, date, time_slot: timeSlot, notes: String(body.notes || "").slice(0, 1000), status: "scheduled", source: "web_booking", customer_phone: auth.customer.phone || "", customer_email_address: auth.customer.email || "", shop_email: auth.session.shop_owner_email });
      return Response.json({ success: true, appointment: { id: appointment.id, vehicle_id: vehicle.id, vehicle_info: vehicleInfo, service_type: serviceType, date, time_slot: timeSlot, status: "scheduled", created_date: appointment.created_date } });
    }
    if (action === "estimate_decision") {
      const estimate = data.estimates.find((item) => item.id === body.estimate_id);
      const decision = body.decision === "approve" ? "approved" : body.decision === "decline" ? "declined" : "";
      if (!estimate || !decision || ["approved", "declined", "invoiced", "expired", "cancelled"].includes(estimate.status)) return Response.json({ error: "This estimate is no longer available for action" }, { status: 409 });
      await auth.sr.entities.Estimate.update(estimate.id, { status: decision, auth_status: decision === "approved" ? "approved" : "none" });
      await auditEvent(auth.sr, req, "estimate_decision", { customerId: auth.session.customer_id, shopOwnerEmail: auth.session.shop_owner_email, sessionId: auth.session.session_id, metadata: { estimate_id: estimate.id, decision } });
      return Response.json({ success: true, estimate: { ...estimate, status: decision, auth_status: decision === "approved" ? "approved" : "none" } });
    }
    return Response.json({ error: "Unsupported action" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message === "SESSION_REQUIRED" ? "Session expired or unavailable" : "Action unavailable" }, { status: error.message === "SESSION_REQUIRED" ? 401 : 403 });
  }
}