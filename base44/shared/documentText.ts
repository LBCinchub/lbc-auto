// Readable SMS version of ONE saved estimate/invoice ("Send As Text"): no links, no attachment.
// Built only from the document-owning shop's saved public profile and the document's SAVED amounts.
// Never included: ghost/split items, technician or internal notes, estimate notes, supplier/part costs,
// payment notes, tokens, the owner's login email, full VIN, customer address.
// Inconsistent or missing money fields block the text instead of showing invented numbers.
import { formatDocDate, normalizeDiscountType, vehicleBlock, invoiceLines, estimateLines } from "./documentPdfModel.ts";
import { containsUrl } from "./documentDelivery.ts";

export const TWILIO_BODY_MAX = 1600;   // Twilio's maximum Body length per message
export const MAX_TEXT_PARTS = 4;       // above this the document is blocked from text, never trimmed

const s = (v) => (v == null ? "" : String(v).trim());
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const isNum = (v) => v !== null && v !== undefined && v !== "" && Number.isFinite(Number(v));
const r2 = (v) => Math.round(num(v) * 100) / 100;
const money = (v) => `${r2(v) < 0 ? "-" : ""}$${Math.abs(r2(v)).toFixed(2)}`;
const qty = (q) => String(Math.round(num(q) * 100) / 100);
const u16 = (t) => t.length;

const URLISH = /(https?:\/\/\S*|www\.\S*|\b[\w-]+(\.[\w-]+)*\.(com|ca|net|org|app|tech|io|co|ly|link|me|biz|info|us)\b\S*)/gi;
const EMAILS = /[^\s@]+@[^\s@]+\.[^\s@]+/g;
const VIN = /\b[A-HJ-NPR-Z0-9]{17}\b/gi;
const clean = (v) => s(v).replace(/[\u0000-\u001f\u007f]/g, " ").replace(EMAILS, "").replace(URLISH, "").replace(/\s+/g, " ").trim();
export const hasLink = (text) => containsUrl(String(text || "").replace(EMAILS, ""));

// GSM-7 (with 2-septet extension chars) vs UCS-2 segment estimate. Carriers bill per segment.
const GSM_BASIC = "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
const GSM_EXT = "^{}\\[~]|€\f";
export function smsInfo(text) {
  let septets = 0;
  for (const ch of text) {
    if (GSM_BASIC.includes(ch)) septets += 1;
    else if (GSM_EXT.includes(ch)) septets += 2;
    else return { encoding: "UCS-2", chars: [...text].length, units: u16(text), segments: u16(text) <= 70 ? 1 : Math.ceil(u16(text) / 67) };
  }
  return { encoding: "GSM-7", chars: [...text].length, units: septets, segments: septets <= 160 ? 1 : Math.ceil(septets / 153) };
}

const fail = (error, code = "document_incomplete", status = 422) => ({ error, code, status });

// Verified public shop identity: saved shop profile only. No LBC Auto default, no login-email fallback.
export function publicShop(user) {
  const email = s(user?.business_email);
  return {
    name: clean(user?.business_name), phone: clean(user?.phone), address: clean(user?.address),
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "",
  };
}

function savedMoney(type, doc) {
  const label = type === "invoice" ? "invoice" : "estimate";
  const total = doc[type === "invoice" ? "total" : "grand_total"];
  if (!isNum(total)) return fail(`This ${label} has no saved total. Open it and save it before texting.`);
  if (!isNum(doc.parts_total) && !isNum(doc.labor_total)) return fail(`This ${label} has no saved parts or labor subtotal. Open it and save it before texting.`);
  if (!isNum(doc.tax_amount) && num(doc.tax_rate) > 0) return fail(`This ${label} has a tax rate but no saved tax amount. Open it and save it before texting.`);
  const subtotal = r2(num(doc.parts_total) + num(doc.labor_total));
  const dType = normalizeDiscountType(doc.discount_type || "$");
  const raw = dType === "percent" ? subtotal * num(doc.discount) / 100 : dType === "fixed" ? num(doc.discount) : 0;
  const discount = r2(Math.min(subtotal, Math.max(0, raw)));
  const tax = r2(doc.tax_amount);
  const t = { total: r2(total), subtotal, discount, dType, dValue: num(doc.discount), tax, taxRate: isNum(doc.tax_rate) ? num(doc.tax_rate) : null };
  if (Math.abs(Math.max(0, subtotal - discount + tax) - t.total) > 0.02) {
    return fail(`The saved amounts on this ${label} don't add up (subtotal ${money(subtotal)}, discount ${money(discount)}, tax ${money(tax)}, total ${money(t.total)}). Open it, check the amounts and save it again before texting.`);
  }
  if (type === "invoice") {
    if (doc.amount_paid != null && !isNum(doc.amount_paid)) return fail("This invoice's amount paid isn't a valid number.");
    t.paid = r2(doc.amount_paid);
    const owed = r2(Math.max(0, t.total - t.paid));
    if (isNum(doc.balance_due) && Math.abs(r2(doc.balance_due) - owed) > 0.02) {
      return fail(`This invoice's saved balance due (${money(doc.balance_due)}) doesn't match total minus paid (${money(owed)}). Open it and save it again before texting.`);
    }
    t.balance = isNum(doc.balance_due) ? r2(doc.balance_due) : owed;
  }
  return t;
}

// Keeps text lines and single blank spacers; drops skipped (false/null) entries and doubled blanks.
function joinLines(items, keepLeadingBlank = false) {
  const out = [];
  for (const x of items) {
    if (typeof x !== "string") continue;
    if (x === "" && (out[out.length - 1] === "" || (!out.length && !keepLeadingBlank))) continue;
    out.push(x);
  }
  return out.join("\n");
}

