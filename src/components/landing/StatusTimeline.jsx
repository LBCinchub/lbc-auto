import React, { useState } from "react";
import { ArrowRight, UserRound } from "lucide-react";
import { statusGroups } from "./landingData";
import "./StatusTimeline.css";

export default function StatusTimeline({ compact=false }) {
  const [group,setGroup]=useState(0), [status,setStatus]=useState(0), current=statusGroups[group].items[status];
  const chooseGroup=i=>{setGroup(i);setStatus(0);};
  return <div className={`lp-status-timeline ${compact?"is-compact":""}`}><div className="lp-status-head"><strong>DEMO STATUS PROGRESSION</strong><span>Production-supported record states</span></div><div className="lp-status-groups" role="tablist" aria-label="Document status groups">{statusGroups.map((item,i)=><button key={item.label} role="tab" aria-selected={group===i} onClick={()=>chooseGroup(i)}>{item.label}</button>)}</div><div className="lp-status-chips" aria-label={`${statusGroups[group].label} statuses`}>{statusGroups[group].items.map((item,i)=><button key={item.label} aria-pressed={status===i} onClick={()=>setStatus(i)}>{item.label}</button>)}</div><div className="lp-status-detail" aria-live="polite"><div><small>WHAT IT MEANS</small><p>{current.meaning}</p></div><div><small>WHO ACTS NEXT</small><p><UserRound/>{current.actor}</p></div><div><small>NEXT AVAILABLE</small><p><ArrowRight/>{current.next}</p></div></div></div>;
}