import React from "react";
import { ArrowRight, BadgeCheck, CalendarDays, Car, ClipboardList, FileCheck2, Wrench } from "lucide-react";
import DemoFrame from "./DemoFrame";

export default function HeroSection({ onTour, onSignIn }) {
  return <section id="hero" className="lp-hero"><div className="lp-container lp-hero-grid">
    <div className="lp-hero-copy"><span className="lp-eyebrow">AUTO REPAIR SHOP MANAGEMENT SOFTWARE</span>
      <span className="lp-ai-pill"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="13" height="13"><path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l2.5 2.5M16.5 16.5 19 19M19 5l-2.5 2.5M7.5 16.5 5 19"/><circle cx="12" cy="12" r="2.4" fill="currentColor" stroke="none"/></svg> AI-Powered · LBC AI Inside</span>
      <h1>Run Your Entire Auto Shop From One Center Control.</h1><p>LBC Auto connects appointments, customers, vehicles, estimates, customer decisions, repair orders, technician work, invoices, diagnostics, and customer communication in one secure shop management system.</p><p className="lp-capability-line">Operations, team management, parts, diagnostics, financials, reporting, customer communication, and AI assistance—connected around every vehicle.</p><p className="lp-blockchain-line">Powered by LBC AI and connected to the Solana blockchain with the $LBC token for payments and rewards.</p>
      <div className="lp-hero-actions"><button className="lp-primary" onClick={onTour}>Take the Product Tour <ArrowRight /></button><button className="lp-secondary" onClick={onSignIn}>Sign In to LBC Auto</button><a className="lp-text-link" href="/CustomerPortal">Customer Portal</a></div>
    </div>
    <DemoFrame title="Center Control"><div className="lp-kpis"><span><small>Appointments</small><b>12</b></span><span><small>Active work</small><b>8</b></span><span><small>Ready today</small><b>4</b></span></div><div className="lp-demo-flow">{[[CalendarDays,"Appointment"],[Car,"Customer & Vehicle"],[FileCheck2,"Estimate"],[BadgeCheck,"Approval"],[ClipboardList,"Repair Order"],[Wrench,"Technician"],[FileCheck2,"Invoice"]].map(([Icon,label])=><span key={label}><Icon />{label}</span>)}</div><div className="lp-demo-list"><span><i className="is-teal" /> 8:30 — Sample vehicle intake</span><span><i className="is-blue" /> 10:00 — Demo estimate review</span><span><i /> 2:30 — Sample delivery</span></div></DemoFrame>
  </div></section>;
}