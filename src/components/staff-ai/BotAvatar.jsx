import React from "react";

// LBC Auto AI's chat avatar: a restrained robot face. A UI avatar only — the approved LBC Auto
// master logo (LbcAutoLogo) stays the brand mark and is never redrawn here.
export default function BotAvatar({ size = 32 }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true" focusable="false">
      <line x1="24" y1="5" x2="24" y2="11" stroke="#1c0d02" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="24" cy="5" r="2.6" fill="#1c0d02" />
      <rect x="5" y="20" width="4.5" height="9" rx="2.2" fill="#1c0d02" />
      <rect x="38.5" y="20" width="4.5" height="9" rx="2.2" fill="#1c0d02" />
      <rect x="9" y="11" width="30" height="26" rx="9" fill="#1c0d02" />
      <circle cx="18" cy="23" r="3.6" fill="#fff7ed" />
      <circle cx="30" cy="23" r="3.6" fill="#fff7ed" />
      <path d="M18 30.5q6 4 12 0" stroke="#fdba74" strokeWidth="2.4" fill="none" strokeLinecap="round" />
    </svg>
  );
}

// The avatar inside the amber circle (used for the launcher, replies and the empty state).
export function BotOrb({ size = 32, className = "" }) {
  return (
    <span className={`lbc-ai-orb ${className}`} style={{ width: size, height: size }}>
      <BotAvatar size={Math.round(size * 0.72)} />
    </span>
  );
}