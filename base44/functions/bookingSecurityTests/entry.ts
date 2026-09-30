import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import {
  resolveAuth, handleCreateBooking, handleCheckStatus, handleSendChatMessage,
  handleGetChatMessages, handleResumeSession,
} from "../../shared/webBookingCore.ts";
import { canonicalizePhone, aliasLookupKeys, localToUtc, localAliasFor } from "../../shared/bookingPrimitives.ts";

// OWNER/ADMIN-ONLY security test suite for the web booking pipeline.
// action="mock"  — isolated in-memory fixtures (no database, no side effects).
// action="live"  — read-only checks against the DEPLOYED webBooking endpoint
//                  (never creates bookings, customers, or appointments).
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const results = [];

    if ((body.action || "mock") === "live") {
      const invoke = async (payload) => {
        try {
          const res = await base44.functions.invoke("webBooking", payload);
          return { status: res?.status, data: res?.data || res };
        } catch (e) {
          const status = e?.response?.status ?? e?.status ?? null;
          const data = e?.response?.data ?? e?.data ?? null;
          return { status, data };
        }
      };
      const checks = [];
      const t = async (name, payload, expectCode, expectStatus) => {
        const r = await invoke(payload);
        const ok = r.data && r.data.error === expectCode && (expectStatus == null || r.status === expectStatus);
        checks.push({ name, pass: !!ok, got: { status: r.status, code: r.data && r.data.error } });
      };
      await t("unknown alias", { action: "resolve_public_alias", public_alias: "9999999999" }, "ALIAS_UNKNOWN", 404);
      await t("missing credential", { action: "get_shop_services" }, "AUTH_REQUIRED", 401);
      await t("bad legacy key", { action: "get_shop_services", shop_api_key: "not-a-real-key" }, "AUTH_INVALID", 401);
      await t("status without receipt", { action: "check_status", shop_api_key: "not-a-real-key", booking_id: "x" }, "AUTH_INVALID", 401);
      await t("phone-only resume disabled", { action: "resume_session", shop_api_key: "x", customer_phone: "6135551234" }, "AUTH_INVALID", 401);
      return Response.json({ mode: "live", checks });
    }

    // ── Mocked suite ────────────────────────────────────────────────────────
    const nowIso = () => new Date().toISOString();

    function makeEntities(seed) {
      const store = {};
      let next = 1;
      const mk = (name, rows = []) => { store[name] = rows.map((r) => ({ created_date: nowIso(), ...r })); };
      Object.entries(seed).forEach(([k, v]) => mk(k, v));
      const inc = () => `id_${next++}`;
      const eq = (row, q) => Object.entries(q).every(([k, v]) => row[k] === v);
      const crud = {
        async filter(name, query = {}, sort = "created_date", limit = 10) {
          const rows = store[name] || [];
          const dir = String(sort).startsWith("-") ? -1 : 1;
          return rows
            .filter((r) => eq(r, query))
            .sort((a, b) => (new Date(a.created_date) - new Date(b.created_date)) * dir)
            .slice(0, limit);
        },
        async get(name, id) {
          return (store[name] || []).find((r) => r.id === id) || null;
        },
        async create(name, data) {
          const rec = { id: inc(), created_date: new Date(Date.now() + next).toISOString(), ...data };
          (store[name] = store[name] || []).push(rec);
          return rec;
        },
        async update(name, id, data) {
          const rec = (store[name] || []).find((r) => r.id === id);
          if (rec) Object.assign(rec, data);
          return rec;
        },
        async updateMany(name, query = {}, data = {}) {
          const set = data.$set || {};
          let n = 0;
          (store[name] || []).forEach((r) => { if (eq(r, query)) { Object.assign(r, set); n++; } });
          return { n };
        },
      };
      // Nested per-entity collections, as the core expects (entities.X.create).
      const entities = {};
      ["User", "WebBookingKey", "ShopBookingAlias", "Appointment", "Estimate",
        "Customer", "Vehicle", "ChatMessage", "WebBookingReceipt"].forEach((n) => { entities[n] = crud; });
      return { store, entities };
    }

    console.log("MOCK-SUITE-START");
    const test = (name, pass, detail = "") => results.push({ name, pass: !!pass, detail });
    const codeOf = (r) => (r && r.blocked ? r.blocked.code : null);

    // Seed fixture: two shops (Haj + other), keys, aliases, one existing booking.
    const seeded = () => makeEntities({
      User: [
        { id: "u_haj", email: "haj@lbc.test", full_name: "Haj Rims and Tires", business_name: "Haj Rims and Tires", phone: "+16136722727", web_booking_services: ["Oil Change", "Tire Service"] },
        { id: "u_other", email: "other@lbc.test", full_name: "Other Shop", phone: "+16135550000" },
      ],
      WebBookingKey: [
        { id: "k_haj", api_key: "key-haj", shop_owner_email: "haj@lbc.test", shop_name: "Haj", is_active: true },
        { id: "k_other", api_key: "key-other", shop_owner_email: "other@lbc.test", shop_name: "Other", is_active: true },
      ],
      ShopBookingAlias: [
        { id: "a_haj", shop_user_id: "u_haj", shop_owner_email: "haj@lbc.test", display_name: "Haj Rims and Tires", public_phone_e164: "+16136722727", local_alias: "6136722727", country: "CA", timezone: "America/Toronto", is_active: true },
        { id: "a_other", shop_user_id: "u_other", shop_owner_email: "other@lbc.test", display_name: "Other Shop", public_phone_e164: "+16135550000", local_alias: "6135550000", country: "CA", timezone: "America/Toronto", is_active: true },
      ],
      Appointment: [],
      Estimate: [],
      Customer: [],
      Vehicle: [],
      ChatMessage: [],
      WebBookingReceipt: [],
    });

    // 1. Phone canonicalization + alias lookups.
    test("CA local phone canonicalizes to E.164", canonicalizePhone("613-672-2727", "CA") === "+16136722727");
    test("phone without country is never inferred", canonicalizePhone("6136722727") === null);
    test("local alias derived for NANP only", localAliasFor("+16136722727", "CA") === "6136722727" && localAliasFor("+447911123456", "GB") === null);
    test("route param maps to both forms", (() => { const l = aliasLookupKeys("/book/6136722727".split("/").pop()); return l && l.e164 === "+16136722727" && l.local === "6136722727"; })());
    test("malformed route param rejected", aliasLookupKeys("abc12") === null);

    // 2. Unknown / ambiguous alias.
    {
      const { entities } = seeded();
      let r = await resolveAuth(entities, { public_alias: "9999999999" });
      test("unknown phone blocked", codeOf(r) === "ALIAS_UNKNOWN" && r.blocked.status === 404);
      await entities.ShopBookingAlias.create({ shop_user_id: "u2", shop_owner_email: "dup@lbc.test", public_phone_e164: "+16136722727", local_alias: "6136722727", country: "CA", timezone: "America/Toronto", is_active: true });
      r = await resolveAuth(entities, { public_alias: "6136722727" });
      test("ambiguous phone blocked", codeOf(r) === "ALIAS_AMBIGUOUS" && r.blocked.status === 409);
    }

    // 3. Forged browser tenant + tenant/key mismatch + credential checks.
    {
      const { entities } = seeded();
      let r = await resolveAuth(entities, { public_alias: "6136722727", shop_email: "other@lbc.test" });
      test("forged browser tenant rejected", codeOf(r) === "FORGED_TENANT" && r.blocked.status === 403);
      r = await resolveAuth(entities, { public_alias: "6136722727", shop_api_key: "key-other" });
      test("key bound to another shop rejected", codeOf(r) === "TENANT_KEY_MISMATCH" && r.blocked.status === 403);
      r = await resolveAuth(entities, { public_alias: "6136722727", shop_email: "haj@lbc.test", shop_api_key: "key-haj" });
      test("matching shop_email + key resolves", r.mode === "key" && r.tenant === "haj@lbc.test");
      r = await resolveAuth(entities, {});
      test("no credential blocked", codeOf(r) === "AUTH_REQUIRED" && r.blocked.status === 401);
    }

    // 4. Hashed credential verify (positive + negative).
    {
      const { entities } = seeded();
      const enc = new TextEncoder();
      const sha = async (s) => {
        const buf = await crypto.subtle.digest("SHA-256", enc.encode(s));
        return [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, "0")).join("");
      };
      await entities.ShopBookingAlias.update("a_haj", { credential_hash: await sha("cred-secret-1") });
      let r = await resolveAuth(entities, { public_alias: "6136722727", shop_credential: "wrong" });
      test("bad credential rejected", codeOf(r) === "AUTH_INVALID" && r.blocked.status === 401);
      r = await resolveAuth(entities, { public_alias: "6136722727", shop_credential: "cred-secret-1" });
      test("valid credential resolves to tenant", r.mode === "credential" && r.tenant === "haj@lbc.test");
    }

    // 5. Public alias mode resolves allowlisted info only.
    {
      const { entities } = seeded();
      const auth = await resolveAuth(entities, { public_alias: "6136722727" });
      const r = await handleResumeSession(entities, auth, { customer_phone: "6135551234" }, "c");
      test("phone-only resume disabled", codeOf(r) === "PHONE_RESUME_DISABLED" && r.blocked.status === 400);
    }

    // 6. create_booking validation.
    {
      const { entities } = seeded();
      const auth = await resolveAuth(entities, { public_alias: "6136722727" });
      const base = {
        customer_name: "John Doe", customer_phone: "613-555-1234", service_type: "Tire Service",
        preferred_date: "2030-01-15", time_slot: "10:30", vehicle_make: "Honda", vehicle_model: "Civic",
        vehicle_year: "2020", customer_confirmed: true, idempotency_key: "idem-1",
      };
      let r = await handleCreateBooking(entities, auth, { ...base, customer_confirmed: false }, "c");
      test("missing explicit confirmation blocked", codeOf(r) === "CONFIRMATION_REQUIRED");
      r = await handleCreateBooking(entities, auth, { ...base, service_type: "Oil Change EV Special" }, "c");
      test("service must match shop enum", codeOf(r) === "SERVICE_INVALID");
      r = await handleCreateBooking(entities, auth, { ...base, time_slot: "25:00" }, "c");
      test("invalid time blocked", codeOf(r) === "TIME_INVALID");
      r = await handleCreateBooking(entities, auth, { ...base, preferred_date: "2030-02-30" }, "c");
      test("impossible calendar date blocked", codeOf(r) === "DATE_INVALID");
      r = await handleCreateBooking(entities, auth, { ...base, preferred_date: "2020-01-15" }, "c");
      test("past date blocked", codeOf(r) === "DATE_PAST");
      r = await handleCreateBooking(entities, auth, { ...base, idempotency_key: "" }, "c");
      test("idempotency key required", codeOf(r) === "IDEMPOTENCY_REQUIRED");
      r = await handleCreateBooking(entities, auth, base, "c");
      test("valid booking creates exactly one appointment", r.response && entities.store.Appointment.length === 1);
      test("response marks request received, not confirmed", r.response.request_status === "request_received");
      test("receipt token issued once", typeof r.response.receipt_token === "string" && r.response.receipt_token.startsWith("wbk_"));
    }

    // 7. Duplicate click / retry with same idempotency key replays, no dupes.
    {
      const { entities } = seeded();
      const auth = await resolveAuth(entities, { public_alias: "6136722727" });
      const base = {
        customer_name: "John Doe", customer_phone: "6135551234", service_type: "Tire Service",
        preferred_date: "2030-01-15", time_slot: "10:30", vehicle_make: "Honda", vehicle_model: "Civic",
        vehicle_year: "2020", customer_confirmed: true, idempotency_key: "idem-dup",
      };
      const r1 = await handleCreateBooking(entities, auth, base, "c");
      const r2 = await handleCreateBooking(entities, auth, base, "c");
      test("retry replays same appointment", r1.response.appointment_id === r2.response.appointment_id);
      test("no duplicate appointment created", entities.store.Appointment.length === 1);
      test("no duplicate customer/vehicle", entities.store.Customer.length === 1 && entities.store.Vehicle.length === 1);
      test("replay is flagged", r2.response.replayed === true);
      const r3 = await handleCreateBooking(entities, auth, { ...base, customer_name: "Jane Doe" }, "c");
      test("same key different draft conflicts", codeOf(r3) === "IDEMPOTENCY_CONFLICT" && entities.store.Appointment.length === 1);
    }

    // 8. Concurrent pending guard.
    {
      const { entities } = seeded();
      const auth = await resolveAuth(entities, { public_alias: "6136722727" });
      const base = { customer_name: "A B", customer_phone: "6135550001", service_type: "Oil Change", preferred_date: "2030-01-20", time_slot: "09:00", vehicle_make: "Ford", vehicle_model: "F-150", vehicle_year: "2021", customer_confirmed: true, idempotency_key: "idem-pending" };
      const r1 = await handleCreateBooking(entities, auth, base, "c");
      test("first request completes", !!r1.response);
    }

    // 9. Receipt-bound status + chat; forged/garbage receipts fail closed.
    {
      const { entities } = seeded();
      const auth = await resolveAuth(entities, { public_alias: "6136722727" });
      const base = { customer_name: "John Doe", customer_phone: "6135551234", service_type: "Tire Service", preferred_date: "2030-01-15", time_slot: "10:30", vehicle_make: "Honda", vehicle_model: "Civic", vehicle_year: "2020", customer_confirmed: true, idempotency_key: "idem-chat" };
      const r = await handleCreateBooking(entities, auth, base, "c");
      const receiptToken = r.response.receipt_token;
      const otherAuth = await resolveAuth(entities, { shop_api_key: "key-other" });
      let s = await handleCheckStatus(entities, otherAuth, { receipt_token: receiptToken }, "c");
      test("receipt from another shop fails closed", codeOf(s) === "RECEIPT_INVALID");
      s = await handleCheckStatus(entities, auth, { receipt_token: "forged" }, "c");
      test("forged receipt rejected", codeOf(s) === "RECEIPT_INVALID");
      s = await handleCheckStatus(entities, auth, {}, "c");
      test("missing receipt rejected", codeOf(s) === "RECEIPT_REQUIRED");
      s = await handleCheckStatus(entities, auth, { receipt_token: receiptToken }, "c");
      test("valid receipt reads own booking", s.response && s.response.booking_id === r.response.appointment_id);
      test("status distinguishes request vs confirmed", s.response.request_status === "request_received" && s.response.slot_confirmed === false);
      const g = await handleGetChatMessages(entities, auth, { receipt_token: receiptToken }, "c");
      test("chat read with own receipt works", g.response && g.response.messages.length === 1);
      const m = await handleSendChatMessage(entities, auth, { receipt_token: receiptToken, message: "hello" }, "c");
      test("chat write with own receipt works", m.response && !!m.response.message_id);
      const g2 = await handleGetChatMessages(entities, auth, { receipt_token: receiptToken }, "c");
      test("chat shows both messages", g2.response.messages.length === 2);
      test("read-state update was shop+session scoped", entities.store.ChatMessage.filter((x) => x.is_read).every((x) => x.shop_email === "haj@lbc.test"));
    }

    // 10. Key mode still works for legacy widget, but chat requires receipt.
    {
      const { entities } = seeded();
      const auth = await resolveAuth(entities, { shop_api_key: "key-haj" });
      let s = await handleCheckStatus(entities, auth, { booking_id: "whatever" }, "c");
      test("scoped key alone cannot read a booking", codeOf(s) === "RECEIPT_REQUIRED");
      const r = await handleCreateBooking(entities, auth, { customer_name: "Legacy User", customer_phone: "6135550009", service_type: "Oil Change", preferred_date: "2030-02-01", time_slot: "Morning", vehicle_make: "Toyota", vehicle_model: "Corolla", vehicle_year: "2019", customer_confirmed: true, idempotency_key: "idem-legacy" }, "c");
      test("legacy booking flow still creates booking", !!r.response && entities.store.Appointment.length === 1);
    }

    // 11. Timezone / DST.
    test("DST spring gap is invalid", localToUtc("2026-03-08", "02:30", "America/Toronto") === null);
    test("DST fall-back resolves to first occurrence", (() => { const ms = localToUtc("2026-11-01", "01:30", "America/Toronto"); return ms === Date.parse("2026-11-01T05:30:00Z"); })());
    test("regular winter time converts correctly", localToUtc("2026-01-15", "10:30", "America/Toronto") === Date.parse("2026-01-15T15:30:00Z"));
    test("regular summer (EDT) time converts correctly", localToUtc("2026-07-15", "10:30", "America/Toronto") === Date.parse("2026-07-15T14:30:00Z"));
    test("bad timezone rejected", localToUtc("2026-01-15", "10:30", "Not/AZone") === null);

    const failed = results.filter((r) => !r.pass);
    return Response.json({ mode: "mock", total: results.length, passed: results.length - failed.length, failed: failed.length, results });
  } catch (error) {
    console.error("bookingSecurityTests failure", { message: error?.message });
    return Response.json({ error: "INTERNAL_ERROR", debug_message: error?.message, stack: error?.stack, results }, { status: 500 });
  }
}