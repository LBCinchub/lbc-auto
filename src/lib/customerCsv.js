import { emailKey, nameKey, phoneKey } from "@/lib/customerKeys";

// Reads a customer list (a CSV file, pasted CSV text, or cells copied from a spreadsheet) into
// one entry per customer: name, phone, email, address and vehicles.

// Rows of trimmed cells. A cell that starts with a quote may hold commas, line breaks and "".
export function parseCsv(text) {
  const src = String(text || "").replace(/^\uFEFF/, "");
  const head = src.split(/\r?\n/, 1)[0];
  const delimiter = ["\t", ";"].find((d) => head.split(d).length > head.split(",").length) || ",";
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch !== '"') cell += ch;
      else if (src[i + 1] === '"') { cell += '"'; i++; }
      else quoted = false;
    } else if (ch === '"' && !cell.trim()) { cell = ""; quoted = true; }
    else if (ch === delimiter) { row.push(cell.trim()); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell.trim()); rows.push(row); row = []; cell = "";
    } else cell += ch;
  }
  row.push(cell.trim());
  rows.push(row);
  return rows.filter((r) => r.some(Boolean));
}

// Column titles, checked in order; the first rule that fits wins. So "Email Address" is the
// email, and "Customer ID" or "Last Visit" are ignored instead of being read as a name.
const COLUMN_RULES = [
  [null, /\b(id|vin|plate|date|visit|notes?|balance|total|company|business)\b/],
  ["email", /e ?mail/],
  ["phone", /phone|mobile|\bcell\b|\btel\b/],
  ["first", /^first$|\bfirst ?name\b|\bgiven name\b/],
  ["last", /^last$|\blast ?name\b|\bsurname\b|\bfamily name\b/],
  ["postal", /postal|\bzip\b|post ?code/],
  ["city", /\bcity\b|\btown\b/],
  ["region", /\b(province|state|region|prov)\b/],
  ["address", /address|street/],
  ["vehicle", /\bvehicles?\b|\bcar\b|year make model/],
  ["year", /\byear\b/],
  ["make", /\bmake\b/],
  ["model", /\bmodel\b/],
  ["name", /\bname\b|^(customer|client|contact)$/],
];

function detectColumns(header) {
  const columns = {};
  header.forEach((title, index) => {
    const key = title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const field = COLUMN_RULES.find(([, pattern]) => pattern.test(key))?.[0];
    if (field) columns[field] = [...(columns[field] || []), index];
  });
  // The shop export this page was first built for has no usable titles: name, phone and vehicle
  // sit in its 5th, 6th and 7th columns.
  if (!columns.name && !columns.first && !columns.last && header.length >= 7) return { name: [4], phone: [5], vehicle: [6] };
  return columns;
}

const cellsOf = (row, cols = []) => cols.map((i) => row[i] || "").filter(Boolean);

function parseVehicle(text) {
  if (!text || text.length < 3) return null;
  const yearMatch = text.match(/\b(19|20)\d{2}\b/);
  const words = text.replace(yearMatch ? yearMatch[0] : "", "").trim().split(/\s+/).filter(Boolean);
  const make = words[0] || "Unknown";
  return { text, year: yearMatch ? parseInt(yearMatch[0], 10) : 0, make, model: words.slice(1).join(" ") || make };
}

function readRow(row, c) {
  const name = cellsOf(row, c.name)[0] || cellsOf(row, [...(c.first || []), ...(c.last || [])]).join(" ");
  const phone = cellsOf(row, c.phone).find(phoneKey) || "";
  const area = cellsOf(row, [...(c.region || []), ...(c.postal || [])]).join(" ");
  const vehicle = cellsOf(row, c.vehicle)[0] || cellsOf(row, [...(c.year || []), ...(c.make || []), ...(c.model || [])]).join(" ");
  return {
    name: name.replace(/\s+/g, " ").trim(),
    phone: /[a-z]/i.test(phone) ? phone.replace(/\D/g, "") : phone,
    email: cellsOf(row, c.email).find(emailKey) || "",
    address: [...cellsOf(row, c.address), ...cellsOf(row, c.city), area].filter(Boolean).join(", "),
    vehicle: parseVehicle(vehicle),
  };
}

const isPlaceholder = (name) => /undefined/i.test(name) || /^customer \d+$/i.test(name);
const agrees = (a, b, key) => !a || !b || key(a) === key(b);

export function readCustomerCsv(text) {
  const rows = parseCsv(text);
  if (rows.length < 2) return { error: "Start with a row of column names (like Name, Phone, Email, Address), then one customer per row." };
  const columns = detectColumns(rows[0]);
  if (!columns.name && !columns.first && !columns.last) return { error: "Couldn't find a Name column. Start the list with a row of column names, like Name, Phone, Email, Address." };
  const entries = [];
  const byName = new Map();
  let skipped = 0;
  rows.slice(1).forEach((cells, i) => {
    const line = i + 2;
    const r = readRow(cells, columns);
    if (isPlaceholder(r.name) || (!r.name && !r.phone && !r.email)) { skipped++; return; }
    const key = nameKey(r.name);
    // The same customer on several rows (one per vehicle, or simply repeated) becomes one entry,
    // unless those rows give different phones or emails.
    const same = key && (byName.get(key) || []).find((e) => agrees(e.phone, r.phone, phoneKey) && agrees(e.email, r.email, emailKey));
    if (same) {
      same.rows.push(line);
      same.phone = same.phone || r.phone;
      same.email = same.email || r.email;
      same.address = same.address || r.address;
      if (r.vehicle && !same.vehicles.some((v) => v.text === r.vehicle.text)) same.vehicles.push(r.vehicle);
      return;
    }
    const entry = { id: `row-${line}`, rows: [line], name: r.name, phone: r.phone, email: r.email, address: r.address, vehicles: r.vehicle ? [r.vehicle] : [] };
    entries.push(entry);
    if (key) byName.set(key, [...(byName.get(key) || []), entry]);
  });
  const has = { phone: !!columns.phone, email: !!columns.email, address: !!(columns.address || columns.city || columns.region || columns.postal) };
  return { entries, skipped, has };
}