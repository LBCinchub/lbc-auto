import React from "react";

// Premium, understated "AI + Blockchain" identity strips for the public landing.
// Thin, non-interactive, inline-SVG icons only. Matches the dark theme.

const Spark = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l2.5 2.5M16.5 16.5 19 19M19 5l-2.5 2.5M7.5 16.5 5 19" />
    <circle cx="12" cy="12" r="2.4" fill="currentColor" stroke="none" />
  </svg>
);
const Chain = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1" />
    <path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1" />
  </svg>
);
const Coin = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9.2c.3-1 1.2-1.7 2.5-1.7 1.6 0 2.5.8 2.5 1.9 0 2.7-5 1.4-5 4.1 0 1.1 1 1.9 2.6 1.9 1.3 0 2.2-.7 2.5-1.7" />
    <path d="M12 6.5v1.4M12 16.1v1.4" />
  </svg>
);
const Bolt = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M13 2 4 14h7l-1 8 9-12h-7z" />
  </svg>
);

const chip = { display: "inline-flex", alignItems: "center", gap: 7 };
const dot = { width: 3, height: 3, borderRadius: "50%", background: "currentColor", opacity: .35, display: "inline-block" };

// Thin top strip — first thing visitors see.
export function TopTechBanner() {
  return (
    <div className="lp-tech-banner" role="banner">
      <div className="lp-container lp-tech-inner">
        <span className="lp-tech-chip" style={chip}>
          <Spark className="lp-tech-ico" /> Powered by LBC AI
        </span>
        <span className="lp-tech-sep" style={dot} aria-hidden="true" />
        <span className="lp-tech-chip" style={chip}>
          <Chain className="lp-tech-ico" /> Connected to Solana Blockchain
        </span>
        <span className="lp-tech-sep" style={dot} aria-hidden="true" />
        <span className="lp-tech-chip" style={chip}>
          <Coin className="lp-tech-ico" /> $LBC Token
        </span>
      </div>
    </div>
  );
}

// "Powered By" strip — sits just below the hero.
export function PoweredByStrip() {
  const items = [
    { icon: <Spark />, label: "LBC AI" },
    { icon: <Chain />, label: "Solana" },
    { icon: <Coin />, label: "$LBC Token" },
    { icon: <Bolt />, label: "Base44" },
  ];
  return (
    <div className="lp-powered-strip">
      <div className="lp-container lp-powered-inner">
        <span className="lp-powered-label">POWERED BY</span>
        {items.map((it, i) => (
          <React.Fragment key={it.label}>
            <span className="lp-powered-item">{it.icon}{it.label}</span>
            {i < items.length - 1 && <span className="lp-powered-div" aria-hidden="true" />}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}