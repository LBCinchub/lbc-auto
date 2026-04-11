import React, { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";
import { Search, User } from "lucide-react";

const timeSlots = [
  "8:00 AM", "8:30 AM", "9:00 AM", "9:30 AM", "10:00 AM", "10:30 AM",
  "11:00 AM", "11:30 AM", "12:00 PM", "12:30 PM", "1:00 PM", "1:30 PM",
  "2:00 PM", "2:30 PM", "3:00 PM", "3:30 PM", "4:00 PM", "4:30 PM", "5:00 PM"
];

const serviceTypes = [
  "Oil Change", "Brake Service", "Engine Diagnostic", "Tire Service",
  "Transmission Service", "A/C Repair", "Electrical", "Body Work",
  "General Maintenance", "Inspection", "Other"
];

export default function AppointmentFormDialog({ open, onClose, appointment, onSaved, customers, vehicles, mechanics }) {
  const [customerSearch, setCustomerSearch] = useState("");
  const [form, setForm] = useState({
    customer_id: "", customer_name: "", vehicle_id: "", vehicle_info: "",
    mechanic_id: "", mechanic_name: "", service_type: "", date: "",
    time_slot: "", notes: "", status: "scheduled"
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (appointment) {
      setForm({
        customer_id: appointment.customer_id || "",
        customer_name: appointment.customer_name || "",
        vehicle_id: appointment.vehicle_id || "",
        vehicle_info: appointment.vehicle_info || "",
        mechanic_id: appointment.mechanic_id || "",
        mechanic_name: appointment.mechanic_name || "",
        service_type: appointment.service_type || "",
        date: appointment.date || "",
        time_slot: appointment.time_slot || "",
        notes: appointment.notes || "",
        status: appointment.status || "scheduled",
      });
    } else {
      setForm({
        customer_id: "", customer_name: "", vehicle_id: "", vehicle_info: "",
        mechanic_id: "", mechanic_name: "", service_type: "", date: "",
        time_slot: "", notes: "", status: "scheduled"
      });
    }
  }, [appointment, open]);

  const customerVehicles = vehicles.filter(v => v.customer_id === form.customer_id);

  const handleCustomerChange = (id) => {
    const c = customers.find(c => c.id === id);
    setForm({ ...form, customer_id: id, customer_name: c?.full_name || "", vehicle_id: "", vehicle_info: "" });
    setCustomerSearch("");
  };

  const filteredCustomers = customers.filter(c =>
    !customerSearch ||
    c.full_name?.toLowerCase().includes(customerSearch.toLowerCase()) ||
    c.phone?.includes(customerSearch)
  );

  const handleVehicleChange = (id) => {
    const v = vehicles.find(v => v.id === id);
    setForm({ ...form, vehicle_id: id, vehicle_info: v ? `${v.year} ${v.make} ${v.model}` : "" });
  };

  const handleMechanicChange = (id) => {
    const m = mechanics.find(m => m.id === id);
    setForm({ ...form, mechanic_id: id, mechanic_name: m?.name || "" });
  };

  const handleSave = async () => {
    setSaving(true);
    if (appointment) {
      await base44.entities.Appointment.update(appointment.id, form);
    } else {
      await base44.entities.Appointment.create(form);
    }
    setSaving(false);
    onSaved();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{appointment ? "Edit Appointment" : "New Appointment"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <Label className="text-gray-400">Customer *</Label>
            {form.customer_id ? (
              <div className="mt-1 flex items-center justify-between bg-sky-500/10 border border-sky-500/40 rounded-lg px-3 py-2">
                <div>
                  <p className="text-white font-medium text-sm">{form.customer_name}</p>
                  <p className="text-gray-400 text-xs">{customers.find(c => c.id === form.customer_id)?.phone || ""}</p>
                </div>
                <button onClick={() => setForm({ ...form, customer_id: "", customer_name: "", vehicle_id: "", vehicle_info: "" })}
                  className="text-xs text-gray-500 hover:text-rose-400">Change</button>
              </div>
            ) : (
              <div className="mt-1">
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                  <Input value={customerSearch} onChange={e => setCustomerSearch(e.target.value)}
                    className="bg-gray-800 border-gray-700 text-white pl-8" placeholder="Search by name or phone..." />
                </div>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {filteredCustomers.map(c => (
                    <button key={c.id} onClick={() => handleCustomerChange(c.id)}
                      className="w-full text-left px-3 py-2 rounded-lg bg-gray-800 hover:bg-sky-500/20 hover:border-sky-500/40 border border-transparent transition-colors flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0">
                        <User className="w-3.5 h-3.5 text-gray-400" />
                      </div>
                      <div>
                        <p className="text-white text-sm font-medium">{c.full_name}</p>
                        <p className="text-gray-400 text-xs">{c.phone}</p>
                      </div>
                    </button>
                  ))}
                  {filteredCustomers.length === 0 && <p className="text-gray-500 text-xs text-center py-2">No customers found</p>}
                </div>
              </div>
            )}
          </div>

          <div>
            <Label className="text-gray-400">Vehicle *</Label>
            <Select value={form.vehicle_id} onValueChange={handleVehicleChange}>
              <SelectTrigger className="bg-gray-800 border-gray-700 text-white mt-1">
                <SelectValue placeholder="Select vehicle" />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                {customerVehicles.map(v => (
                  <SelectItem key={v.id} value={v.id}>{v.year} {v.make} {v.model}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-gray-400">Service Type *</Label>
            <Select value={form.service_type} onValueChange={v => setForm({ ...form, service_type: v })}>
              <SelectTrigger className="bg-gray-800 border-gray-700 text-white mt-1">
                <SelectValue placeholder="Select service" />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                {serviceTypes.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-gray-400">Date *</Label>
              <Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}
                className="bg-gray-800 border-gray-700 text-white mt-1" />
            </div>
            <div>
              <Label className="text-gray-400">Time *</Label>
              <Select value={form.time_slot} onValueChange={v => setForm({ ...form, time_slot: v })}>
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white mt-1">
                  <SelectValue placeholder="Select time" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  {timeSlots.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-gray-400">Mechanic</Label>
            <Select value={form.mechanic_id} onValueChange={handleMechanicChange}>
              <SelectTrigger className="bg-gray-800 border-gray-700 text-white mt-1">
                <SelectValue placeholder="Assign mechanic" />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                {mechanics.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-gray-400">Notes</Label>
            <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
              className="bg-gray-800 border-gray-700 text-white mt-1" rows={2} />
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={onClose} className="flex-1 border-gray-700 text-gray-300">Cancel</Button>
            <Button onClick={handleSave}
              disabled={saving || !form.customer_id || !form.vehicle_id || !form.service_type || !form.date || !form.time_slot}
              className="flex-1 bg-sky-500 hover:bg-sky-600">
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}