function itemLine(l, laborHours) {
  const name = clean(l.name) || clean(l.description) || (l.type === "labor" ? "Labor" : "Part");
  if (l.recommended) return `- ${name} (Recommended, not included in total)`;
  return `- ${name} ${laborHours && l.type === "labor" ? `${qty(l.qty)} hr` : `x${qty(l.qty)}`}: ${money(l.amount)}`;
}

// Greedy packing of atomic blocks into <= budget messages; null when a single block can't fit.
function pack(blocks, budget) {
  const out = []; let cur = "";
  for (const b of blocks) {
    const cand = cur ? `${cur}\n${b}` : b;
    if (u16(cand) <= budget) { cur = cand; continue; }
    if (!cur || u16(b) > budget) return null;
    out.push(cur); cur = b;
  }
  if (cur) out.push(cur);
  return out;
}

// -> { parts: [{ index, body, encoding, chars, units, segments }], part_count, segments_total, encoding, shop }
//    or { error, code, status } (nothing is ever dropped to make it fit).
export function buildDocumentText(type, doc, customer, vehicle, user, { currency = "" } = {}) {
  const isInv = type === "invoice";
  const Label = isInv ? "Invoice" : "Estimate";
  const shop = publicShop(user);
  if (!shop.name) return fail("Add your shop name in Settings (Shop Profile) before texting, so the customer can see which shop sent this.", "shop_identity_missing", 400);
  const number = clean(doc[isInv ? "invoice_number" : "estimate_number"]);
  if (!number) return fail(`This ${Label.toLowerCase()} has no ${Label.toLowerCase()} number yet. Open it and save it before texting.`);
  const lines = (isInv ? invoiceLines : estimateLines)(doc);
  if (!lines.length) return fail(`This ${Label.toLowerCase()} has no parts or services to show.`);
  const t = savedMoney(type, doc);
  if (t.error) return t;
  const cur = /^[A-Z]{3}$/.test(s(currency).toUpperCase()) ? ` ${s(currency).toUpperCase()}` : "";

  const contact = [shop.phone, shop.address, shop.email].filter(Boolean).join(" | ");
  const veh = clean(vehicleBlock(vehicle, doc.vehicle_info).info.replace(VIN, ""));
  const header = joinLines([
    shop.name, contact, "",
    isInv ? `INVOICE ${number}` : `ESTIMATE ${number}`,
    !isInv && "This is an estimate, not an invoice or an approval.",
    formatDocDate(isInv ? doc.invoice_date || doc.created_date : doc.estimate_date || doc.created_date) && `Date: ${formatDocDate(isInv ? doc.invoice_date || doc.created_date : doc.estimate_date || doc.created_date)}`,
    veh && `Vehicle: ${veh}`,
    clean(doc.customer_name || customer?.full_name) && `Customer: ${clean(doc.customer_name || customer?.full_name)}`,
    clean(doc.service_reason) && `Reason for visit: ${clean(doc.service_reason)}`,
    "", "Parts & Services:",
  ]);
  const discountLabel = t.dType === "percent" ? `Discount (${qty(t.dValue)}%)` : "Discount";
  const footer = joinLines([
    "", `Subtotal: ${money(t.subtotal)}`,
    t.discount > 0 && `${discountLabel}: -${money(t.discount)}`,
    `${t.taxRate ? `Tax (${qty(t.taxRate)}%)` : "Tax"}: ${money(t.tax)}`,
    `Total: ${money(t.total)}${cur}`,
    isInv && `Paid: ${money(t.paid)}`,
    isInv && `Balance Due: ${money(t.balance)}${cur}`,
    isInv && clean(doc.customer_note) && "", isInv && clean(doc.customer_note) && `Note: ${clean(doc.customer_note)}`,
    "", `Questions? Contact ${shop.name}${shop.phone ? ` at ${shop.phone}` : ""}.`,
    "Reply STOP to opt out.",
  ], true);
  const blocks = [header, ...lines.map((l) => itemLine(l, !isInv)), footer];

  let bodies;
  const whole = blocks.join("\n");
  if (u16(whole) <= TWILIO_BODY_MAX) bodies = [whole];
  else {
    const cont = (i, n) => `${shop.name} - ${Label} ${number} (${i}/${n}), continued:`;
    const reserve = Math.max(u16(cont(MAX_TEXT_PARTS * 10, MAX_TEXT_PARTS * 10)), 10) + 1;
    const packed = pack(blocks, TWILIO_BODY_MAX - reserve);
    if (!packed) return fail(`One line on this ${Label.toLowerCase()} is too long for a text message. Send the PDF or email it instead.`, "too_long");
    const n = packed.length;
    if (n > MAX_TEXT_PARTS) return fail(`This ${Label.toLowerCase()} is too long to text safely (it would need ${n} separate texts; the limit is ${MAX_TEXT_PARTS}). Nothing was cut. Send the PDF or email it instead.`, "too_long");
    bodies = packed.map((b, i) => (i === 0 ? b.replace(/^[^\n]*/, (first) => `${first} (1/${n})`) : `${cont(i + 1, n)}\n${b}`));
  }
  if (bodies.some(hasLink)) return fail("This text would contain a web link, so it was blocked. Remove links from the shop profile or line items.", "link_blocked");
  const parts = bodies.map((body, i) => ({ index: i + 1, body, ...smsInfo(body) }));
  return {
    parts, part_count: parts.length, segments_total: parts.reduce((a, p) => a + p.segments, 0),
    encoding: parts.some((p) => p.encoding === "UCS-2") ? "UCS-2" : "GSM-7", shop,
  };
}