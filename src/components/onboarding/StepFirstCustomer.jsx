import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ArrowLeft, ArrowRight, SkipForward } from "lucide-react";
import { cardStyle, btnPrimary, btnSecondary, inputClass, ProgressBar } from "./onboardingStyles.jsx";

export default function StepFirstCustomer({ onNext, onBack }) {
  const [custName, setCustName] = useState("");
  const [custPhone, setCustPhone] = useState("");
  const [custEmail, setCustEmail] = useState("");
  const [year, setYear] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [color, setColor] = useState("");
  const [plate, setPlate] = useState("");
  const [vin, setVin] = useState("");
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!custName.trim() || !custPhone.trim()) { alert("Please enter at least the customer name and phone."); return; }
    setSaving(true);
    try {
      const customer = await base44.entities.Customer.create({
        full_name: custName, phone: custPhone, email: custEmail,
      });
      if (year && make && model) {
        await base44.entities.Vehicle.create({
          customer_id: customer.id, customer_name: custName,
          make, model, year: parseInt(year) || undefined,
          color, license_plate: plate, vin,
        });
      }
      onNext();
    } catch (err) {
      alert("Error creating customer: " + err.message);
    } finally {
      setSaving(false);
    }
  };

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
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <Label className="text-gray-400 mb-1.5 block text-xs">Customer Name *</Label>
              <Input value={custName} onChange={(e) => setCustName(e.target.value)} placeholder="John Smith" className={inputClass} />
            </div>
            <div>
              <Label className="text-gray-400 mb-1.5 block text-xs">Phone *</Label>
              <Input value={custPhone} onChange={(e) => setCustPhone(e.target.value)} placeholder="(613) 555-0100" className={inputClass} />
            </div>
          </div>
          <div>
            <Label className="text-gray-400 mb-1.5 block text-xs">Email (optional)</Label>
            <Input value={custEmail} onChange={(e) => setCustEmail(e.target.value)} placeholder="john@email.com" className={inputClass} />
          </div>

          <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "4px 0" }} />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <Label className="text-gray-400 mb-1.5 block text-xs">Vehicle Year</Label>
              <Input value={year} onChange={(e) => setYear(e.target.value)} placeholder="2018" className={inputClass} />
            </div>
            <div>
              <Label className="text-gray-400 mb-1.5 block text-xs">Make</Label>
              <Input value={make} onChange={(e) => setMake(e.target.value)} placeholder="Toyota" className={inputClass} />
            </div>
            <div>
              <Label className="text-gray-400 mb-1.5 block text-xs">Model</Label>
              <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="Camry" className={inputClass} />
            </div>
            <div>
              <Label className="text-gray-400 mb-1.5 block text-xs">Color</Label>
              <Input value={color} onChange={(e) => setColor(e.target.value)} placeholder="Silver" className={inputClass} />
            </div>
            <div>
              <Label className="text-gray-400 mb-1.5 block text-xs">License Plate</Label>
              <Input value={plate} onChange={(e) => setPlate(e.target.value)} placeholder="ABCD 123" className={inputClass} />
            </div>
            <div>
              <Label className="text-gray-400 mb-1.5 block text-xs">VIN</Label>
              <Input value={vin} onChange={(e) => setVin(e.target.value)} placeholder="1HGBH41JXMN109186" className={inputClass} />
            </div>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24 }}>
          <button onClick={onBack} style={btnSecondary}><ArrowLeft size={16} /> BACK</button>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onNext} style={btnSecondary}>SKIP FOR NOW <SkipForward size={14} /></button>
            <button onClick={handleAdd} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.6 : 1 }}>
              {saving ? <Loader2 size={16} className="animate-spin" /> : null} ADD & CONTINUE <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}