import React from "react";
import { Mail, Car, Wrench, Package, Ghost } from "lucide-react";

// Realistic, app-matching document preview for the public product tour.
// Visual showcase only — no interactive functionality, all sample data.
// Colors mirror the internal StatusBadge pills so the landing feels like the app.

const BADGES = {
  approved: { label: "Approved", bg: "rgba(16,185,129,.16)", color: "#34d399", border: "rgba(16,185,129,.4)" },
  partial: { label: "Partial", bg: "rgba(234,179,8,.16)", color: "#fbbf24", border: "rgba(234,179,8,.4)" },
  invoiced: { label: "Invoiced", bg: "rgba(32,198,200,.16)", color: "#5fdde0", border: "rgba(32,198,200,.42)" },
  paid: { label: "Paid", bg: "rgba(16,185,129,.18)", color: "#34d399", border: "rgba(16,185,129,.42)" },
};

const surface = { background: "var(--lp-surface)", border: "1px solid var(--lp-line)", borderRadius: 12 };
const card = { ...surface, padding: 16 };
const sectionHead = { display: "flex", alignItems: "center", gap: 8, color: "var(--lp-teal)", fontSize: 10, fontWeight: 800, letterSpacing: ".12em", margin: "0 0 12px" };
const muted = { color: "var(--lp-muted)", fontSize: 11 };
const labelMuted = { color: "#63798e", fontSize: 9, fontWeight: 700, letterSpacing: ".08em" };

function TypeBadge({ type }) {
  const isLabor = type === "labor";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 7px", borderRadius: 5, fontSize: 9, fontWeight: 800, letterSpacing: ".04em",
      background: isLabor ? "rgba(79,143,247,.15)" : "rgba(32,198,200,.15)",
      color: isLabor ? "#7fb3fa" : "#5fdde0",
      border: `1px solid ${isLabor ? "rgba(79,143,247,.32)" : "rgba(32,198,200,.32)"}`,
    }}>
      {isLabor ? <Wrench style={{ width: 10, height: 10 }} /> : <Package style={{ width: 10, height: 10 }} />}
      {isLabor ? "Labor" : "Part"}
    </span>
  );
}

