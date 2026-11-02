import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import LegalSection from "@/components/legal/LegalSection";

// Shared layout for the public legal pages. The landing wrapper supplies the landing's
// dark colors and teal accents, so these pages match the site they're linked from.
export default function LegalDocument({ title, company, effective, updated, sections }) {
  return (
    <div className="lbc-landing">
      <div className="lp-pp-page">
        <div className="lp-pp-wrap">
          <header className="lp-pp-head">
            <h1 className="lp-pp-title">{title}</h1>
            <p className="lp-pp-company">{company}</p>
            <div className="lp-pp-meta">
              <span>Effective Date: {effective}</span>
              <span aria-hidden="true">·</span>
              <span>Last Updated: {updated}</span>
            </div>
          </header>
          <article className="lp-pp-body">
            {sections.map(([num, sectionTitle, blocks]) => <LegalSection key={num} num={num} title={sectionTitle} blocks={blocks} />)}
          </article>
          <div className="lp-pp-back">
            <Link to="/" className="lp-pp-back-btn"><ArrowLeft size={16} /> Back to Home</Link>
          </div>
        </div>
      </div>
    </div>
  );
}