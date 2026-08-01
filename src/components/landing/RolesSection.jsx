import React, { useState } from "react";
import { Building2, UserRoundCog, Users } from "lucide-react";
const roles=[
  [Building2,"Shop Owner","Center Control, operations, financials, performance, and customer communication in one shop workspace."],
  [UserRoundCog,"Technician","Assigned jobs, scoped shop PIN access, time tracking, status updates, and required documentation."],
  [Users,"Customer","A secure passcode portal for approvals, service status, invoices, appointments, and messaging."]
];
export default function RolesSection(){const [active,setActive]=useState(0);const [Icon,title,copy]=roles[active];return <section id="for-shops" className="lp-section lp-roles"><div className="lp-container"><div className="lp-section-head"><span className="lp-eyebrow">BUILT AROUND EACH ROLE</span><h2>The right view for the work at hand.</h2><p>Roles stay focused while records remain scoped to the correct shop workspace.</p></div><div className="lp-role-tabs" role="tablist">{roles.map(([,name],i)=><button key={name} role="tab" aria-selected={active===i} onClick={()=>setActive(i)}>{name}</button>)}</div><div className="lp-role-panel" role="tabpanel"><Icon/><div><h3>{title}</h3><p>{copy}</p></div></div></div></section>;}