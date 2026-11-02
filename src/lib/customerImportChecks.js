import { formatPhone } from "@/utils/formatPhone";
import { emailKey, nameKey, phoneKey } from "@/lib/customerKeys";

const BY = ["phone", "email", "name"];
const keysOf = (phone, email, name) => ({ phone: phoneKey(phone), email: emailKey(email), name: nameKey(name) });

// The shop's current customers, findable by phone, email or name.
export function indexCustomers(customers) {
  const index = { phone: new Map(), email: new Map(), name: new Map() };
  for (const c of customers) {
    const keys = keysOf(c.phone, c.email, c.full_name);
    for (const by of BY) if (keys[by] && !index[by].has(keys[by])) index[by].set(keys[by], c);
  }
  return index;
}

// For each entry, in list order: the current customer it matches, the earlier entry it repeats,
// which details are empty (only for columns the list has), and whether it has no name.
export function checkEntries(entries, existing, has) {
  const earlier = { phone: new Map(), email: new Map(), name: new Map() };
  return entries.map((e) => {
    const keys = keysOf(e.phone, e.email, e.name);
    const find = (index) => BY.filter((by) => keys[by] && index[by].has(keys[by])).map((by) => ({ by, record: index[by].get(keys[by]) }))[0] || null;
    const check = {
      existing: find(existing),
      repeat: find(earlier),
      missing: ["phone", "email", "address"].filter((f) => has[f] && !String(e[f] || "").trim()),
      noName: !keys.name,
    };
    for (const by of BY) if (keys[by] && !earlier[by].has(keys[by])) earlier[by].set(keys[by], e);
    return check;
  });
}

// Where the review starts: possible duplicates unticked, and every entry with something to
// decide (duplicate, missing details, no name) listed first with editable details.
export function startReview(parsed, existing) {
  const checks = checkEntries(parsed.entries, existing, parsed.has);
  const items = parsed.entries.map((e, i) => {
    const c = checks[i];
    return { ...e, include: !c.existing && !c.repeat, attention: Boolean(c.existing || c.repeat || c.noName || c.missing.length) };
  });
  const order = items.map((_, i) => i).sort((a, b) => Number(items[b].attention) - Number(items[a].attention) || a - b);
  return { items, order };
}

export const existingNote = (m) =>
  m ? `Already in your customers as ${m.record.full_name || "a customer with no name"}${m.record.phone ? ` (${formatPhone(m.record.phone)})` : ""}, same ${m.by}` : "";

export const repeatNote = (m) => (m ? `Same ${m.by} as ${m.record.name || "another entry"} on row ${m.record.rows[0]}` : "");