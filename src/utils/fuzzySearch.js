/**
 * Fuzzy multi-token search utility.
 * Splits the query into whitespace-separated tokens and requires
 * ALL tokens to match somewhere across the provided field values.
 *
 * Example: "John 555" matches a record where full_name="John Doe" and phone="555-1234"
 *
 * @param {string} query - The raw search string from the user.
 * @param {string[]} fieldValues - Array of field values from the record (strings or nullish).
 * @returns {boolean}
 */
export function fuzzyMatch(query, fieldValues) {
  if (!query || !query.trim()) return true;

  const tokens = query.trim().toLowerCase().split(/\s+/);
  const haystack = fieldValues
    .map(v => (v == null ? "" : String(v)))
    .join(" ")
    .toLowerCase();

  return tokens.every(token => haystack.includes(token));
}