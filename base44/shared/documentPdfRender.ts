// Renders the customer-safe document model (documentPdfModel.ts) into a real application/pdf,
// following the printed LBC Auto layout: header, Bill To / Vehicle, visit reason, items table,
// notes, payments + totals, balance due, pending work, signature and disclaimer.
// jsPDF is passed in so the same code runs in the Deno function (npm:jspdf) and in Node tests.

const W = 612, H = 792, M = 36;          // US Letter in points
const C = {
  ink: [15, 23, 42], body: [51, 65, 85], muted: [100, 116, 139], faint: [148, 163, 184],
  sky: [14, 165, 233], indigo: [99, 102, 241], pink: [236, 72, 153], green: [16, 185, 129], red: [239, 68, 68],
  panel: [248, 250, 252], line: [226, 232, 240], blueBg: [239, 246, 255], greenBg: [240, 253, 244], amberBg: [255, 251, 235], amber: [180, 83, 9],
};

// Standard PDF fonts only cover Latin-1: map common typography, drop anything else (emoji etc.).
export const pdfText = (v) => String(v ?? "")
  .replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"').replace(/[\u2013\u2014]/g, "-")
  .replace(/\u2026/g, "...").replace(/\u2022/g, "·").replace(/[^\x0A\x20-\x7E\xA0-\xFF]/g, "").trim();
const money = (n) => `${n < 0 ? "-" : ""}$${Math.abs(Number(n) || 0).toFixed(2)}`;
const DISCLAIMER = (biz) => `I hereby authorize the above repair work to be done along with procurement of all necessary materials. ${biz} may operate the above vehicle for purposes of testing, inspection or delivery at my risk. ${biz} will not be held responsible for any loss or damage to the vehicle or articles left in the vehicle in case of fire, theft, accident or any other cause beyond its control. In the event legal action is necessary to enforce this contract, I understand I am solely responsible for all costs.`;

