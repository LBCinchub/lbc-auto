import React, { useEffect, useState } from "react";
import { Car, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

const empty = { year: "", make: "", model: "", trim: "", engine: "", mileage_km: "" };

export default function ManualVehicleIdentification({ open, onOpenChange, onSave }) {
  const [form, setForm] = useState(empty);
  useEffect(() => { if (open) setForm(empty); }, [open]);
  const valid = form.year && form.make && form.model;
  return <>
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 flex flex-wrap items-center gap-3">
      <Car className="w-5 h-5 text-amber-400" />
      <div className="flex-1"><p className="text-white font-semibold">Vehicle not identified automatically</p><p className="text-gray-400 text-xs">Enter the vehicle details before reviewing or creating repair documents.</p></div>
      <Button onClick={() => onOpenChange(true)} className="bg-amber-600 hover:bg-amber-700 text-white"><Pencil className="w-4 h-4 mr-1" /> Enter Vehicle Manually</Button>
    </div>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onInteractOutside={e => e.preventDefault()} onEscapeKeyDown={e => e.preventDefault()} className="bg-gray-900 border-gray-800 text-white max-w-lg">
        <DialogHeader><DialogTitle>Enter Vehicle Manually</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          {Object.entries({ year:"Year *", make:"Make *", model:"Model *", trim:"Trim", engine:"Engine", mileage_km:"Mileage (km)" }).map(([key,label]) =>
            <Input key={key} type={key === "year" || key === "mileage_km" ? "number" : "text"} value={form[key]} onChange={e => setForm({...form,[key]:e.target.value})} placeholder={label} className="bg-gray-800 border-gray-700 text-white" />)}
        </div>
        <Button disabled={!valid} onClick={() => onSave({...form, year:Number(form.year), mileage_km:form.mileage_km ? Number(form.mileage_km) : null, manual:true})} className="w-full bg-sky-600 hover:bg-sky-700">Use This Vehicle</Button>
      </DialogContent>
    </Dialog>
  </>;
}