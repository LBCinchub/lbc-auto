import React from "react";

export default function DemoFrame({ title, children, compact = false }) {
  return (
    <div className={`lp-demo-frame ${compact ? "lp-demo-compact" : ""}`} aria-label={`${title} sample interface`}>
      <div className="lp-demo-bar">
        <div className="lp-demo-dots" aria-hidden="true"><span /><span /><span /></div>
        <strong>{title}</strong><span className="lp-sample-badge">DEMO / SAMPLE</span>
      </div>
      <div className="lp-demo-body">{children}</div>
    </div>
  );
}