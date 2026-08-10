import React, { useState, useEffect } from "react";
import { CheckCircle, Calendar, Car, Wrench, Phone, MessageSquare, Loader2, Globe } from "lucide-react";
import { base44 } from "@/api/base44Client";
import WebBookingChatPanel from "@/components/web-booking/WebBookingChatPanel";

/**
 * Embeddable web booking widget — public page rendered on shop websites.
 * Access via /WebBookingWidget?key=<shop_api_key>. Two-step flow:
 *   1. Booking form (services pulled from the shop's key).
 *   2. On success → "Booking Confirmed" summary + live chat panel.
 * The chat session_id (web_<appointment_id>) is persisted to localStorage so
 * a returning customer can resume the conversation.
 */
export default function WebBookingWidget() {
  const urlParams = new URLSearchParams(window.location.search);
  const shopApiKey = urlParams.get("key") || "";

  const [services, setServices] = useState([]);
  const [shopName, setShopName] = useState("the shop");
  const [loadingServices, setLoadingServices] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [view, setView] = useState("form"); // "form" | "confirmed"
  const [booking, setBooking] = useState(null); // { booking_id, session_id, ... }
  const [form, setForm] = useState({
    customer_name: "", customer_phone: "", customer_email: "",
    service_type: "", preferred_date: "",
    vehicle_make: "", vehicle_model: "", vehicle_year: "", vehicle_plate: "", notes: "",
  });

  const storageKey = `lbc_web_session_${shopApiKey}`;

  useEffect(() => {
    if (!shopApiKey) { setLoadingServices(false); return; }
    // Resume a prior session if one is stored for this key.
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) || "null");
      if (stored && stored.session_id) {
        setBooking(stored);
        setView("confirmed");
      }
    } catch (_) {}
    // Load services.
    base44.functions.invoke("webBooking", { action: "get_shop_services", shop_api_key: shopApiKey })
      .then((res) => {
        const data = res?.data || res;
        setShopName(data.shop_name || "the shop");
        setServices(data.services || []);
        if (data.services?.[0]) setForm((f) => ({ ...f, service_type: f.service_type || data.services[0] }));
      })
      .catch(() => setError("This booking link is invalid or inactive."))
      .finally(() => setLoadingServices(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopApiKey]);

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    setError("");
    if (!form.customer_name || !form.customer_phone || !form.service_type || !form.preferred_date || !form.vehicle_make || !form.vehicle_model || !form.vehicle_year) {
      setError("Please fill in all required fields.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await base44.functions.invoke("webBooking", {
        action: "create_booking",
        shop_api_key: shopApiKey,
        ...form,
        vehicle_year: Number(form.vehicle_year),
      });
      const data = res?.data || res;
      if (!data?.success) throw new Error(data?.error || "Booking failed");
      const rec = {
        booking_id: data.booking_id,
        session_id: data.session_id,
        customer_name: form.customer_name,
        service_type: form.service_type,
        preferred_date: form.preferred_date,
        vehicle_info: `${form.vehicle_year} ${form.vehicle_make} ${form.vehicle_model}`,
      };
      localStorage.setItem(storageKey, JSON.stringify(rec));
      setBooking(rec);
      setView("confirmed");
    } catch (e) {
      setError(e?.message || "Booking failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!shopApiKey) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="text-center max-w-sm">
          <Globe className="w-10 h-10 mx-auto mb-3 text-slate-300" />
          <p className="text-slate-600 text-sm">This booking widget is missing its shop key. Please open it from your shop's website.</p>
        </div>
      </div>
    );
  }

  if (loadingServices) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-6 h-6 animate-spin text-sky-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-2xl mx-auto p-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4 bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center flex-shrink-0">
            <Wrench className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="font-bold text-slate-900 text-lg leading-tight truncate">{shopName}</h1>
            <p className="text-xs text-slate-500">Book your service online</p>
          </div>
        </div>

        {view === "form" && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
            <p className="text-sm text-slate-600">Tell us about your vehicle and the service you need. The shop will confirm your appointment and send an estimate.</p>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Your Name *">
                <input value={form.customer_name} onChange={(e) => setField("customer_name", e.target.value)} className="widget-input" placeholder="John Doe" />
              </Field>
              <Field label="Phone *">
                <input value={form.customer_phone} onChange={(e) => setField("customer_phone", e.target.value)} className="widget-input" placeholder="613-555-0123" />
              </Field>
            </div>

            <Field label="Email (optional)">
              <input value={form.customer_email} onChange={(e) => setField("customer_email", e.target.value)} className="widget-input" placeholder="you@email.com" />
            </Field>

            <Field label="Service Needed *">
              <select value={form.service_type} onChange={(e) => setField("service_type", e.target.value)} className="widget-input">
                <option value="">Select a service…</option>
                {services.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>

            <Field label="Preferred Date *">
              <input type="date" value={form.preferred_date} onChange={(e) => setField("preferred_date", e.target.value)} className="widget-input" />
            </Field>

            <div className="pt-2 border-t border-slate-100">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Vehicle</p>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Make *">
                  <input value={form.vehicle_make} onChange={(e) => setField("vehicle_make", e.target.value)} className="widget-input" placeholder="Honda" />
                </Field>
                <Field label="Model *">
                  <input value={form.vehicle_model} onChange={(e) => setField("vehicle_model", e.target.value)} className="widget-input" placeholder="Civic" />
                </Field>
                <Field label="Year *">
                  <input type="number" value={form.vehicle_year} onChange={(e) => setField("vehicle_year", e.target.value)} className="widget-input" placeholder="2020" />
                </Field>
              </div>
              <Field label="License Plate (optional)">
                <input value={form.vehicle_plate} onChange={(e) => setField("vehicle_plate", e.target.value)} className="widget-input" placeholder="ABCD123" />
              </Field>
            </div>

            <Field label="Notes (optional)">
              <textarea value={form.notes} onChange={(e) => setField("notes", e.target.value)} className="widget-input" rows={2} placeholder="Describe the issue or any special requests…" />
            </Field>

            {error && <div className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</div>}

            <button
              onClick={submit}
              disabled={submitting}
              className="w-full bg-sky-500 hover:bg-sky-600 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
              {submitting ? "Submitting…" : "Request Booking"}
            </button>
          </div>
        )}

        {view === "confirmed" && booking && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Booking confirmed summary */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-center gap-2 text-green-600 mb-3">
                <CheckCircle className="w-5 h-5" />
                <h2 className="font-bold text-slate-900">Booking Confirmed</h2>
              </div>
              <p className="text-sm text-slate-600 mb-4">
                Thanks, {booking.customer_name}! We received your request. The shop will confirm your appointment and send an estimate shortly.
              </p>
              <div className="space-y-2.5 text-sm">
                <Row icon={<Calendar className="w-4 h-4 text-slate-400" />} label="Date" value={booking.preferred_date} />
                <Row icon={<Wrench className="w-4 h-4 text-slate-400" />} label="Service" value={booking.service_type} />
                <Row icon={<Car className="w-4 h-4 text-slate-400" />} label="Vehicle" value={booking.vehicle_info} />
                <Row icon={<Phone className="w-4 h-4 text-slate-400" />} label="Booking ID" value={booking.booking_id?.slice(-8).toUpperCase()} />
              </div>
              <button
                onClick={() => setView("form")}
                className="mt-4 text-xs text-sky-600 hover:underline"
              >
                Make another booking
              </button>
            </div>

            {/* Live chat panel */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[460px]">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200 bg-slate-50">
                <MessageSquare className="w-4 h-4 text-sky-500" />
                <h3 className="font-semibold text-sm text-slate-800">Chat with {shopName}</h3>
              </div>
              <div className="flex-1 min-h-0">
                <WebBookingChatPanel shopApiKey={shopApiKey} sessionId={booking.session_id} customerName={booking.customer_name} />
              </div>
            </div>
          </div>
        )}

        <p className="text-center text-[11px] text-slate-400 mt-4">
          Powered by <a href="https://lbchub.tech" target="_blank" rel="noopener noreferrer" className="text-sky-500 hover:underline">LBC Auto</a>
        </p>
      </div>

      <style>{`
        .widget-input {
          width: 100%;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 0.6rem;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          outline: none;
          color: #0f172a;
        }
        .widget-input:focus { border-color: #0ea5e9; background: #fff; }
      `}</style>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      {children}
    </div>
  );
}

function Row({ icon, label, value }) {
  return (
    <div className="flex items-center gap-2">
      {icon}
      <span className="text-slate-500 w-20 flex-shrink-0">{label}</span>
      <span className="text-slate-900 font-medium truncate">{value || "—"}</span>
    </div>
  );
}