export function renderDocumentPdf(JsPDF, model, { logo } = {}) {
  const doc = new JsPDF({ unit: "pt", format: "letter", compress: false });
  const biz = pdfText(model.shop.business_name);
  doc.setProperties({ title: pdfText(`${model.type} ${model.number}`), creator: "LBC Auto", author: biz });
  let y = M;

  const font = (size, bold = false, color = C.body) => { doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setFontSize(size); doc.setTextColor(...color); };
  const text = (t, x, yy, opts) => doc.text(pdfText(t), x, yy, opts);
  const wrap = (t, width) => doc.splitTextToSize(pdfText(t), width);
  const fill = (x, yy, w, h, color) => { doc.setFillColor(...color); doc.rect(x, yy, w, h, "F"); };
  const ensure = (h) => { if (y + h > H - 48) { doc.addPage(); y = M; } };

  // ── Header
  let left = M;
  if (logo) {
    try { doc.addImage(logo.bytes, logo.format, M, y, 96, 56); left = M + 108; } catch { left = M; }
  }
  font(18, true, C.ink); text(biz, left, y + 16);
  font(6.5, true, C.muted); text("AUTO SERVICES", left, y + 26);
  font(8.5, false, C.body);
  let cy = y + 38;
  for (const t of [model.shop.phone, model.shop.email, model.shop.address, model.shop.gst_number && `GST/Business #: ${model.shop.gst_number}`].filter(Boolean)) {
    for (const l of wrap(t, 300)) { text(l, left, cy); cy += 10.5; }
  }
  font(22, true, C.sky); text(model.type.toUpperCase(), W - M, y + 18, { align: "right" });
  font(10.5, true, C.ink); text(`# ${model.number || "-"}`, W - M, y + 32, { align: "right" });
  font(8.5, false, C.muted); text(`Date: ${model.date || "-"}`, W - M, y + 44, { align: "right" });
  y = Math.max(cy, y + (logo ? 60 : 50)) + 4;
  const third = (W - 2 * M) / 3;
  fill(M, y, third, 2, C.sky); fill(M + third, y, third, 2, C.indigo); fill(M + 2 * third, y, third, 2, C.pink);
  y += 10;

  // ── Bill To + Vehicle
  const half = (W - 2 * M - 8) / 2;
  const billLines = [model.customer.phone, model.customer.email, model.customer.address].filter(Boolean).flatMap((t) => wrap(t, half - 20));
  const v = model.vehicle;
  const vLines = v.info ? [
    ...[["Make", v.make], ["Model", v.model], ["Year", v.year], ["Color", v.color], ["Engine", v.engine_type], ["Engine Liters", v.engine_liters], ["Trim", v.trim], ["Mileage", v.mileage ? `${Number(v.mileage).toLocaleString("en-US")} km` : ""], ["Plate", v.license_plate], ["VIN", v.vin]]
      .filter(([, val]) => val).map(([k, val]) => `${k}: ${val}`),
  ] : [];
  const boxH = Math.max(30 + billLines.length * 10.5, v.info ? 40 + vLines.length * 10.5 : 0) + 4;
  ensure(boxH);
  fill(M, y, half, boxH, C.panel); fill(M, y, 3, boxH, C.sky);
  font(7, true, C.faint); text("BILL TO", M + 10, y + 11);
  font(10.5, true, C.ink); text(model.customer.name || "-", M + 10, y + 24);
  font(8.5); billLines.forEach((l, i) => text(l, M + 10, y + 36 + i * 10.5));
  if (v.info) {
    const vx = M + half + 8;
    fill(vx, y, half, boxH, [240, 249, 255]); fill(vx, y, 3, boxH, C.indigo);
    font(7, true, C.indigo); text("VEHICLE INFORMATION", vx + 10, y + 11);
    font(10.5, true, C.ink); text(wrap(v.info, half - 20)[0], vx + 10, y + 24);
    font(8.5); vLines.forEach((l, i) => text(l, vx + 10, y + 36 + i * 10.5));
  }
  y += boxH + 8;

  const noteBox = (title, lines, bg, bar, titleColor) => {
    const body = lines.flatMap((t) => wrap(t, W - 2 * M - 24));
    const h = 20 + body.length * 11;
    ensure(h);
    fill(M, y, W - 2 * M, h, bg); fill(M, y, 3, h, bar);
    font(7, true, titleColor); text(title, M + 10, y + 11);
    font(9, false, C.body); body.forEach((l, i) => text(l, M + 10, y + 23 + i * 11));
    y += h + 8;
  };
  if (model.serviceReason) noteBox("REASON FOR VISIT / CUSTOMER COMPLAINT", [model.serviceReason], C.blueBg, [59, 130, 246], [29, 78, 216]);

  // ── Items table
  const cols = { n: M + 4, item: M + 22, desc: M + 170, unit: M + 432, qty: M + 466, total: W - M - 4 };
  const header = () => {
    ensure(18);
    fill(M, y, W - 2 * M, 16, C.ink);
    font(7, true, C.faint);
    text("#", cols.n, y + 11); text("ITEM", cols.item, y + 11); text("DESCRIPTION", cols.desc, y + 11);
    text("UNIT PRICE", cols.unit, y + 11, { align: "right" }); text("QTY", cols.qty, y + 11, { align: "center" }); text("TOTAL", cols.total, y + 11, { align: "right" });
    y += 16;
  };
  header();
  if (!model.lines.length) { font(8.5, false, C.muted); text("No line items.", cols.item, y + 12); y += 18; }
  model.lines.forEach((li, i) => {
    font(9, true, C.ink);
    const nameL = wrap(li.name || li.description || "-", 140);
    font(8, false, C.muted);
    const descL = li.name ? wrap(li.description, 205) : [];
    const h = Math.max(nameL.length * 10.5 + 9, descL.length * 10 + 4) + 6;
    if (y + h > H - 48) { doc.addPage(); y = M; header(); }
    if (i % 2 === 1) fill(M, y, W - 2 * M, h, [250, 251, 255]);
    font(8, true, C.faint); text(String(i + 1), cols.n, y + 11);
    font(9, true, C.ink); nameL.forEach((l, k) => text(l, cols.item, y + 11 + k * 10.5));
    font(6.5, true, li.type === "labor" ? [67, 56, 202] : [3, 105, 161]);
    text(`${li.type === "labor" ? "LABOR" : "PART"}${li.recommended ? " · RECOMMENDED" : ""}`, cols.item, y + 11 + nameL.length * 10.5);
    font(8, false, C.muted); descL.forEach((l, k) => text(l, cols.desc, y + 11 + k * 10));
    font(8.5, false, C.body);
    text(money(li.unitPrice), cols.unit, y + 11, { align: "right" });
    text(li.recommended ? "-" : String(li.qty), cols.qty, y + 11, { align: "center" });
    font(9, true, li.recommended ? C.amber : C.ink);
    text(li.recommended ? "Recommended" : money(li.amount), cols.total, y + 11, { align: "right" });
    y += h;
    doc.setDrawColor(...C.line); doc.line(M, y, W - M, y);
  });
  y += 8;

  if (model.notes) noteBox("SHOP NOTES & RECOMMENDATIONS", model.notes.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => `- ${l}`), C.greenBg, C.green, [4, 120, 87]);

  // ── Payment history (left) + totals (right)
  const t = model.totals;
  const rows = [["Parts", money(t.partsTotal)], ["Labor", money(t.laborTotal)], ["Subtotal", money(t.subtotal)],
    [`Discount${t.discountType === "percent" && t.discountAmount > 0 ? ` (${Number(t.discountValue).toFixed(0)}%)` : ""}`, t.discountAmount > 0 ? `-${money(t.discountAmount)}` : "$0.00"]];
  if ((t.taxRate || 0) > 0 || t.taxAmount > 0) {
    const scope = t.taxAppliesTo && t.taxAppliesTo !== "both" ? ` · ${t.taxAppliesTo === "labor" ? "Labor only" : t.taxAppliesTo === "parts" ? "Parts only" : "No tax"}` : "";
    rows.push([`Tax${t.taxRate != null ? ` (${t.taxRate}%${scope})` : ""}`, money(t.taxAmount)]);
  }
  const tw = 220, tx = W - M - tw;
  const totalsH = rows.length * 14 + 26 + (t.amountPaid > 0 ? 14 : 0) + 34;
  const payH = model.payments.length ? 30 + model.payments.length * 12 : 0;
  ensure(Math.max(totalsH, payH));
  const top = y;
  if (model.payments.length) {
    font(7, true, C.faint); text("PAYMENT HISTORY", M, y + 8);
    font(7, true, C.muted); text("DATE", M, y + 22); text("RECEIPT #", M + 80, y + 22); text("METHOD", M + 160, y + 22); text("AMOUNT", tx - 16, y + 22, { align: "right" });
    font(8, false, C.body);
    model.payments.forEach((p, i) => {
      const py = y + 34 + i * 12;
      text(p.date || "-", M, py); text(p.receipt || "-", M + 80, py); text(wrap(p.method || "-", 90)[0], M + 160, py); text(money(p.amount), tx - 16, py, { align: "right" });
    });
  }
  const boxTop = top;
  fill(tx, boxTop, tw, rows.length * 14 + 26 + (t.amountPaid > 0 ? 14 : 0), C.panel);
  let ry = boxTop + 14;
  rows.forEach(([k, val], i) => {
    const isDiscount = i === 3 && t.discountAmount > 0;
    font(8.5, isDiscount, isDiscount ? C.red : C.body);
    text(k, tx + 10, ry); text(val, tx + tw - 10, ry, { align: "right" }); ry += 14;
  });
  doc.setDrawColor(...C.ink); doc.setLineWidth(1.5); doc.line(tx + 10, ry - 6, tx + tw - 10, ry - 6); doc.setLineWidth(0.5);
  font(10.5, true, C.ink); text("Grand Total", tx + 10, ry + 6); text(money(t.grandTotal), tx + tw - 10, ry + 6, { align: "right" }); ry += 18;
  if (t.amountPaid > 0) { font(8.5, false, C.green); text("Paid", tx + 10, ry + 2); text(`-${money(t.amountPaid)}`, tx + tw - 10, ry + 2, { align: "right" }); ry += 14; }
  fill(tx, ry, tw, 26, C.ink);
  font(8, true, C.faint); text("BALANCE DUE", tx + 10, ry + 16);
  font(13, true, C.sky); text(money(t.balanceDue), tx + tw - 10, ry + 17, { align: "right" });
  y = Math.max(ry + 26, top + payH) + 12;

  // ── Pending (ghost) work: shown, never part of today's charges
  if (model.ghost) {
    const g = model.ghost;
    ensure(40 + g.items.length * 12);
    font(8, true, C.muted); text("REMAINING WORK - PENDING", M, y + 8);
    font(7.5, false, C.faint); text("Not included in today's charges - to be completed on your next visit.", M, y + 19);
    y += 28;
    g.items.forEach((it) => {
      ensure(12);
      font(8.5, false, C.body);
      text(wrap(`${it.name}${it.description ? ` - ${it.description}` : ""}`, 380)[0], M + 4, y);
      text(it.qty ? String(it.qty) : "-", M + 440, y, { align: "center" }); text(money(it.amount), W - M - 4, y, { align: "right" });
      y += 12;
    });
    if (g.notes) { y += 4; noteBox("WHAT'S NEXT", [g.notes], C.amberBg, [245, 158, 11], C.amber); }
    ensure(24);
    fill(M, y, W - 2 * M, 22, C.ink);
    font(8, true, C.faint); text("REMAINING WORK TOTAL (NOT YET DUE)", M + 10, y + 14);
    font(11, true, [251, 191, 36]); text(money(g.total), W - M - 10, y + 15, { align: "right" });
    y += 32;
  }

  // ── Signature, disclaimer, thanks
  const disc = wrap(DISCLAIMER(biz), W - 2 * M);
  ensure(60 + disc.length * 9.5);
  doc.setDrawColor(203, 213, 225); doc.line(M, y + 18, M + 180, y + 18);
  font(7, false, C.faint); text("CUSTOMER SIGNATURE", M, y + 27); text("By signing, you agree to the terms below.", M, y + 36);
  y += 48;
  font(7.5, true, C.faint); text("DISCLAIMER", M, y); y += 10;
  font(7.5, false, C.faint); disc.forEach((l) => { text(l, M, y); y += 9.5; });
  y += 4;
  font(7.5, false, [148, 163, 184]); text(`Thank you for choosing ${biz} - we appreciate your trust and business.`, W / 2, y, { align: "center" }); y += 11;
  text("* Items marked as Recommended are future services identified during inspection. They are not included in today's charges.", M, y);

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p += 1) {
    doc.setPage(p);
    font(7, false, C.faint);
    text(`${model.type} ${model.number} · Page ${p} of ${pages}`, W - M, H - 24, { align: "right" });
  }
  return new Uint8Array(doc.output("arraybuffer"));
}