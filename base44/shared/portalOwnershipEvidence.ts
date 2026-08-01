import { listAllRecords } from "./entityPagination.ts";
import { normalizePortalTenant } from "./portalIdentity.ts";

const SHOP_PROFILE_FIELDS = ["business_name", "subscription_status", "trial_started_date", "setup_fee_paid", "plan_tier"];
const TENANT_FIELDS = { Vehicle: "shop_owner_email", Appointment: "shop_email", CustomerMessage: "shop_owner_email", CustomerNotification: "shop_owner_email", CarRecommendation: "shop_owner_email", CustomerReview: "shop_owner_email", DiagnosticScan: "shop_owner_email" };
const CREATOR_ENTITIES = new Set(["RepairOrder", "Estimate", "Invoice"]);
const unique = (rows) => [...new Map(rows.map((row) => [row.id, row])).values()];

async function loadRelated(sr, customerId) {
  const vehicles = await listAllRecords(sr.entities.Vehicle, { customer_id: customerId });
  const vehicleIds = vehicles.map((row) => row.id);
  const direct = (extra = []) => ({ $or: [{ customer_id: customerId }, ...(vehicleIds.length ? [{ vehicle_id: { $in: vehicleIds } }] : []), ...extra] });
  const [orders, estimates, appointments, messages, notifications, recommendations, reviews, diagnosticsA] = await Promise.all([
    listAllRecords(sr.entities.RepairOrder, direct()), listAllRecords(sr.entities.Estimate, direct()), listAllRecords(sr.entities.Appointment, direct()),
    listAllRecords(sr.entities.CustomerMessage, { customer_id: customerId }), listAllRecords(sr.entities.CustomerNotification, { customer_id: customerId }),
    listAllRecords(sr.entities.CarRecommendation, direct()), listAllRecords(sr.entities.CustomerReview, { customer_id: customerId }), listAllRecords(sr.entities.DiagnosticScan, direct()),
  ]);
  const estimateIds = estimates.map((row) => row.id);
  const linkedOrders = estimateIds.length ? await listAllRecords(sr.entities.RepairOrder, { estimate_id: { $in: estimateIds } }) : [];
  const allOrders = unique([...orders, ...linkedOrders]);
  const orderIds = allOrders.map((row) => row.id);
  const invoiceLinks = [...(orderIds.length ? [{ repair_order_id: { $in: orderIds } }] : []), ...(estimateIds.length ? [{ estimate_id: { $in: estimateIds } }] : [])];
  const invoices = await listAllRecords(sr.entities.Invoice, direct(invoiceLinks));
  const diagnosticLinks = [...(orderIds.length ? [{ repair_order_id: { $in: orderIds } }] : []), ...(estimateIds.length ? [{ estimate_id: { $in: estimateIds } }] : [])];
  const diagnosticsB = diagnosticLinks.length ? await listAllRecords(sr.entities.DiagnosticScan, { $or: diagnosticLinks }) : [];
  return { Vehicle: vehicles, RepairOrder: allOrders, Estimate: estimates, Invoice: invoices, Appointment: appointments, CustomerMessage: messages, CustomerNotification: notifications, CarRecommendation: recommendations, CustomerReview: reviews, DiagnosticScan: unique([...diagnosticsA, ...diagnosticsB]) };
}

function relationshipCustomers(record, maps, depth = 0, seen = new Set()) {
  const ids = new Set(record.customer_id ? [record.customer_id] : []);
  if (depth > 3) return ids;
  for (const [field, type] of [["vehicle_id", "Vehicle"], ["repair_order_id", "RepairOrder"], ["estimate_id", "Estimate"], ["invoice_id", "Invoice"], ["linked_invoice_id", "Invoice"]]) {
    const id = record[field];
    if (!id || seen.has(`${type}:${id}`)) continue;
    seen.add(`${type}:${id}`);
    const linked = maps[type]?.get(id);
    if (linked) relationshipCustomers(linked, maps, depth + 1, seen).forEach((value) => ids.add(value));
  }
  return ids;
}

export function summarizeLoadedTenantEvidence(customerId, users, related) {
  const shops = users.filter((user) => SHOP_PROFILE_FIELDS.some((field) => Boolean(user[field])));
  const validTenants = new Set(shops.map((user) => normalizePortalTenant(user.email)).filter(Boolean));
  const tenantByUserId = new Map(shops.map((user) => [user.id, normalizePortalTenant(user.email)]));
  const maps = Object.fromEntries(Object.entries(related).map(([type, rows]) => [type, new Map(rows.map((row) => [row.id, row]))]));
  const evidence = new Map();
  const relationshipConflicts = [];
  const add = (tenant, type, id) => { if (!tenant || !validTenants.has(tenant)) return; if (!evidence.has(tenant)) evidence.set(tenant, []); evidence.get(tenant).push({ type, id }); };
  for (const [type, rows] of Object.entries(related)) for (const record of rows) {
    const linked = relationshipCustomers(record, maps);
    if (!linked.has(customerId)) continue;
    if (linked.size > 1) relationshipConflicts.push({ type, id: record.id });
    if (TENANT_FIELDS[type]) add(normalizePortalTenant(record[TENANT_FIELDS[type]]), type, record.id);
    if (CREATOR_ENTITIES.has(type)) {
      add(normalizePortalTenant(record.created_by), type, record.id);
      add(tenantByUserId.get(record.created_by_id), type, record.id);
    }
  }
  const tenants = [...evidence.entries()].map(([tenant, records]) => ({ tenant, records: unique(records) }));
  return { customer_id: customerId, tenants, relationship_conflicts: unique(relationshipConflicts), supported_tenant: tenants.length === 1 && relationshipConflicts.length === 0 ? tenants[0].tenant : "", evidence_summary: { tenants, relationship_conflicts: unique(relationshipConflicts) } };
}

export async function collectAuthoritativeTenantEvidence(sr, customerId) {
  const [users, related] = await Promise.all([listAllRecords(sr.entities.User), loadRelated(sr, customerId)]);
  return summarizeLoadedTenantEvidence(customerId, users, related);
}

export function evaluateEvidence(entries, relationshipConflicts = []) {
  const tenants = [...new Set(entries.map((item) => normalizePortalTenant(item.tenant)).filter(Boolean))];
  return { tenants, supported_tenant: tenants.length === 1 && relationshipConflicts.length === 0 ? tenants[0] : "" };
}

export function verifiedBatchPlan(currentState, expectedAction) {
  if (currentState === expectedAction) return "untouched";
  return expectedAction;
}