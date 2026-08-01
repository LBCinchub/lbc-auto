import React from "react";
import DemoFrame from "./DemoFrame";

export default function TourVisual({ step, index }) {
  return <DemoFrame title={step.title} compact><div className="lp-tour-metrics">{step.metrics.map(([label,value])=><span key={label}><small>{label}</small><b>{value}</b></span>)}</div><div className="lp-mini-flow">{step.flow.map((item,i)=><React.Fragment key={item}><span>{item}</span>{i < step.flow.length-1 && <i aria-hidden="true">→</i>}</React.Fragment>)}</div><div className={index === 4 ? "lp-photo-grid" : "lp-tour-records"}>{step.records.map((item,i)=><div key={item}><span>{index === 4 ? `PHOTO ${i+1}` : String(i+1).padStart(2,"0")}</span><p>{item}</p></div>)}</div>{index === 6 && <p className="lp-ai-note">LBC Auto AI supports technician judgment. Diagnostic findings should be verified by a qualified professional.</p>}</DemoFrame>;
}