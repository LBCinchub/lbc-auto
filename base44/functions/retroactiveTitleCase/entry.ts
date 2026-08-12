import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { listAllRecords } from "../../shared/entityPagination.ts";

// ── Title Case ────────────────────────────────────────────────────────────
// Capitalize the first letter of every word, lowercase the rest.
// Idempotent: running it twice yields the same result (no double-application).
function titleCase(str) {
  if (typeof str !== "string") return str;
  // Word = run of letters/digits/accented chars; preserves spacing & punctuation.
  return str.replace(/[A-Za-z0-9\u00C0-\u024F]+/g, (w) =>
    w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
  );
}

// Returns the title-cased value ONLY if it differs from the original.
function changed(val) {
  if (typeof val !== "string" || !val.trim()) return null;
  const tc = titleCase(val);
  return tc !== val ? tc : null;
}

// Returns a new array with the given sub-fields title-cased, or null if nothing changed.
function transformArray(arr, subFields) {
  if (!Array.isArray(arr)) return null;
  let any = false;
  const next = arr.map((item) => {
    if (!item || typeof item !== "object") return item;
    const out = { ...item };
    for (const f of subFields) {
      const nv = changed(item[f]);
      if (nv !== null) { out[f] = nv; any = true; }
    }
    return out;
  });
  return any ? next : null;
}

// Build a patch object containing only the changed fields for one record.
function buildPatch(rec, spec) {
  const patch = {};
  for (const f of (spec.scalars || [])) {
    const nv = changed(rec[f]);
    if (nv !== null) patch[f] = nv;
  }
  for (const [arrField, subFields] of Object.entries(spec.arrays || {})) {
    const next = transformArray(rec[arrField], subFields);
    if (next) patch[arrField] = next;
  }
  return patch;
}

// Per-entity field specifications — ONLY human-typed text, never
// emails, phones, VINs, plates, numbers, or system-generated IDs.
const SPECS = {
  Invoice: {
    scalars: ["customer_note", "technician_notes", "service_reason"],
    arrays: { line_items: ["name", "description"] },
  },
  Estimate: {
    scalars: ["notes", "service_reason"],
    arrays: { labor_items: ["description"], parts_items: ["name"] },
  },
  RepairOrder: {
    scalars: ["description", "notes"],
    arrays: { labor_items: ["description"], parts_used: ["name"], parts_ordered: ["name"] },
  },
  Customer: {
    scalars: ["full_name", "address", "notes"],
    arrays: { notes_log: ["text"] },
  },
  Vehicle: {
    scalars: ["make", "model", "trim", "color"],
    arrays: {},
  },
  Appointment: {
    scalars: ["service_type", "notes"],
    arrays: {},
  },
};

// Extract a short before/after snapshot for the verification samples.
function snapshot(entityName, rec, patch) {
  if (entityName === "Invoice" || entityName === "Estimate") {
    // line_items / parts_items+labor_items names
    const arrField = entityName === "Invoice" ? "line_items" : null;
    let before = [];
    let after = [];
    if (arrField && rec[arrField]) {
      before = rec[arrField].slice(0, 4).map((i) => i.name || i.description || "");
      after = (patch[arrField] || rec[arrField]).slice(0, 4).map((i) => i.name || i.description || "");
    } else if (entityName === "Estimate") {
      before = [...(rec.parts_items || []), ...(rec.labor_items || [])].slice(0, 4).map((i) => i.name || i.description || "");
      const np = patch.parts_items || rec.parts_items || [];
      const nl = patch.labor_items || rec.labor_items || [];
      after = [...np, ...nl].slice(0, 4).map((i) => i.name || i.description || "");
    }
    return { id: rec.id, before, after };
  }
  if (entityName === "Customer") {
    return { id: rec.id, before: rec.full_name, after: patch.full_name || rec.full_name };
  }
  if (entityName === "Vehicle") {
    return { id: rec.id, before: `${rec.make} ${rec.model}`, after: `${patch.make || rec.make} ${patch.model || rec.model}` };
  }
  return null;
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") {
      return Response.json({ error: "Admin access required" }, { status: 403 });
    }

    let body = {};
    try { body = await req.json(); } catch (_) { body = {}; }
    const dryRun = body.dry_run !== false; // default: dry run
    const onlyEntity = body.entity || null; // optional: limit to one entity for testing

    const svc = base44.asServiceRole;
    const entityNames = onlyEntity ? [onlyEntity] : Object.keys(SPECS);

    const summary = {};
    const samples = { invoices: [], estimates: [], customers: [], vehicles: [] };
    const logs = [];

    for (const name of entityNames) {
      const spec = SPECS[name];
      const entity = svc.entities[name];
      const records = await listAllRecords(entity);
      const patches = []; // {id, ...patch}
      let changedCount = 0;

      for (const rec of records) {
        const patch = buildPatch(rec, spec);
        if (Object.keys(patch).length > 0) {
          changedCount++;
          patches.push({ id: rec.id, ...patch });
          // collect up to 3 samples for invoice/estimate, 2 for customer/vehicle
          if (name === "Invoice" && samples.invoices.length < 3) samples.invoices.push(snapshot(name, rec, patch));
          if (name === "Estimate" && samples.estimates.length < 3) samples.estimates.push(snapshot(name, rec, patch));
          if (name === "Customer" && samples.customers.length < 2) samples.customers.push(snapshot(name, rec, patch));
          if (name === "Vehicle" && samples.vehicles.length < 2) samples.vehicles.push(snapshot(name, rec, patch));
        }
      }

      summary[name] = { scanned: records.length, changed: changedCount };
      logs.push(`${name}: scanned ${records.length}, ${changedCount} need title-casing`);

      if (!dryRun && patches.length > 0) {
        // bulkUpdate in batches of 500
        for (let i = 0; i < patches.length; i += 500) {
          await entity.bulkUpdate(patches.slice(i, i + 500));
        }
        logs.push(`${name}: applied updates to ${patches.length} records`);
      }
    }

    return Response.json({
      mode: dryRun ? "dry_run" : "apply",
      summary,
      samples,
      logs,
      message: dryRun
        ? "Dry run complete — no records were modified. Re-run with { \"dry_run\": false } to apply."
        : "Title Case migration applied successfully.",
    });
  } catch (error) {
    return Response.json({ error: error?.message || "Migration failed" }, { status: 500 });
  }
}