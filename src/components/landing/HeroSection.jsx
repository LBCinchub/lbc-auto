import React from "react";
import { ArrowRight, CalendarDays, Car, ClipboardList, FileCheck2, Wrench } from "lucide-react";
import DemoFrame from "./DemoFrame";

export default function HeroSection({ onTour, onSignIn }) {
  return <section id="hero" className="lp-hero"><div className="lp-container lp-hero-grid">
    <div className="lp-hero-copy"><span className="lp-eyebrow">AUTO REPAIR SHOP MANAGEMENT SOFTWARE</span><h1>Run Your Entire Auto Shop From One Center Control.</h1><p>LBC Auto connects appointments, customers, vehicles, repair orders, estimates, technician work, invoices, diagnostics, and customer communication in one secure shop management system.</p>
      <div className="lp-hero-actions"><button className="lp-primary" onClick={onTour}>Take the Product Tour <ArrowRight /></button><button className="lp-secondary" onClick={onSignIn}>Sign In to LBC Auto</button><a className="lp-text-link" href="/CustomerPortal">Customer Portal</a></div>
    </div>
    <DemoFrame title="Center Control"><div className="lp-kpis"><span><small>Appointments</small><b>12</b></span><span><small>Active work</small><b>8</b></span><span><small>Ready today</small><b>4</b></span></div><div className="lp-demo-flow">{[[CalendarDays,"Appointment"],[Car,"Vehicle"],[ClipboardList,"Repair Order"],[Wrench,"Technician"],[FileCheck2,"Invoice"]].map(([Icon,label])=><span key={label}><Icon />{label}</span>)}</div><div className="lp-demo-list"><span><i className="is-teal" /> 8:30 — Sample vehicle intake</span><span><i className="is-blue" /> 10:00 — Demo estimate review</span><span><i /> 2:30 — Sample delivery</span></div></DemoFrame>
  </div></section>;
}