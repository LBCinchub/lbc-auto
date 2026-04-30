import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import PageHeader from "@/components/shared/PageHeader";
import { MessageSquare, Mail, Bell, Upload, Sparkles, X, Loader2 } from "lucide-react";

const NOTIF_SETTINGS = [
  {
    key: "repair_status",
    label: "Repair Order Status Changes",
    desc: "Notify customers when repair status updates (In Progress, Ready, etc.)",
  },
  {
    key: "appointment_reminder",
    label: "Appointment Reminders",
    desc: "Send reminders 1 day before scheduled appointments",
  },
  {
    key: "invoice_ready",
    label: "Invoice Ready / Paid",
    desc: "Notify when invoice is created or payment is received",
  },
  {
    key: "overdue_invoice",
    label: "Overdue Invoice Reminders",
    desc: "Daily reminders for unpaid overdue invoices",
  },
];

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${checked ? "bg-sky-500" : "bg-gray-700"}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${checked ? "translate-x-6" : "translate-x-1"}`} />
    </button>
  );
}

export default function Settings() {
  const [user, setUser] = useState(null);
  const [businessName, setBusinessName] = useState("");
  const [shopPhone, setShopPhone] = useState("");
  const [shopAddress, setShopAddress] = useState("");
  const [gstNumber, setGstNumber] = useState("");
  const [hstNumber, setHstNumber] = useState("");
  const [taxRate, setTaxRate] = useState("");
  const [notifPrefs, setNotifPrefs] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [logoUrl, setLogoUrl] = useState("");
  const [generatingLogo, setGeneratingLogo] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const loadUser = async () => {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      setBusinessName(currentUser?.business_name || "");
      setShopPhone(currentUser?.phone || "");
      setShopAddress(currentUser?.address || "");
      setGstNumber(currentUser?.gst_number || "");
      setHstNumber(currentUser?.hst_number || "");
      setTaxRate(currentUser?.tax_rate != null ? String(currentUser.tax_rate) : "");
      setLogoUrl(currentUser?.business_logo || "");
      // Load notification prefs (default SMS on, email off)
      const prefs = {};
      NOTIF_SETTINGS.forEach(({ key }) => {
        prefs[`sms_${key}`] = currentUser?.[`notif_sms_${key}`] !== false;
        prefs[`email_${key}`] = currentUser?.[`notif_email_${key}`] === true;
      });
      setNotifPrefs(prefs);
    };
    loadUser();
  }, []);

  const handleSave = async () => {
    if (!businessName.trim()) {
      alert("Please enter your business name");
      return;
    }
    setSaving(true);
    try {
      const notifData = {};
      NOTIF_SETTINGS.forEach(({ key }) => {
        notifData[`notif_sms_${key}`] = notifPrefs[`sms_${key}`] !== false;
        notifData[`notif_email_${key}`] = notifPrefs[`email_${key}`] === true;
      });
      await base44.auth.updateMe({ business_name: businessName, phone: shopPhone, address: shopAddress, gst_number: gstNumber, hst_number: hstNumber, tax_rate: taxRate !== "" ? parseFloat(taxRate) : 0, business_logo: logoUrl, ...notifData });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      alert("Error saving details: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const setNotif = (key, value) => {
    setNotifPrefs(prev => ({ ...prev, [key]: value }));
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setLogoUrl(file_url);
    setUploadingLogo(false);
  };

  const handleGenerateLogo = async () => {
    if (!businessName.trim()) { alert("Enter your business name first so we can generate a relevant logo."); return; }
    setGeneratingLogo(true);
    const result = await base44.integrations.Core.GenerateImage({
      prompt: `Professional auto shop logo for "${businessName}". Clean, modern, bold design suitable for invoices and business cards. Use automotive/mechanic theme with wrench, gear, or car silhouette. White or transparent background, high contrast, minimal.`,
    });
    setLogoUrl(result.url);
    setGeneratingLogo(false);
  };

  return (
    <div className="min-h-screen bg-gray-950">
      <PageHeader title="Settings" />
      <div className="max-w-2xl mx-auto p-6 space-y-6">

        {/* Business Info */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 space-y-4">
          <h2 className="text-xl font-semibold text-white mb-2">Business Information</h2>
          <div>
            <Label className="text-gray-400 mb-2 block">Business Name *</Label>
            <Input
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="Enter your auto shop name"
              className="bg-gray-800 border-gray-700 text-white"
            />
            <p className="text-gray-500 text-sm mt-2">This will appear as your shop's name throughout the app</p>
          </div>
          <div>
            <Label className="text-gray-400 mb-2 block">Shop Phone Number</Label>
            <Input
              value={shopPhone}
              onChange={(e) => setShopPhone(e.target.value)}
              placeholder="Enter your shop phone number"
              className="bg-gray-800 border-gray-700 text-white"
            />
            <p className="text-gray-500 text-sm mt-2">This will appear on invoices</p>
          </div>
          <div>
            <Label className="text-gray-400 mb-2 block">Shop Address</Label>
            <Input
              value={shopAddress}
              onChange={(e) => setShopAddress(e.target.value)}
              placeholder="Enter your shop address"
              className="bg-gray-800 border-gray-700 text-white"
            />
            <p className="text-gray-500 text-sm mt-2">This will appear on invoices and estimates</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-gray-400 mb-2 block">GST Number</Label>
              <Input
                value={gstNumber}
                onChange={(e) => setGstNumber(e.target.value)}
                placeholder="e.g. 123456789RT0001"
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>
            <div>
              <Label className="text-gray-400 mb-2 block">HST Number</Label>
              <Input
                value={hstNumber}
                onChange={(e) => setHstNumber(e.target.value)}
                placeholder="e.g. 123456789RT0001"
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>
          </div>
          <div>
            <Label className="text-gray-400 mb-2 block">Default Tax Rate (%)</Label>
            <Input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={taxRate}
              onChange={(e) => setTaxRate(e.target.value)}
              placeholder="e.g. 13 for 13%"
              className="bg-gray-800 border-gray-700 text-white"
            />
            <p className="text-gray-500 text-sm mt-2">This rate will be pre-filled on all new invoices and estimates</p>
          </div>
          {/* Business Logo */}
          <div>
            <Label className="text-gray-400 mb-2 block">Business Logo</Label>
            <div className="flex flex-col gap-3">
              {logoUrl && (
                <div className="relative w-40 h-24 rounded-lg border border-gray-700 bg-gray-800 flex items-center justify-center overflow-hidden">
                  <img src={logoUrl} alt="Business Logo" className="max-w-full max-h-full object-contain p-2" />
                  <button onClick={() => setLogoUrl("")} className="absolute top-1 right-1 bg-gray-900/80 rounded-full p-0.5 text-gray-400 hover:text-rose-400">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              <div className="flex gap-2 flex-wrap">
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingLogo} className="border-gray-700 text-gray-300 hover:text-white gap-2">
                  {uploadingLogo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {uploadingLogo ? "Uploading..." : "Upload Logo"}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={handleGenerateLogo}
                  disabled={generatingLogo} className="border-purple-700 text-purple-400 hover:text-purple-300 gap-2">
                  {generatingLogo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  {generatingLogo ? "Generating..." : "Generate with Lumina AI"}
                </Button>
              </div>
              <p className="text-gray-500 text-sm">Logo will appear on all your invoices and estimates</p>
            </div>
          </div>

          <p className="text-gray-500 text-sm -mt-2">GST/HST numbers will appear on invoices and estimates</p>
          <div className="bg-gray-800 border border-gray-700 rounded p-4">
            <p className="text-gray-400 text-sm"><strong>Email:</strong> {user?.email}</p>
          </div>
        </div>

        {/* Notification Preferences */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-1">
            <Bell className="w-5 h-5 text-sky-400" />
            <h2 className="text-xl font-semibold text-white">Notification Preferences</h2>
          </div>
          <p className="text-gray-500 text-sm mb-6">Choose how customers are notified for each event type.</p>

          {/* Header row */}
          <div className="grid grid-cols-3 gap-2 mb-3 px-1">
            <div className="text-xs text-gray-500 uppercase tracking-wider col-span-1">Event</div>
            <div className="flex items-center justify-center gap-1 text-xs text-gray-500 uppercase tracking-wider">
              <MessageSquare className="w-3 h-3" /> SMS
            </div>
            <div className="flex items-center justify-center gap-1 text-xs text-gray-500 uppercase tracking-wider">
              <Mail className="w-3 h-3" /> Email
            </div>
          </div>

          <div className="space-y-3">
            {NOTIF_SETTINGS.map(({ key, label, desc }) => (
              <div key={key} className="grid grid-cols-3 gap-2 items-center bg-gray-800/50 rounded-lg px-4 py-3 border border-gray-700/50">
                <div className="col-span-1">
                  <p className="text-white text-sm font-medium">{label}</p>
                  <p className="text-gray-500 text-xs mt-0.5">{desc}</p>
                </div>
                <div className="flex justify-center">
                  <Toggle
                    checked={notifPrefs[`sms_${key}`] !== false}
                    onChange={(val) => setNotif(`sms_${key}`, val)}
                  />
                </div>
                <div className="flex justify-center">
                  <Toggle
                    checked={notifPrefs[`email_${key}`] === true}
                    onChange={(val) => setNotif(`email_${key}`, val)}
                  />
                </div>
              </div>
            ))}
          </div>

          <p className="text-gray-600 text-xs mt-4">
            SMS uses Twilio. Email uses the built-in email service. Customer contact info must be saved on their profile.
          </p>
        </div>

        <Button
          onClick={handleSave}
          disabled={saving || !businessName.trim()}
          className="bg-sky-500 hover:bg-sky-600 w-full"
        >
          {saving ? "Saving..." : saved ? "Saved ✓" : "Save Settings"}
        </Button>
      </div>
    </div>
  );
}