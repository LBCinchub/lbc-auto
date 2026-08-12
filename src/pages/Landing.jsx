import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import LandingNav from "@/components/landing/LandingNav";
import HeroSection from "@/components/landing/HeroSection";
import ProductTour from "@/components/landing/ProductTour";
import WorkflowSection from "@/components/landing/WorkflowSection";
import CapabilityMap from "@/components/landing/CapabilityMap";
import RolesSection from "@/components/landing/RolesSection";
import ProofSection from "@/components/landing/ProofSection";
import PricingSection from "@/components/landing/PricingSection";
import { TrustSection, LandingFooter } from "@/components/landing/TrustFooter";
import { TopTechBanner, PoweredByStrip } from "@/components/landing/PoweredByBanner";
import "./Landing.css";

export default function Landing() {
  const [navOpen,setNavOpen]=useState(false), [tourActive,setTourActive]=useState(false);
  useEffect(()=>{const old=document.title;document.title="LBC Auto | Complete Auto Repair Shop Management Software";let meta=document.querySelector('meta[name="description"]'),created=false;if(!meta){meta=document.createElement("meta");meta.name="description";document.head.appendChild(meta);created=true;}const prior=meta.content;meta.content="LBC Auto connects scheduling, customers, vehicles, repair orders, estimates, technicians, invoices, diagnostics, and customer communication in one secure shop management system.";return()=>{document.title=old;if(created)meta.remove();else meta.content=prior;}},[]);
  const signIn=()=>base44.auth.redirectToLogin("/Dashboard");
  const startTour=()=>{setTourActive(true);requestAnimationFrame(()=>document.getElementById("tour")?.scrollIntoView({behavior:"smooth"}));};
  return <div className="lbc-landing"><TopTechBanner/><LandingNav open={navOpen} setOpen={setNavOpen} onSignIn={signIn}/><main><HeroSection onTour={startTour} onSignIn={signIn}/><PoweredByStrip/><ProductTour active={tourActive} setActive={setTourActive}/><WorkflowSection/><CapabilityMap/><RolesSection/><ProofSection/><PricingSection/><TrustSection/></main><LandingFooter onSignIn={signIn}/></div>;
}