import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Upload, ArrowLeft, ArrowRight } from "lucide-react";
import { cardStyle, btnPrimary, btnSecondary, inputClass, ProgressBar, PROVINCES } from "./onboardingStyles.jsx";

export default function StepShopProfile({ user, onNext, onBack }) {
  const [shopName, setShopName] = useState(user?.business_name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [address, setAddress] = useState(user?.address || "");
  const [city, setCity] = useState(user?.city || "");
  const [province, setProvince] = useState(user?.province || "Ontario");
  const [logoUrl, setLogoUrl] = useState(user?.business_logo || user?.logo_url || "");
  const [laborRate, setLaborRate] = useState(user?.labor_rate != null ? String(user.labor_rate) : "120");
  const [taxRate, setTaxRate] = useState(user?.tax_rate != null ? String(user.tax_rate) : "13");
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileInputRef = useRef(null);

  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpg", "image/jpeg"].includes(file.type)) { alert("Please upload a PNG, JPG, or JPEG image."); return; }
    if (file.size > 5 * 1024 * 1024) { alert("Please choose an image smaller than 5MB."); return; }
    setUploadingLogo(true);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = 400; canvas.height = 400;
        const ctx = canvas.getContext("2d");
        const scale = Math.min(400 / img.width, 400 / img.height);
        const x = (400 - img.width * scale) / 2;
        const y = (400 - img.height * scale) / 2;
        ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
        const isPng = file.type === "image/png";
        setLogoUrl(canvas.toDataURL(isPng ? "image/png" : "image/jpeg", 0.92));
        setUploadingLogo(false);
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!shopName.trim()) { alert("Please enter your shop name"); return; }
    setSaving(true);
    try {
      await base44.auth.updateMe({
        business_name: shopName, phone, address, city, province,
        business_logo: logoUrl, logo_url: logoUrl,
        labor_rate: parseFloat(laborRate) || 0, tax_rate: parseFloat(taxRate) || 0,
      });
      onNext();
    } catch (err) {
      alert("Error saving: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={cardStyle}>
      <div style={{ padding: "28px 32px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 20 }}>🏪</span>
          <h2 style={{ color: "#f1f5f9", fontSize: 18, fontWeight: 800, margin: 0 }}>Your Shop Profile</h2>
        </div>
        <span style={{ color: "#475569", fontSize: 12 }}>Step 2 of 5</span>
        <ProgressBar step={2} />

        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 14 }}>
          <div>
            <Label className="text-gray-400 mb-1.5 block text-xs">Shop Name *</Label>
            <Input value={shopName} onChange={(e) => setShopName(e.target.value)} placeholder="e.g. Hajwheels Auto" className={inputClass} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <Label className="text-gray-400 mb-1.5 block text-xs">Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(613) 555-0100" className={inputClass} />
            </div>
            <div>
              <Label className="text-gray-400 mb-1.5 block text-xs">City</Label>
              <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Ottawa" className={inputClass} />
            </div>
          </div>
          <div>
            <Label className="text-gray-400 mb-1.5 block text-xs">Address</Label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 Main Street" className={inputClass} />
          </div>
          <div>
            <Label className="text-gray-400 mb-1.5 block text-xs">Province</Label>
            <select value={province} onChange={(e) => setProvince(e.target.value)}
              className="w-full bg-gray-800/50 border border-gray-700 text-white rounded-md px-3 py-2 text-sm">
              {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-gray-400 mb-1.5 block text-xs">Shop Logo (optional)</Label>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" style={{ width: 48, height: 48, borderRadius: 8, objectFit: "cover", border: "1px solid rgba(255,255,255,0.1)" }} />
              ) : (
                <div style={{ width: 48, height: 48, borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px dashed rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🏪</div>
              )}
              <button type="button" onClick={() => fileInputRef.current?.click()} style={{ ...btnSecondary, padding: "8px 16px", fontSize: 12 }}>
                {uploadingLogo ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Upload Logo
              </button>
              <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/jpg" onChange={handleLogoUpload} style={{ display: "none" }} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <Label className="text-gray-400 mb-1.5 block text-xs">Labor Rate ($/hr)</Label>
              <Input value={laborRate} onChange={(e) => setLaborRate(e.target.value)} placeholder="120" className={inputClass} />
            </div>
            <div>
              <Label className="text-gray-400 mb-1.5 block text-xs">Tax Rate (%)</Label>
              <Input value={taxRate} onChange={(e) => setTaxRate(e.target.value)} placeholder="13" className={inputClass} />
            </div>
          </div>
        </div>

        <div style={{ marginTop: 12, padding: "10px 12px", background: "rgba(59,130,246,0.08)", borderRadius: 8, border: "1px solid rgba(59,130,246,0.2)" }}>
          <span style={{ color: "#93c5fd", fontSize: 12 }}>ℹ️ This info appears on all your invoices & reports</span>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24 }}>
          <button onClick={onBack} style={btnSecondary}><ArrowLeft size={16} /> BACK</button>
          <button onClick={handleSave} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.6 : 1 }}>
            {saving ? <Loader2 size={16} className="animate-spin" /> : null} SAVE & CONTINUE <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}