import { normalizePortalTenant as normalizeTenantEmail } from "./portalIdentity.ts";
import { listAllRecords } from "./entityPagination.ts";
export const RELATED_CONFIG = {
  Vehicle: { tenantField: "shop_owner_email" },
  RepairOrder: { authority: "created_by" },
  Estimate: { authority: "created_by" },
  Invoice: { authority: "created_by" },
  Appointment: { tenantField: "shop_email" },
  CustomerMessage: { tenantField: "shop_owner_email" },
  CustomerNotification: { tenantField: "shop_owner_email" },
  CarRecommendation: { tenantField: "shop_owner_email" },
  CustomerReview: { tenantField: "shop_owner_email" },
  DiagnosticScan: { tenantField: "shop_owner_email" },
};

export function classifyCustomerOwnership(customer, validTenants, resolution = null, creatorById = new Map()) {
  const explicit = normalizeTenantEmail(customer.shop_owner_email);
  const creator = normalizeTenantEmail(customer.created_by) || normalizeTenantEmail(creatorById.get(customer.created_by_id));
  const resolved = normalizeTenantEmail(resolution?.resolved_tenant);
  if (resolution?.active && resolved && validTenants.has(resolved)) return { status: "safe", tenant: resolved, source: "center_control_resolution" };
  if (explicit && creator && explicit !== creator) return { status: "ambiguous", reason: "explicit_creator_conflict" };
  if (explicit && validTenants.has(explicit)) return { status: "safe", tenant: explicit, source: "explicit" };
  if (!explicit && creator && validTenants.has(creator)) return { status: "backfill", tenant: creator, source: "creator" };
  return { status: "unscoped", reason: explicit ? "explicit_tenant_not_registered" : "no_reliable_tenant" };
}

function linkedCustomerIds(record, context, depth = 0, seen = new Set()) {
  const ids = new Set();
  let broken = false;
  if (!record || depth > 3) return { ids, broken };
  if (record.customer_id) ids.add(record.customer_id);
  const links = [["vehicle_id", "Vehicle"], ["repair_order_id", "RepairOrder"], ["estimate_id", "Estimate"], ["invoice_id", "Invoice"], ["linked_invoice_id", "Invoice"]];
  for (const [field, entityName] of links) {
    const id = record[field];
    if (!id) continue;
    const marker = `${entityName}:${id}`;
    if (seen.has(marker)) continue;
    seen.add(marker);
    const linked = context[entityName]?.get(id);
    if (!linked) { broken = true; continue; }
    const nested = linkedCustomerIds(linked, context, depth + 1, seen);
    nested.ids.forEach((value) => ids.add(value));
    broken ||= nested.broken;
  }
  return { ids, broken };
}

export function classifyRelatedOwnership(entityName, record, context, customerOwnership) {
  const relationship = linkedCustomerIds(record, context);
  if (relationship.broken) return { status: "orphan", reason: "broken_relationship_chain" };
  if (relationship.ids.size === 0) return { status: "orphan", reason: "no_customer_relationship" };
  if (relationship.ids.size > 1) return { status: "conflict", reason: "relationship_points_to_multiple_customers" };
  const customerId = [...relationship.ids][0];
  const customer = context.Customer.get(customerId);
  if (!customer) return { status: "orphan", reason: "customer_not_found", customerId };
  const ownership = customerOwnership.get(customerId);
  if (!ownership || !["safe", "backfill"].includes(ownership.status)) return { status: "skipped", reason: `customer_${ownership?.status || "unknown"}`, customerId };
  const config = RELATED_CONFIG[entityName];
  if (config.tenantField) {
    const explicit = normalizeTenantEmail(record[config.tenantField]);
    if (explicit && explicit !== ownership.tenant) return { status: "conflict", reason: "tenant_conflicts_with_customer", customerId, tenant: ownership.tenant };
    return { status: explicit ? "safe" : "backfill", customerId, tenant: ownership.tenant, tenantField: config.tenantField };
  }
  const creator = normalizeTenantEmail(record.created_by) || normalizeTenantEmail(context.UserById?.get(record.created_by_id));
  if (!creator) return { status: "skipped", reason: "missing_creator_authority", customerId };
  if (creator !== ownership.tenant) return { status: "conflict", reason: "creator_conflicts_with_customer", customerId, tenant: ownership.tenant };
  return { status: "safe", customerId, tenant: ownership.tenant };
}

function chunks(items, size = 500) {
  const result = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
}

