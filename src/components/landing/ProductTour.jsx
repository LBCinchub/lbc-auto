import React, { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, RotateCcw, X } from "lucide-react";
import { tourSteps } from "./landingData";
import TourTabs from "./TourTabs";
import TourVisual from "./TourVisual";

const KEY = "v20260801_lbc_auto_landing_tour";
export default function ProductTour({ active, setActive }) {
  const [step, setStep] = useState(0), touch = useRef(0), current = tourSteps[step];
  const select = next => { const value=Math.max(0,Math.min(6,next)); setStep(value); if(value===6) localStorage.setItem(KEY,"complete"); };
  const exit = () => { setActive(false); document.getElementById("hero")?.scrollIntoView({behavior:"smooth"}); };
  const restart = () => { localStorage.removeItem(KEY); setStep(0); setActive(true); };
  const keys = e => { if(e.key==="ArrowRight") select(step+1); if(e.key==="ArrowLeft") select(step-1); if(e.key==="Home") select(0); if(e.key==="End") select(6); };
  return <section id="tour" className="lp-section lp-tour-section" aria-labelledby="tour-title"><div className="lp-container"><div className="lp-section-head"><span className="lp-eyebrow">INTERACTIVE PRODUCT TOUR</span><h2 id="tour-title">Follow one connected shop workflow.</h2><p>Explore what owners, technicians, and customers see—using sample content only.</p></div>
    {!active ? <button className="lp-tour-overview" onClick={()=>setActive(true)}><span>Seven guided chapters</span><strong>Start the product tour</strong><ArrowRight /></button> : <div className="lp-tour" tabIndex="0" onKeyDown={keys} onTouchStart={e=>touch.current=e.touches[0].clientX} onTouchEnd={e=>{const d=e.changedTouches[0].clientX-touch.current;if(Math.abs(d)>50) select(step+(d<0?1:-1));}}>
      <TourTabs steps={tourSteps} active={step} onChange={select}/><div className="lp-tour-progress"><span aria-live="polite">Step {step+1} of 7: {current.title}</span><i><b style={{width:`${((step+1)/7)*100}%`}} /></i></div>
      <div id="tour-panel" role="tabpanel" aria-labelledby={`tour-tab-${step}`} className="lp-tour-panel"><div className="lp-tour-copy"><span className="lp-eyebrow">{current.eyebrow}</span><h3>{current.title}</h3><p>{current.description}</p><ul>{current.bullets.map(x=><li key={x}>{x}</li>)}</ul></div><TourVisual step={current} index={step}/></div>
      <div className="lp-tour-controls"><button onClick={()=>select(step-1)} disabled={step===0}><ArrowLeft /> Back</button><div><button onClick={restart}><RotateCcw /> Restart Tour</button><button onClick={exit}><X /> Exit Tour</button></div><button className="is-next" onClick={()=>select(step+1)} disabled={step===6}>Next <ArrowRight /></button></div>
    </div>}</div></section>;
}