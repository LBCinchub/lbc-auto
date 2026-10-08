import React from "react";

// Single approved LBC Auto platform mark (orange radial node logo on its original black background).
// Never use for tenant/shop logos.
export const LBC_AUTO_LOGO_SRC = "/brand/lbc-auto-logo-v1.png";

const SIZES = { xs: 28, sm: 36, md: 48, lg: 72, xl: 96 };

export default function LbcAutoLogo({ size = "sm", className = "", style }) {
  const px = SIZES[size] || SIZES.sm;
  return (
    <span
      className={className}
      style={{ width: px, height: px, background: "#000", borderRadius: Math.round(px * 0.22), overflow: "hidden", display: "inline-flex", flexShrink: 0, ...style }}
    >
      <img src={LBC_AUTO_LOGO_SRC} alt="LBC Auto" width={px} height={px} style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
    </span>
  );
}