import React, { useState } from "react";
import { CalendarPlus, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { vehicleName } from "./dashboardUtils";

export default function BookingModal({ vehicle, onClose, onSubmit }) {
  const [form, setForm] = useState({ service_type:"", date:"", time_slot:"", notes:"" }); const [state, setState] = useState({ loading:false, error:"" });
  const submit = async (e) => { e.preventDefault(); setState({loading:true,error:""}); try { await onSubmit({ ...form, vehicle_id: vehicle.id }); onClose(); } catch (error) { setState({loading:false,error:error.message}); } };
  return <Dialog open onOpenChange={() => {}}><DialogContent className="cd-modal" onEscapeKeyDown={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()}><DialogHeader><DialogTitle>Book an appointment</DialogTitle><DialogDescription>{vehicleName(vehicle)}</DialogDescription></DialogHeader><form className="cd-form" onSubmit={submit}>
    <label>Service needed<input required value={form.service_type} onChange={(e)=>setForm({...form,service_type:e.target.value})} placeholder="Oil change, inspection, brakes…"/></label><div className="cd-form-row"><label>Date<input type="date" required min={new Date().toISOString().slice(0,10)} value={form.date} onChange={(e)=>setForm({...form,date:e.target.value})}/></label><label>Preferred time<input required value={form.time_slot} onChange={(e)=>setForm({...form,time_slot:e.target.value})} placeholder="10:00 AM"/></label></div><label>Notes<textarea value={form.notes} onChange={(e)=>setForm({...form,notes:e.target.value})} rows="3" placeholder="Anything the shop should know?"/></label>{state.error && <p className="cd-inline-error">{state.error}</p>}<div className="cd-form-actions"><button type="button" onClick={onClose}><X/>Cancel</button><button className="primary" disabled={state.loading}><CalendarPlus/>{state.loading ? "Booking…" : "Request Appointment"}</button></div>
  </form></DialogContent></Dialog>;
}