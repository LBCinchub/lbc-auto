/**
 * Global Title Case for human-readable text fields.
 *
 * Capitalizes the first letter of EVERY word, in real time, for every
 * eligible text input and textarea app-wide. Because the transform mutates
 * the actual input value (via the native setter so React's controlled
 * onChange picks it up), the title-cased value is stored to the database on
 * save — not just displayed. A matching global CSS rule (text-transform:
 * capitalize) provides the same visual feedback.
 *
 * The rest of each word is left exactly as typed (intentional capitals are
 * preserved); only the first letter of each word is uppercased. Numbers and
 * special characters are unaffected.
 *
 * Excluded (kept as typed): password, email, tel, number, url, date, time,
 * datetime-local, hidden, file, checkbox, radio, range, color inputs, plus
 * any text field whose name/id/placeholder suggests a VIN, license plate,
 * PIN/passcode, phone, or URL, and any element marked with data-no-capitalize.
 */

const EXCLUDED_TYPES = new Set([
  "password", "email", "tel", "number", "url",
  "date", "time", "datetime-local", "hidden", "file",
  "checkbox", "radio", "range", "color",
]);

const EXCLUDE_KEYWORDS = ["vin", "plate", "passcode", "pin", "phone", "mobile", "tel", "url", "website"];

function toTitleCase(value) {
  if (!value) return value;
  // Uppercase the first letter of each word; words are separated by whitespace
  // or hyphens (so "re-torque" -> "Re-Torque"). Leave all other characters as-typed.
  return value.replace(/(^|[\s\-])([a-z])/g, (_, pre, ch) => pre + ch.toUpperCase());
}

function isExcludedField(el) {
  if (el.getAttribute("data-no-capitalize") !== null) return true;
  if (el.closest("[data-no-capitalize]")) return true;
  const hint = `${el.name || ""} ${el.id || ""} ${el.placeholder || ""}`.toLowerCase();
  return EXCLUDE_KEYWORDS.some((kw) => hint.includes(kw));
}

function isEligible(el) {
  if (!el || el.disabled || el.readOnly) return false;
  const tag = el.tagName;
  if (tag === "TEXTAREA") return !isExcludedField(el);
  if (tag !== "INPUT") return false;
  const type = (el.type || "text").toLowerCase();
  if (type !== "text" && type !== "search" && type !== "") return false;
  return !isExcludedField(el);
}

const inputSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
const taSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;

let formatting = false;

function onInput(e) {
  if (formatting) return;
  const el = e.target;
  if (!isEligible(el)) return;
  const original = el.value;
  const next = toTitleCase(original);
  if (next === original) return;
  formatting = true;
  const start = el.selectionStart;
  const end = el.selectionEnd;
  try {
    (el.tagName === "TEXTAREA" ? taSetter : inputSetter).call(el, next);
    el.setSelectionRange(start, end);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  } catch {
    // never let formatting break the input
  } finally {
    formatting = false;
  }
}

export function installAutoCapitalize() {
  document.addEventListener("input", onInput, true);
}