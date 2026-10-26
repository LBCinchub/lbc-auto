// Some automation tools and browser extensions set a field's value in code and then
// fire an "input"/"change" event. React skips those events when its internal copy of
// the value already matches, so the text never reaches the form and disappears on the
// next render. For those synthetic (untrusted) events only, mark the value as changed so
// the field's onChange runs with exactly what is in the box. Real typing is untouched.
const TEXT_TYPES = new Set([
  "text", "search", "email", "tel", "url", "number", "password", "textarea",
  "date", "time", "datetime-local", "month", "week",
]);

function syncProgrammaticValue(e) {
  if (e.isTrusted) return;
  const el = e.target;
  if (!el || (el.tagName !== "INPUT" && el.tagName !== "TEXTAREA")) return;
  if (!TEXT_TYPES.has(el.type)) return;
  el._valueTracker?.setValue(`${el.value}\u0000`);
}

export function installProgrammaticInputSync() {
  document.addEventListener("input", syncProgrammaticValue, true);
  document.addEventListener("change", syncProgrammaticValue, true);
}