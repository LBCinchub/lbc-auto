import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { FileText, Wrench, Receipt, CheckCircle2, CalendarDays } from "lucide-react";

export default function CustomerFormDialog({ open, onClose, customer, onSaved, onQuickAction }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    full_name: "", phone: "", email: "", address: "", notes: ""
  });
  const [addVehicle, setAddVehicle] = useState(false);
  const [vehicleForm, setVehicleForm] = useState({ vin: "", make: "", model: "", year: "", license_plate: "" });
  const [decodingVin, setDecodingVin] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedCustomer, setSavedCustomer] = useState(null);

  useEffect(() => {
    if (customer) {
      setForm({
        full_name: customer.full_name || "",
        phone: customer.phone || "",
        email: customer.email || "",
        address: customer.address || "",
        notes: customer.notes || "",
      });
    } else {
      setForm({ full_name: "", phone: "", email: "", address: "", notes: "" });
      setAddVehicle(false);
      setVehicleForm({ vin: "", make: "", model: "", year: "", license_plate: "" });
    }
    setSavedCustomer(null);
  }, [customer, open]);

  const handleSave = async () => {
    setSaving(true);
    let newCustomer;
    if (customer) {
      await base44.entities.Customer.update(customer.id, form);
      newCustomer = { id: customer.id, ...form };

      // Propagate name/phone changes to all related entities
      if (customer.full_name !== form.full_name || customer.phone !== form.phone) {
        const nameUpdate = { customer_name: form.full_name };

        // Update Vehicles
        const vehicles = await base44.entities.Vehicle.filter({ customer_id: customer.id });
        await Promise.all(vehicles.map(v =>
          base44.entities.Vehicle.update(v.id, { customer_name: form.full_name, phone: form.phone })
        ));

        // Update RepairOrders
        const orders = await base44.entities.RepairOrder.filter({ customer_id: customer.id });
        await Promise.all(orders.map(o =>
          base44.entities.RepairOrder.update(o.id, nameUpdate)
        ));

        // Update Estimates
        const estimates = await base44.entities.Estimate.filter({ customer_id: customer.id });
        await Promise.all(estimates.map(e =>
          base44.entities.Estimate.update(e.id, nameUpdate)
        ));

        // Update Invoices
        const invoices = await base44.entities.Invoice.filter({ customer_id: customer.id });
        await Promise.all(invoices.map(inv =>
          base44.entities.Invoice.update(inv.id, nameUpdate)
        ));

        // Update Appointments
        const appointments = await base44.entities.Appointment.filter({ customer_id: customer.id });
        await Promise.all(appointments.map(appt =>
          base44.entities.Appointment.update(appt.id, nameUpdate)
        ));
      }
    } else {
      newCustomer = await base44.entities.Customer.create(form);
    }
    if (!customer && addVehicle && vehicleForm.make && vehicleForm.model && vehicleForm.year) {
      await base44.entities.Vehicle.create({
        ...vehicleForm,
        year: Number(vehicleForm.year),
        customer_id: newCustomer.id,
        customer_name: form.full_name,
      });
    }
    setSaving(false);
    onSaved();
    // For new customers, show quick-action step instead of closing
    if (!customer) {
      setSavedCustomer(newCustomer);
    } else {
      onClose();
    }
  };

  const handleQuickAction = (page) => {
    // For dialogs, use callback to open with prefilled customer data
    if (["Appointments", "Invoices", "Estimates", "RepairOrders"].includes(page) && onQuickAction) {
      onQuickAction(page, { 
        _prefillCustomerId: savedCustomer.id, 
        _prefillCustomerName: savedCustomer.full_name,
        customer_id: savedCustomer.id,
        customer_name: savedCustomer.full_name
      });
    } else {
      onClose();
      navigate(`/${page}`);
    }
  };

  if (savedCustomer) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-400" />
              Customer Added!
            </DialogTitle>
          </DialogHeader>
          <div className="mt-2 space-y-4">
            <p className="text-gray-400 text-sm">
              <span className="text-white font-medium">{savedCustomer.full_name}</span> has been saved. What would you like to do next?
            </p>
            <div className="grid grid-cols-1 gap-3">
              <button
               onClick={() => handleQuickAction("Estimates")}
               className="flex items-center gap-3 p-4 rounded-lg bg-gray-800 hover:bg-sky-500/10 border border-gray-700 hover:border-sky-500/50 transition-all text-left"
              >
               <div className="w-9 h-9 rounded-full bg-sky-500/20 flex items-center justify-center flex-shrink-0">
                 <FileText className="w-4 h-4 text-sky-400" />
               </div>
               <div>
                 <p className="text-white font-medium text-sm">Create Estimate</p>
                 <p className="text-gray-500 text-xs">Open estimate form with customer info pre-filled</p>
               </div>
              </button>
              <button
               onClick={() => handleQuickAction("RepairOrders")}
               className="flex items-center gap-3 p-4 rounded-lg bg-gray-800 hover:bg-amber-500/10 border border-gray-700 hover:border-amber-500/50 transition-all text-left"
              >
               <div className="w-9 h-9 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                 <Wrench className="w-4 h-4 text-amber-400" />
               </div>
               <div>
                 <p className="text-white font-medium text-sm">Create Repair Order</p>
                 <p className="text-gray-500 text-xs">Open repair order form with customer info pre-filled</p>
               </div>
              </button>
              <button
               onClick={() => handleQuickAction("Invoices")}
               className="flex items-center gap-3 p-4 rounded-lg bg-gray-800 hover:bg-emerald-500/10 border border-gray-700 hover:border-emerald-500/50 transition-all text-left"
              >
               <div className="w-9 h-9 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                 <Receipt className="w-4 h-4 text-emerald-400" />
               </div>
               <div>
                 <p className="text-white font-medium text-sm">Create Invoice</p>
                 <p className="text-gray-500 text-xs">Open invoice form with customer info pre-filled</p>
               </div>
              </button>
              <button
               onClick={() => handleQuickAction("Appointments")}
               className="flex items-center gap-3 p-4 rounded-lg bg-gray-800 hover:bg-purple-500/10 border border-gray-700 hover:border-purple-500/50 transition-all text-left"
              >
               <div className="w-9 h-9 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                 <CalendarDays className="w-4 h-4 text-purple-400" />
               </div>
               <div>
                 <p className="text-white font-medium text-sm">Book Appointment</p>
                 <p className="text-gray-500 text-xs">Open appointment form with customer info pre-filled</p>
               </div>
              </button>
            </div>
            <Button variant="outline" onClick={onClose} className="w-full border-gray-700 text-gray-300">
              Done — Go Back to Customers
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-md">
        <DialogHeader>
          <DialogTitle>{customer ? "Edit Customer" : "New Customer"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <Label className="text-gray-400">Full Name *</Label>
            <Input value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})}
              className="bg-gray-800 border-gray-700 text-white mt-1" />
          </div>
          <div>
            <Label className="text-gray-400">Phone *</Label>
            <Input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})}
              className="bg-gray-800 border-gray-700 text-white mt-1" />
          </div>
          <div>
            <Label className="text-gray-400">Email</Label>
            <Input value={form.email} onChange={e => setForm({...form, email: e.target.value})}
              className="bg-gray-800 border-gray-700 text-white mt-1" />
          </div>
          <div>
            <Label className="text-gray-400">Address</Label>
            <Input value={form.address} onChange={e => setForm({...form, address: e.target.value})}
              className="bg-gray-800 border-gray-700 text-white mt-1" />
          </div>
          <div>
            <Label className="text-gray-400">Notes</Label>
            <Textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})}
              className="bg-gray-800 border-gray-700 text-white mt-1" rows={3} />
          </div>
          {!customer && (
            <div className="border border-gray-700 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-gray-300 font-medium">Add a Vehicle</Label>
                <Switch checked={addVehicle} onCheckedChange={setAddVehicle} />
              </div>
              {addVehicle && (
                <div className="space-y-3 pt-1">
                  <div>
                    <Label className="text-gray-400 text-xs">VIN</Label>
                    <div className="flex gap-2 mt-1">
                      <Input value={vehicleForm.vin} onChange={e => setVehicleForm({...vehicleForm, vin: e.target.value})}
                        className="bg-gray-800 border-gray-700 text-white flex-1" placeholder="Enter VIN" />
                      <Button onClick={async () => {
                        if (!vehicleForm.vin) return;
                        setDecodingVin(true);
                        try {
                          const result = await base44.integrations.Core.InvokeLLM({
                            prompt: `Decode this VIN and extract the make, model, and year: ${vehicleForm.vin}. Return only JSON with keys: make, model, year (as number).`,
                            response_json_schema: {
                              type: "object",
                              properties: { make: {type: "string"}, model: {type: "string"}, year: {type: "number"} }
                            }
                          });
                          setVehicleForm(prev => ({
                            ...prev,
                            make: result.make || prev.make,
                            model: result.model || prev.model,
                            year: result.year?.toString() || prev.year
                          }));
                        } catch (e) {
                          console.error("Error decoding VIN:", e);
                        }
                        setDecodingVin(false);
                      }} disabled={decodingVin || !vehicleForm.vin} className="bg-gray-700 hover:bg-gray-600 text-xs">
                        {decodingVin ? "Decoding..." : "Decode"}
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-gray-400 text-xs">Make *</Label>
                      <Input value={vehicleForm.make} onChange={e => setVehicleForm({...vehicleForm, make: e.target.value})}
                        className="bg-gray-800 border-gray-700 text-white mt-1" placeholder="Toyota" />
                    </div>
                    <div>
                      <Label className="text-gray-400 text-xs">Model *</Label>
                      <Input value={vehicleForm.model} onChange={e => setVehicleForm({...vehicleForm, model: e.target.value})}
                        className="bg-gray-800 border-gray-700 text-white mt-1" placeholder="Camry" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-gray-400 text-xs">Year *</Label>
                      <Input type="number" value={vehicleForm.year} onChange={e => setVehicleForm({...vehicleForm, year: e.target.value})}
                        className="bg-gray-800 border-gray-700 text-white mt-1" placeholder="2020" />
                    </div>
                    <div>
                      <Label className="text-gray-400 text-xs">License Plate</Label>
                      <Input value={vehicleForm.license_plate} onChange={e => setVehicleForm({...vehicleForm, license_plate: e.target.value})}
                        className="bg-gray-800 border-gray-700 text-white mt-1" placeholder="ABC 123" />
                    </div>
                  </div>

                </div>
              )}
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={onClose} className="flex-1 border-gray-700 text-gray-300">Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.full_name || !form.phone}
              className="flex-1 bg-sky-500 hover:bg-sky-600">
              {saving ? "Saving..." : "Save Customer"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}