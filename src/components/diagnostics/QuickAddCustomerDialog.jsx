import React, { useState, useRef, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { capWords } from "@/utils/capitalize";

export default function QuickAddCustomerDialog({ open, onClose, onSaved }) {
  const [form, setForm] = useState({ full_name: "", phone: "", email: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const nameRef = useRef(null);

  useEffect(() => {
    if (open) {
      setForm({ full_name: "", phone: "", email: "" });
      setError("");
      setTimeout(() => nameRef.current?.focus(), 50);
    }
  }, [open]);

  const handleSave = async () => {
    if (!form.full_name?.trim() || !form.phone?.trim()) return;
    setSaving(true);
    setError("");
    try {
      const created = await base44.entities.Customer.create(form);
      onSaved(created);
      onClose();
    } catch (err) {
      setError(err?.message || "Failed to create customer.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-sm">
        <DialogHeader>
          <DialogTitle>New Customer</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          <div>
            <Label className="text-gray-400">Full Name *</Label>
            <Input
              ref={nameRef}
              value={form.full_name}
              autoCapitalize="words"
              onChange={e => capWords(e, setForm, "full_name")}
              className="bg-gray-800 border-gray-700 text-white mt-1"
              placeholder="John Smith"
            />
          </div>
          <div>
            <Label className="text-gray-400">Phone *</Label>
            <Input
              value={form.phone}
              onChange={e => setForm({ ...form, phone: e.target.value })}
              className="bg-gray-800 border-gray-700 text-white mt-1"
              placeholder="(416) 555-0199"
            />
          </div>
          <div>
            <Label className="text-gray-400">Email</Label>
            <Input
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              className="bg-gray-800 border-gray-700 text-white mt-1"
              placeholder="john@email.com"
            />
          </div>
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <div className="flex gap-3 pt-1">
            <Button variant="outline" onClick={onClose} className="flex-1 border-gray-700 text-gray-300">Cancel</Button>
            <Button
              onClick={handleSave}
              disabled={saving || !form.full_name || !form.phone}
              className="flex-1 bg-sky-500 hover:bg-sky-600"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add Customer"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}