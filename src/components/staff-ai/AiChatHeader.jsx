import React from "react";
import { Minus } from "lucide-react";
import LbcAutoLogo from "@/components/brand/LbcAutoLogo";

// Header: approved LBC Auto master logo, name, verified shop, and Minimize (keeps chat and draft).
export default function AiChatHeader({ shop, onMinimize }) {
  return (
    <div className="lbc-ai-header">
      <LbcAutoLogo size="sm" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: "#fff", fontSize: 16, fontWeight: 700, lineHeight: 1.25 }}>LBC Auto AI</div>
        <div style={{ color: "#fed7aa", fontSize: 12.5, lineHeight: 1.35, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
          title={shop ? "Shop records come only from this verified shop" : undefined}>
          {shop ? `Verified Shop: ${shop.name}` : "Parts, Labor, Codes And Shop Records"}
        </div>
      </div>
      <button type="button" className="lbc-ai-icon-btn" onClick={onMinimize} aria-label="Minimize LBC Auto AI" title="Minimize">
        <Minus style={{ width: 18, height: 18 }} />
      </button>
    </div>
  );
}