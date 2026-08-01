import React from "react";
import { Menu, X } from "lucide-react";

const links = [["Product Tour", "tour"], ["How It Works", "how-it-works"], ["For Shops", "for-shops"], ["Pricing", "pricing"]];
export default function LandingNav({ open, setOpen, onSignIn }) {
  const go = id => { document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }); setOpen(false); };
  return <header className="lp-nav"><nav className="lp-nav-inner" aria-label="Public navigation">
    <button className="lp-brand" onClick={() => go("hero")} aria-label="LBC Auto home"><span className="lp-mark">LBC</span><span>AUTO</span></button>
    <div className={`lp-nav-links ${open ? "is-open" : ""}`}>{links.map(([label, id]) => <button key={id} onClick={() => go(id)}>{label}</button>)}<button className="lp-nav-signin" onClick={onSignIn}>Sign In</button></div>
    <button className="lp-menu" onClick={() => setOpen(!open)} aria-expanded={open} aria-label={open ? "Close navigation" : "Open navigation"}>{open ? <X /> : <Menu />}</button>
  </nav></header>;
}