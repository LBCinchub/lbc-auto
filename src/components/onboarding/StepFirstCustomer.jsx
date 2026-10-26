import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ArrowLeft, ArrowRight, SkipForward, Check } from "lucide-react";
import { cardStyle, btnPrimary, btnSecondary, inputClass, ProgressBar } from "./onboardingStyles.jsx";
import { validateFirstCustomer, saveFirstCustomer } from "./saveFirstCustomer";

// Examples start with "e.g." so an empty box can't be mistaken for an entered value.
const CUSTOMER_FIELDS = [
  { key: "name", id: "onb-cust-name", label: "Customer Name *", placeholder: "e.g. John Smith" },
  { key: "phone", id: "onb-cust-phone", label: "Phone *", placeholder: "e.g. (613) 555-0100", type: "tel" },
  { key: "email", id: "onb-cust-email", label: "Email (optional)", placeholder: "e.g. john@email.com", type: "email" },
  { key: "address", id: "onb-cust-address", label: "Address (optional)", placeholder: "e.g. 123 Main St, Ottawa", autoComplete: "street-address" },
];

const VEHICLE_FIELDS = [
  { key: "year", id: "onb-year", label: "Vehicle Year", placeholder: "e.g. 2018", inputMode: "numeric" },
  { key: "make", id: "onb-make", label: "Make", placeholder: "e.g. Toyota" },
  { key: "model", id: "onb-model", label: "Model", placeholder: "e.g. Camry" },
  { key: "color", id: "onb-color", label: "Color", placeholder: "e.g. Silver" },
  { key: "plate", id: "onb-plate", label: "License Plate", placeholder: "e.g. ABCD 123" },
  { key: "vin", id: "onb-vin", label: "VIN", placeholder: "17 characters" },
];

const twoCol = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 };
const note = { display: "flex", alignItems: "center", gap: 6, fontSize: 13, margin: "16px 0 0" };

// Form values and saved ids live in OnboardingFlow, so moving Back/Next through
// the wizard keeps what was typed and never saves the same customer twice.
export default function StepFirstCustomer({ form, onFormChange, saved, onSaved, onNext, onBack }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleAdd = async () => {
    const problem = validateFirstCustomer(form);
    setError(problem);
    if (problem) return;
    setSaving(true);
    try {
      await saveFirstCustomer(form, saved, onSaved);
      onNext();
    } catch (err) {
      setError(`Couldn't save the customer: ${err?.message || "please try again."}`);
    } finally {
      setSaving(false);
    }
  };

  const field = ({ key, label, ...input }) => (
    <div key={key}>
      <Label htmlFor={input.id} className="text-gray-400 mb-1.5 block text-xs">{label}</Label>
      <Input
        {...input}
        value={form[key]}
        onChange={(e) => { const value = e.target.value; onFormChange((f) => ({ ...f, [key]: value })); }}
        className={inputClass}
      />
    </div>
  );

  return (
    <div style={cardStyle}>
      <div style={{ padding: "28px 32px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 20 }}>👤</span>
          <h2 style={{ color: "#f1f5f9", fontSize: 18, fontWeight: 800, margin: 0 }}>Add Your First Customer</h2>
        </div>
        <span style={{ color: "#475569", fontSize: 12 }}>Step 3 of 5</span>
        <ProgressBar step={3} />

        <div style={{ display: "grid", gap: 12 }}>
          <div style={twoCol}>{CUSTOMER_FIELDS.map(field)}</div>
          <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "4px 0" }} />
          <div style={twoCol}>{VEHICLE_FIELDS.map(field)}</div>
        </div>

        {error ? (
          <p role="alert" style={{ ...note, color: "#f87171" }}>{error}</p>
        ) : saved.customerId ? (
          <p role="status" style={{ ...note, color: "#34d399" }}>
            <Check size={15} /> Saved to your Customers. Changes here will update it.
          </p>
        ) : null}

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24 }}>
          <button onClick={onBack} disabled={saving} style={btnSecondary}><ArrowLeft size={16} /> BACK</button>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onNext} disabled={saving} style={btnSecondary}>SKIP FOR NOW <SkipForward size={14} /></button>
            <button onClick={handleAdd} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.6 : 1 }}>
              {saving ? <Loader2 size={16} className="animate-spin" /> : null} {saved.customerId ? "SAVE" : "ADD"} & CONTINUE <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}