function Row({ name, type, desc, unit, qty, total }) {
  return (
    <div className="lp-doc-row" style={{ alignItems: "center", padding: "11px 0", borderBottom: "1px solid #15273a" }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
          <TypeBadge type={type} />
          <strong style={{ color: "#e6eef5", fontSize: 12 }}>{name}</strong>
        </div>
        {desc && <div style={{ ...muted, fontSize: 10 }}>{desc}</div>}
      </div>
      <div style={{ ...muted, textAlign: "right" }}>${unit.toFixed(2)}</div>
      <div style={{ ...muted, textAlign: "center" }}>{qty}</div>
      <div style={{ color: "#dce6ef", fontWeight: 700, fontSize: 12, textAlign: "right" }}>${total.toFixed(2)}</div>
    </div>
  );
}

function Totals({ subtotal, tax, total, paid, balance }) {
  const line = (l, v, strong, accent) => (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", ...strong ? { fontWeight: 800, color: "#fff", borderTop: "1px solid var(--lp-line)", marginTop: 6, paddingTop: 10, fontSize: 14 } : muted }}>
      <span>{l}</span><span style={accent ? { color: accent } : undefined}>{v}</span>
    </div>
  );
  return (
    <div style={{ marginTop: 12 }}>
      {line("Subtotal", `$${subtotal.toFixed(2)}`)}
      {line("Tax (13%)", `$${tax.toFixed(2)}`)}
      {line("Total", `$${total.toFixed(2)}`, true)}
      {paid != null && line("Amount Paid", `$${paid.toFixed(2)}`, false, "#34d399")}
      {balance != null && line("Balance Due", `$${balance.toFixed(2)}`, true, "#fbbf24")}
      <div style={{ ...muted, fontSize: 9, textAlign: "right", marginTop: 6 }}>incl. tax</div>
    </div>
  );
}

function GhostBlock({ items, subtotal, tax, total }) {
  return (
    <div style={{ opacity: .62, border: "1px dashed rgba(32,198,200,.4)", borderRadius: 10, padding: 14, marginTop: 14, background: "rgba(32,198,200,.04)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <Ghost style={{ width: 15, height: 15, color: "var(--lp-teal)" }} />
        <strong style={{ color: "var(--lp-teal)", fontSize: 11, letterSpacing: ".06em" }}>REMAINING WORK — GHOST</strong>
      </div>
      {items.map((it) => (
        <div key={it.name} className="lp-doc-row" style={{ alignItems: "center", padding: "8px 0", borderBottom: "1px solid #14283d" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <TypeBadge type={it.type} />
            <span style={{ color: "#cdd9e3", fontSize: 12 }}>{it.name}</span>
          </div>
          <div style={{ ...muted, textAlign: "right" }}>${it.unit.toFixed(2)}</div>
          <div style={{ ...muted, textAlign: "center" }}>{it.qty}</div>
          <div style={{ color: "#cdd9e3", fontWeight: 700, fontSize: 12, textAlign: "right" }}>${it.total.toFixed(2)}</div>
        </div>
      ))}
      <Totals subtotal={subtotal} tax={tax} total={total} />
    </div>
  );
}

export default function LandingDocPreview({ variant = "estimate" }) {
  const isInvoice = variant === "invoice";
  const badge = BADGES[isInvoice ? "partial" : "approved"];

  const completedItems = [
    { name: "Front Brake Pads", type: "part", desc: "Ceramic pad set · axle", unit: 180, qty: 2, total: 360 },
    { name: "Rotor Resurface", type: "labor", desc: "Lathe cut · both front", unit: 90, qty: 1.5, total: 135 },
  ];
  const completedSub = 495, completedTax = 64.35, completedTotal = 559.35;

  const ghostItems = [
    { name: "Caliper Replacement", type: "labor", desc: "Reman caliper · driver side", unit: 120, qty: 1, total: 120 },
    { name: "Wheel Seal Kit", type: "part", desc: "Front seal kit", unit: 45, qty: 1, total: 45 },
  ];
  const ghostSub = 165, ghostTax = 21.45, ghostTotal = 186.45;

  const estItems = [
    { name: "Front Brake Pads", type: "part", desc: "Ceramic pad set · axle", unit: 180, qty: 2, total: 360 },
    { name: "Rotor Resurface", type: "labor", desc: "Lathe cut · both front", unit: 90, qty: 1.5, total: 135 },
    { name: "Caliper Inspection", type: "labor", desc: "Slide pin & boot check", unit: 110, qty: 1, total: 110 },
  ];
  const estSub = 605, estTax = 78.65, estTotal = 683.65;

  return (
    <div className="lp-doc-preview" style={surface} aria-label={`${variant} sample preview`}>
      {/* Doc header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottom: "1px solid var(--lp-line)" }}>
        <div>
          <div style={{ ...labelMuted, color: "var(--lp-muted)" }}>{isInvoice ? "INVOICE" : "ESTIMATE"} · DEMO</div>
          <strong style={{ color: "#fff", fontSize: 18, letterSpacing: "-.01em" }}>{isInvoice ? "INV-4F2A9" : "EST-7C1B3"}</strong>
        </div>
        <span style={{
          padding: "5px 11px", borderRadius: 999, fontSize: 11, fontWeight: 800, letterSpacing: ".03em",
          background: badge.bg, color: badge.color, border: `1px solid ${badge.border}`,
        }}>{badge.label}</span>
      </div>

      <div style={{ padding: 16 }}>
        {/* Info cards */}
        <div className="lp-doc-info">
          <div style={card}>
            <div style={sectionHead}><UserRound /> CUSTOMER INFORMATION</div>
            <strong style={{ color: "#e6eef5", fontSize: 13, display: "block", marginBottom: 8 }}>Jordan Mitchell</strong>
            <div style={{ display: "flex", alignItems: "center", gap: 7, ...muted, marginBottom: 4 }}>
              <Phone /> 613-314-1994
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 7, ...muted }}>
              <Mail style={{ width: 12, height: 12 }} /> Jordan.Mitchell@Email.Com
            </div>
          </div>
          <div style={card}>
            <div style={sectionHead}><Car style={{ width: 12, height: 12 }} /> VEHICLE INFORMATION</div>
            <strong style={{ color: "#e6eef5", fontSize: 13, display: "block", marginBottom: 8 }}>2019 Honda Civic LX</strong>
            <div style={{ ...muted, fontSize: 10, lineHeight: 1.7 }}>
              <div>VIN: 2H…G742118 · Plate: ARPT 472</div>
              <div>Engine: 1.5L Turbo · Color: Lunar Silver</div>
            </div>
          </div>
        </div>

        {/* Line items */}
        <div style={{ ...card, marginTop: 12 }}>
          <div style={{ ...sectionHead, marginBottom: 8 }}>WORK &amp; LINE ITEMS</div>
          <div className="lp-doc-headrow" style={{ padding: "0 0 8px", borderBottom: "1px solid var(--lp-line)", ...labelMuted }}>
            <span>ITEM</span><span style={{ textAlign: "right" }}>UNIT</span><span style={{ textAlign: "center" }}>QTY</span><span style={{ textAlign: "right" }}>TOTAL</span>
          </div>
          {isInvoice
            ? completedItems.map((it) => <Row key={it.name} {...it} />)
            : estItems.map((it) => <Row key={it.name} {...it} />)}
          {isInvoice
            ? <Totals subtotal={completedSub} tax={completedTax} total={completedTotal} paid={300} balance={259.35} />
            : <Totals subtotal={estSub} tax={estTax} total={estTotal} />}
        </div>

        {/* Ghost Mode showcase — invoice variant only */}
        {isInvoice && (
          <>
            <div style={{ ...labelMuted, color: "var(--lp-muted)", margin: "16px 0 0", textAlign: "center" }}>
              GHOST MODE — SPLIT / PHASED BILLING SHOWCASE
            </div>
            <GhostBlock items={ghostItems} subtotal={ghostSub} tax={ghostTax} total={ghostTotal} />
            <div style={{ ...muted, fontSize: 9, textAlign: "center", marginTop: 8 }}>
              Completed work bills now · Remaining work tracked for a follow-up invoice
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Small inline icons re-used for info rows
function UserRound() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-7 8-7s8 3 8 7" />
    </svg>
  );
}
function Phone() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}