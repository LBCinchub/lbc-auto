import React from "react";
export default function TourTabs({ steps, active, onChange }) {
  return <div className="lp-tour-tabs" role="tablist" aria-label="Product tour chapters">{steps.map((step,i)=><button key={step.title} id={`tour-tab-${i}`} role="tab" aria-selected={active===i} aria-controls="tour-panel" tabIndex={active===i ? 0 : -1} onClick={()=>onChange(i)}><span>{i+1}</span>{step.title.replace(" Dashboard","").replace(" & LBC Auto AI","")}</button>)}</div>;
}