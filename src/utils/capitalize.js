// Auto-capitalize: first letter of every word
export function toTitleCase(str = "") {
  return str.replace(/\b\w/g, c => c.toUpperCase());
}

// Capitalize first letter of each word on every keystroke
export function capWords(e, setter, field) {
  const raw = e.target.value;
  const caret = e.target.selectionStart;
  // Only capitalize the first letter of each word; preserve rest as typed
  const capped = raw.replace(/(^|\s)(\S)/g, (_, space, char) => space + char.toUpperCase());
  if (field) {
    setter(prev => ({ ...prev, [field]: capped }));
  } else {
    setter(capped);
  }
}
