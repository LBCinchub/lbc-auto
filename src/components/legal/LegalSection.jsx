import React from "react";

// Render a paragraph/li string, highlighting a leading "Label:" segment.
function renderLine(text) {
  const m = text.match(/^([A-Z][A-Za-z .,&()/'-]+?):\s+(.*)$/s);
  if (m) return (<><strong className="lp-pp-lead">{m[1]}:</strong> {m[2]}</>);
  return text;
}

function Block({ block }) {
  if (block.list) return <ul className="lp-pp-list">{block.list.map((li, j) => <li key={j}>{renderLine(li)}</li>)}</ul>;
  if (block.card) return (
    <div className="lp-pp-cards">
      {block.card.map((c, k) => (
        <div key={k} className="lp-pp-card">
          <div className="lp-pp-card-label">{c.label}</div>
          {Array.isArray(c.value)
            ? c.value.map((v, m) => <div key={m} className="lp-pp-card-val">{renderLine(v)}</div>)
            : <div className="lp-pp-card-val">{c.href ? <a href={c.href} className="lp-pp-link">{c.value}</a> : c.value}</div>}
        </div>
      ))}
    </div>
  );
  return <p className="lp-pp-p">{renderLine(block)}</p>;
}

// One numbered section of a legal page (Privacy Policy, Terms of Service).
export default function LegalSection({ num, title, blocks }) {
  return (
    <section className="lp-pp-sec">
      <div className="lp-pp-sec-head">
        <span className="lp-pp-num">{num}.</span>
        <h2 className="lp-pp-sec-title">{title}</h2>
      </div>
      <div className="lp-pp-sec-body">{blocks.map((b, i) => <Block key={i} block={b} />)}</div>
    </section>
  );
}