export async function runLegacyOwnershipScan(sr, mode = "dry_run", actorEmail = "") {
  const entityNames = ["Customer", ...Object.keys(RELATED_CONFIG)];
  const [users, resolutions, ...sets] = await Promise.all([listAllRecords(sr.entities.User), listAllRecords(sr.entities.PortalOwnershipResolution), ...entityNames.map((name) => listAllRecords(sr.entities[name]))]);
  const shopUsers = users.filter((user) => user.business_name || user.subscription_status || user.trial_started_date || user.setup_fee_paid || user.plan_tier);
  const validTenants = new Set(shopUsers.map((user) => normalizeTenantEmail(user.email)).filter(Boolean));
  const creatorById = new Map(shopUsers.map((user) => [user.id, normalizeTenantEmail(user.email)]));
  const resolutionMap = new Map(resolutions.filter((item) => item.active).map((item) => [item.customer_id, item]));
  const data = Object.fromEntries(entityNames.map((name, index) => [name, sets[index]]));
  const context = { ...Object.fromEntries(entityNames.map((name) => [name, new Map(data[name].map((row) => [row.id, row]))])), UserById: creatorById };
  const ownership = new Map();
  const report = {
    mode, total_customers_scanned: data.Customer.length, safe_already_scoped: 0,
    deterministic_customer_ownership_backfills: 0, related_record_ownership_backfills: {},
    ambiguous_customer_ids: [], unscoped_customer_ids: [], conflicting_related_records: [],
    orphaned_relationships: [], skipped_records: [], applied_updates: 0,
  };
  const customerUpdates = [];
  for (const customer of data.Customer) {
    const result = classifyCustomerOwnership(customer, validTenants, resolutionMap.get(customer.id), creatorById);
    ownership.set(customer.id, result);
    if (result.status === "safe") report.safe_already_scoped += 1;
    else if (result.status === "backfill") {
      report.deterministic_customer_ownership_backfills += 1;
      customerUpdates.push({ id: customer.id, shop_owner_email: result.tenant });
    } else if (result.status === "ambiguous") report.ambiguous_customer_ids.push(customer.id);
    else report.unscoped_customer_ids.push(customer.id);
  }
  const relatedUpdates = {};
  for (const entityName of Object.keys(RELATED_CONFIG)) {
    report.related_record_ownership_backfills[entityName] = 0;
    relatedUpdates[entityName] = [];
    for (const record of data[entityName]) {
      const result = classifyRelatedOwnership(entityName, record, context, ownership);
      if (result.status === "backfill") {
        report.related_record_ownership_backfills[entityName] += 1;
        relatedUpdates[entityName].push({ id: record.id, [result.tenantField]: result.tenant });
      } else if (result.status === "conflict") report.conflicting_related_records.push({ entity: entityName, id: record.id, reason: result.reason });
      else if (result.status === "orphan") report.orphaned_relationships.push({ entity: entityName, id: record.id, reason: result.reason });
      else if (result.status === "skipped") report.skipped_records.push({ entity: entityName, id: record.id, reason: result.reason });
    }
  }
  if (mode === "apply") {
    for (const batch of chunks(customerUpdates)) { if (batch.length) { await sr.entities.Customer.bulkUpdate(batch); report.applied_updates += batch.length; } }
    for (const [entityName, updates] of Object.entries(relatedUpdates)) for (const batch of chunks(updates)) { if (batch.length) { await sr.entities[entityName].bulkUpdate(batch); report.applied_updates += batch.length; } }
    const now = new Date().toISOString();
    const events = [
      { event_type: "migration_summary", shop_owner_email: normalizeTenantEmail(actorEmail), created_at: now, metadata: { customers_scanned: report.total_customers_scanned, applied_updates: report.applied_updates, conflicts: report.conflicting_related_records.length, orphans: report.orphaned_relationships.length } },
      ...report.ambiguous_customer_ids.map((id) => ({ event_type: "migration_conflict", shop_owner_email: normalizeTenantEmail(actorEmail), customer_id: id, created_at: now, metadata: { reason: "ambiguous_customer" } })),
      ...report.conflicting_related_records.map((item) => ({ event_type: "migration_conflict", shop_owner_email: normalizeTenantEmail(actorEmail), created_at: now, metadata: item })),
    ];
    for (const batch of chunks(events)) if (batch.length) await sr.entities.CustomerSecurityEvent.bulkCreate(batch);
  }
  return report;
}

export function reportCounts(report) {
  return {
    total_customers_scanned: report.total_customers_scanned,
    safe_already_scoped: report.safe_already_scoped,
    deterministic_customer_ownership_backfills: report.deterministic_customer_ownership_backfills,
    related_record_ownership_backfills: report.related_record_ownership_backfills,
    ambiguous_customers: report.ambiguous_customer_ids.length,
    unscoped_customers: report.unscoped_customer_ids.length,
    conflicting_related_records: report.conflicting_related_records.length,
    orphaned_relationships: report.orphaned_relationships.length,
    skipped_records: report.skipped_records.length,
    applied_updates: report.applied_updates,
  };
}