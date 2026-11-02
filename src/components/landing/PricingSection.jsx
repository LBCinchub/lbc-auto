import React from "react";
import { ArrowRight, Check, Mail } from "lucide-react";

const PLANS = [
  { tier: "BASIC", price: "$199", blurb: "Core shop management for a connected daily workflow.", features: ["Center Control Dashboard & end-of-day reports", "Customers, vehicles & service history", "Appointments, online booking & intake", "Estimates, approvals & repair orders", "Invoices, payments & receipts", "Technician portal, time tracking & payroll summaries", "Parts inventory & VIN lookup", "Secure customer portal & LBC Auto AI assistant"] },
  { tier: "PRO", price: "$299", featured: true, blurb: "Expanded capabilities for shops that need more operational depth.", features: ["Everything in Basic", "LBC AI Diagnostics", "AI Scanner: Scan, Live Data & Tech Mode", "Technician-reviewed DTC guidance", "Printable scan & health reports", "Save scans to repair orders & estimates"] },
];

const Features = ({ items }) => <ul className="lp-plan-features">{items.map((item) => <li key={item}><Check aria-hidden="true" />{item}</li>)}</ul>;

export default function PricingSection({ onStart }) {
  return <section id="pricing" className="lp-section lp-pricing"><div className="lp-container">
    <div className="lp-section-head"><span className="lp-eyebrow">CLEAR PRICING</span><h2>Implementation first. Then the plan that fits.</h2><p>Setup and training are separate from recurring software access.</p></div>
    <div className="lp-pricing-grid">
      <article className="lp-setup"><span>SETUP & TRAINING</span><h3>$2,999</h3><Features items={["Shop setup & onboarding", "Includes 4 training days"]} /><div><small>Additional training</small><strong>$300/day</strong></div><a className="lp-secondary lp-plan-cta" href="mailto:Tarek-Samara@LBC-HUB.COM?subject=LBC%20Auto%20setup%20%26%20training"><Mail aria-hidden="true" /> Talk to our team</a></article>
      {PLANS.map((plan) => <article key={plan.tier} className={plan.featured ? "is-featured" : undefined}><span>{plan.tier}</span><h3>{plan.price}<small>/month</small></h3><p>{plan.blurb}</p><Features items={plan.features} /><button type="button" className={`${plan.featured ? "lp-primary" : "lp-secondary"} lp-plan-cta`} onClick={onStart}>Start 7-day free trial <ArrowRight aria-hidden="true" /></button></article>)}
    </div>
    <p className="lp-pricing-note">Every shop starts with a 7-day free trial, no payment needed. LBC AI Diagnostics is part of Pro and needs a compatible OBD2 adapter.</p>
  </div></section>;
}