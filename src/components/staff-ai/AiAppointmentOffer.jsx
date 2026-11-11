import React from "react";
import { CalendarPlus } from "lucide-react";

export default function AiAppointmentOffer({ user, onAsk }) {
  return (
    <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 10, background: "#1f1206", border: "1px solid #f9731644" }}>
      <div style={{ color: "#fdba74", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
        Want To Schedule This At {user?.business_name || "Your Shop"}?
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <button type="button" className="lbc-ai-chip-btn" onClick={() => onAsk("Yes, I'd like to schedule an appointment")}
          style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#c2410c", color: "#fff", borderColor: "#f97316" }}>
          <CalendarPlus style={{ width: 14, height: 14 }} /> Yes, Book Me In
        </button>
        {user?.phone && (
          <button type="button" className="lbc-ai-chip-btn" onClick={() => onAsk("I will call the shop to book")}>Call {user.phone}</button>
        )}
      </div>
    </div>
  );
}