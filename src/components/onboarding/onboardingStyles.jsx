export const ONBOARDING_KEY = "lbc_onboarding_complete";

export const PROVINCES = [
  "Ontario", "Quebec", "British Columbia", "Alberta", "Manitoba",
  "Saskatchewan", "Nova Scotia", "New Brunswick",
  "Newfoundland and Labrador", "Prince Edward Island", "Other",
];

export const btnPrimary = {
  padding: "12px 32px",
  background: "#10b981",
  color: "#fff",
  fontWeight: 700,
  fontSize: 14,
  border: "none",
  borderRadius: 10,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  boxShadow: "0 4px 15px rgba(16,185,129,0.3)",
};

export const btnSecondary = {
  padding: "12px 24px",
  background: "rgba(255,255,255,0.07)",
  color: "#94a3b8",
  fontWeight: 700,
  fontSize: 14,
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 10,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
};

export const cardStyle = {
  background: "linear-gradient(160deg,#0a0f1e 0%,#111827 50%,#0a0f1e 100%)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 16,
  maxWidth: 560,
  width: "100%",
  maxHeight: "90vh",
  overflowY: "auto",
  boxShadow: "0 30px 80px rgba(0,0,0,0.6)",
};

export const inputClass = "bg-gray-800/50 border-gray-700 text-white placeholder-gray-500";

export function ProgressBar({ step }) {
  return (
    <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 20, marginTop: 8 }}>
      {[1, 2, 3, 4, 5].map((s) => (
        <div key={s} style={{
          width: s === step ? 28 : 10,
          height: 8,
          borderRadius: 4,
          background: s <= step ? "#10b981" : "rgba(255,255,255,0.15)",
          transition: "all 0.3s ease",
        }} />
      ))}
    </div>
  );
}