import React from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { cardStyle, btnPrimary, btnSecondary, ProgressBar } from "./onboardingStyles.jsx";

const CARDS = [
  { icon: "📋", title: "ESTIMATES & INVOICES", desc: "Full paper trail from estimate to paid invoice" },
  { icon: "🔬", title: "AI SCANNER", desc: "Scan any car. Live data. ECU commands. EV support." },
  { icon: "🤖", title: "AI CHAT", desc: "Customers book 24/7 on your website auto." },
  { icon: "📷", title: "PHOTO AI", desc: "Photo any car part. AI tells what's wrong instantly." },
  { icon: "🖨️", title: "REPORTS", desc: "Print full vehicle history. Email to customer." },
];

export default function StepFeatureTour({ onNext, onBack }) {
  return (
    <div style={cardStyle}>
      <div style={{ padding: "28px 32px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 20 }}>🚀</span>
          <h2 style={{ color: "#f1f5f9", fontSize: 18, fontWeight: 800, margin: 0 }}>Here's What You Can Do</h2>
        </div>
        <span style={{ color: "#475569", fontSize: 12 }}>Step 4 of 5</span>
        <ProgressBar step={4} />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 16 }}>
          {CARDS.map((c, i) => (
            <div key={i} style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 12, padding: "16px 14px", textAlign: "left",
            }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>{c.icon}</div>
              <div style={{ color: "#e2e8f0", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>{c.title}</div>
              <div style={{ color: "#64748b", fontSize: 11, lineHeight: 1.5 }}>{c.desc}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24 }}>
          <button onClick={onBack} style={btnSecondary}><ArrowLeft size={16} /> BACK</button>
          <button onClick={onNext} style={btnPrimary}>NEXT <ArrowRight size={16} /></button>
        </div>
      </div>
    </div>
  );
}