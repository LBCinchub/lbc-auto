import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import PageHeader from "@/components/shared/PageHeader";

export default function Settings() {
  const [user, setUser] = useState(null);
  const [businessName, setBusinessName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const loadUser = async () => {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      setBusinessName(currentUser?.business_name || "");
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
      await base44.auth.updateMe({ business_name: businessName });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      alert("Error saving business name: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950">
      <PageHeader title="Settings" />
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-white mb-4">Business Information</h2>
            <div className="space-y-4">
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

              <div className="bg-gray-800 border border-gray-700 rounded p-4">
                <p className="text-gray-400 text-sm">
                  <strong>Email:</strong> {user?.email}
                </p>
              </div>

              <Button
                onClick={handleSave}
                disabled={saving || !businessName.trim()}
                className="bg-sky-500 hover:bg-sky-600 w-full"
              >
                {saving ? "Saving..." : saved ? "Saved ✓" : "Save Business Name"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}