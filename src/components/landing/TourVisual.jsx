import React from "react";
import DemoFrame from "./DemoFrame";
import StatusTimeline from "./StatusTimeline";
import LandingDocPreview from "./LandingDocPreview";

// Steps that render a realistic, app-matching document preview instead of the
// generic records list (Estimate workflow + Invoice/portal workflow).
const DOC_PREVIEW = new Set([3, 6]);

export default function TourVisual({ step, index }) {
  return <DemoFrame title={step.title} compact><div className="lp-tour-metrics">{step.metrics.map(([label,value])=><span key={label}><small>{label}</small><b>{value}</b></span>)}</div><div className="lp-mini-flow">{step.flow.map((item,i)=><React.Fragment key={item}><span>{item}</span>{i < step.flow.length-1 && <i aria-hidden="true">→</i>}</React.Fragment>)}</div>{DOC_PREVIEW.has(index) ? <LandingDocPreview variant={index === 6 ? "invoice" : "estimate"}/> : <div className={index === 4 ? "lp-photo-grid" : "lp-tour-records"}>{step.records.map((item,i)=><div key={item}><span>{index === 4 ? `PHOTO ${i+1}` : String(i+1).padStart(2,"0")}</span><p>{item}</p></div>)}</div>}{index === 3 && <StatusTimeline compact/>}{index === 6 && <><div className="lp-scanner-mode-strip"><span>SCAN<small>Guided health report</small></span><span>LIVE DATA<small>Supported sensors</small></span><span>TECH MODE<small>Professional use</small></span></div><p className="lp-ai-note"><strong>LBC AI Scanner:</strong> AI assists; the technician verifies. Compatibility, diagnosis, repair outcomes, live-data availability, and ECU commands are not guaranteed.</p></>}</DemoFrame>;
}