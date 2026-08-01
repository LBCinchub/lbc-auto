import React, { useState } from "react";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { flowStages } from "./landingData";
import DemoFrame from "./DemoFrame";
import StatusTimeline from "./StatusTimeline";

export default function WorkflowSection() {
  const [active,setActive]=useState(0), item=flowStages[active];
  return <section id="how-it-works" className="lp-section"><div className="lp-container"><div className="lp-section-head"><span className="lp-eyebrow">HOW IT WORKS</span><h2>Every handoff keeps its context.</h2><p>Select a stage to see how one service story moves through the shop.</p></div><div className="lp-workflow" role="tablist" aria-label="Connected repair workflow">{flowStages.map(([name],i)=><React.Fragment key={name}><button role="tab" aria-selected={i===active} onClick={()=>setActive(i)}>{name}</button>{i<flowStages.length-1&&<ArrowRight aria-hidden="true"/>}</React.Fragment>)}</div><div className="lp-flow-detail"><div><span className="lp-step-number">{String(active+1).padStart(2,"0")}</span><h3>{item[0]}</h3><p>{item[1]}</p></div><DemoFrame title={`${item[0]} view`} compact><div className="lp-flow-sample"><CheckCircle2/><span><small>Connected workflow stage</small><strong>{item[0]}</strong><p>Sample record • No customer data</p></span></div></DemoFrame></div><StatusTimeline/></div></section>;
}