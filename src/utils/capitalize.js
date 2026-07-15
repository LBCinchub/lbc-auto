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

// Capitalize specified string fields in a data object (returns shallow copy)
export function capitalizeFields(data, fields) {
  const result = { ...data };
  for (const f of fields) {
    if (typeof result[f] === "string" && result[f].trim()) {
      result[f] = toTitleCase(result[f]);
    }
  }
  return result;
}

// Capitalize specified string fields in each item of an array (returns new array)
export function capitalizeArrayItems(arr, fields) {
  if (!Array.isArray(arr)) return arr;
  return arr.map(item => {
    if (!item || typeof item !== "object") return item;
    const result = { ...item };
    for (const f of fields) {
      if (typeof result[f] === "string" && result[f].trim()) {
        result[f] = toTitleCase(result[f]);
      }
    }
    return result;
  });
}