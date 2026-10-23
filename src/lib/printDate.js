// Date-only values (YYYY-MM-DD) are calendar dates: format them as-is, never via UTC midnight
// (which shifts to the previous day in western timezones) and never with an invented time.
export function formatRecordDate(value) {
  if (!value) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value));
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toLocaleDateString();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString();
}