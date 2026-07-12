import React from "react";
import { ArrowRight, Check } from "lucide-react";
import { cardStyle, btnPrimary, ProgressBar } from "./onboardingStyles.jsx";

export default function StepWelcome({ onNext }) {
  const features = [
    "Create estimates & invoices in seconds",
    "Manage customers & vehicles",
    "Scan any car with LBC AUTO AI SCANNER",
    "Let AI handle customer booking & chat",
    "Print professional vehicle reports",
  ];
  return (
    <div style={cardStyle}>
      <div style={{ padding: "36px 32px", textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>⚡</div>
        <h1 style={{ color: "#f1f5f9", fontSize: 26, fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>
          Welcome to LBC AUTO
        </h1>
        <p style={{ color: "#64748b", fontSize: 15, margin: "8px 0 0" }}>
          Your shop's digital command center
        </p>

        <div style={{
          marginTop: 24,
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 12,
          padding: "20px 24px",
          textAlign: "left",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 20 }}>🏪</span>
            <span style={{ color: "#e2e8f0", fontSize: 15, fontWeight: 700 }}>Let's set up your shop in 2 minutes</span>
          </div>
          <p style={{ color: "#64748b", fontSize: 13, marginBottom: 12 }}>You'll be able to:</p>
          {features.map((f, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <Check size={16} style={{ color: "#10b981", flexShrink: 0 }} />
              <span style={{ color: "#cbd5e1", fontSize: 13 }}>{f}</span>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 24 }}>
          <span style={{ color: "#475569", fontSize: 12 }}>Step 1 of 5</span>
          <ProgressBar step={1} />
        </div>

        <button onClick={onNext} style={{ ...btnPrimary, marginTop: 8 }}>
          GET STARTED <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}