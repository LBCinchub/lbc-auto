// Pure helpers for LBC Auto AI replies. No network, no data access.

// Sections that may appear in customer-facing estimate copy. Staff-only
// sections (e.g. Price Evidence, internal discounts) are always excluded.
const ESTIMATE_SECTIONS = ["vehicle and work", "suggested parts/labor", "suggested parts", "suggested labor", "missing details"];

// Strip markdown/HTML to clean plain text with numbered points preserved.
export function toPlainText(md = "") {
  return String(md)
    .replace(/<[^>]*>/g, "")
    .replace(/```[\s\S]*?```/g, (b) => b.replace(/```\w*\n?/g, ""))
    .replace(/^\s*#{1,6}\s*/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/(^|[^*])\*(?!\s)([^*\n]+)\*/g, "$1$2")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)")
    .replace(/^\s*[-*+]\s+/gm, "• ")
    .replace(/^[ \t]*\|?[ \t:-]+\|[ \t|:-]*$/gm, "")
    .replace(/^[ \t]*\|(.*)\|[ \t]*$/gm, (_, row) => row.split("|").map((c) => c.trim()).filter(Boolean).join(" — "))
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Display-only: keep the reply's own line breaks (Markdown would merge single newlines into one
// paragraph). Text, VINs, part numbers and units are never changed, only line structure.
const LIST_LINE = /^\s*([-*+•]|\d+[.)])\s/;
export function toDisplayMarkdown(md = "") {
  const lines = String(md).split("\n");
  const out = [];
  lines.forEach((line, i) => {
    const next = lines[i + 1];
    out.push(line);
    if (next == null || !line.trim() || !next.trim()) return;
    const a = LIST_LINE.test(line), b = LIST_LINE.test(next);
    if (a && b) return;
    if (!a && !b) { out[out.length - 1] = `${line}  `; return; }
    out.push("");
  });
  return out.join("\n");
}

// Split plain text into { title, body } sections by heading-like lines.
function splitSections(md) {
  const out = [];
  let cur = null;
  for (const line of String(md).split("\n")) {
    const h = line.match(/^\s*(?:#{1,6}\s*|\*\*)([^*#]+?)(?:\*\*)?:?\s*$/);
    if (h) { cur = { title: h[1].trim(), lines: [] }; out.push(cur); }
    else if (cur) cur.lines.push(line);
  }
  return out;
}

// Customer-safe estimate text, or "" when the reply has no estimate sections.
export function extractEstimateText(md = "") {
  const keep = splitSections(md).filter((s) => ESTIMATE_SECTIONS.includes(s.title.toLowerCase()));
  if (!keep.length) return "";
  return keep.map((s) => `${s.title}\n${toPlainText(s.lines.join("\n"))}`).join("\n\n").trim();
}