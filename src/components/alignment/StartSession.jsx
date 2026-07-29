import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileUp, Plus, Save } from "lucide-react";

const sources = [["manual","Manual Entry"],["pdf_upload","PDF Upload"],["screenshot_upload","Screenshot Upload"],["csv_upload","CSV Upload"]];
export default function StartSession({ customers, vehicles, orders, machines, onCreate, onAddCustomer, onAddVehicle }) {
  const [form, setForm] = useState({ customer_id:"", vehicle_id:"", repair_order_id:"", machine_id:"", technician_name:"", session_type:"before_after", created_from:"manual" });
  const [file, setFile] = useState(null), [saving, setSaving] = useState(false);
  const availableVehicles = useMemo(() => vehicles.filter(v => v.customer_id === form.customer_id), [vehicles, form.customer_id]);
  const availableOrders = useMemo(() => orders.filter(o => o.customer_id === form.customer_id && (!form.vehicle_id || o.vehicle_id === form.vehicle_id)), [orders, form.customer_id, form.vehicle_id]);
  const save = async () => { setSaving(true); await onCreate(form, file); setSaving(false); };
  return <div className="rounded-xl border border-gray-800 bg-gray-900 p-5 space-y-5"><div><h2 className="text-lg font-bold text-white">Start Alignment Session</h2><p className="text-sm text-gray-400">Select shop records and choose how measurements will be captured.</p></div>
    <div className="grid md:grid-cols-2 gap-4"><Field label="Customer"><div className="flex gap-2"><Select value={form.customer_id} onChange={e=>setForm({...form,customer_id:e.target.value,vehicle_id:"",repair_order_id:""})} options={customers.map(c=>[c.id,c.full_name])} placeholder="Select customer" /><Button type="button" size="icon" variant="outline" onClick={onAddCustomer}><Plus /></Button></div></Field>
      <Field label="Vehicle"><div className="flex gap-2"><Select value={form.vehicle_id} onChange={e=>setForm({...form,vehicle_id:e.target.value,repair_order_id:""})} options={availableVehicles.map(v=>[v.id,`${v.year} ${v.make} ${v.model}`])} placeholder="Select vehicle" /><Button type="button" size="icon" variant="outline" onClick={onAddVehicle} disabled={!form.customer_id}><Plus /></Button></div></Field>
      <Field label="Repair Order (optional)"><Select value={form.repair_order_id} onChange={e=>setForm({...form,repair_order_id:e.target.value})} options={availableOrders.map(o=>[o.id,`#${o.order_number} — ${o.description || o.vehicle_info}`])} placeholder="No linked Repair Order" /></Field>
      <Field label="Alignment Machine"><Select value={form.machine_id} onChange={e=>setForm({...form,machine_id:e.target.value})} options={machines.map(m=>[m.id,`${m.make} ${m.model} — ${m.status}`])} placeholder="Select registered machine" /></Field>
      <Field label="Technician"><Input value={form.technician_name} onChange={e=>setForm({...form,technician_name:e.target.value})} className="bg-gray-800 border-gray-700 text-white" /></Field>
      <Field label="Session Type"><Select value={form.session_type} onChange={e=>setForm({...form,session_type:e.target.value})} options={[["before_after","Before & After"],["before","Before"],["after","After"],["diagnostic","Diagnostic"]]} /></Field></div>
    <div><Label className="text-gray-300">Capture method</Label><div className="grid sm:grid-cols-4 gap-2 mt-2">{sources.map(([value,label])=><button key={value} type="button" onClick={()=>{setForm({...form,created_from:value});setFile(null);}} className={`rounded-lg border p-3 text-sm font-medium ${form.created_from===value?"border-sky-500 bg-sky-500/15 text-sky-300":"border-gray-700 text-gray-400"}`}>{label}</button>)}</div></div>
    {form.created_from!=="manual" && <label className="flex items-center gap-3 rounded-lg border border-dashed border-gray-700 p-4 cursor-pointer"><FileUp className="text-sky-400" /><span className="text-sm text-gray-300">{file?.name || "Choose source file — Phase 1 stores it with the draft; automated parsing is roadmap only."}</span><input type="file" className="hidden" accept={form.created_from==="pdf_upload"?"application/pdf":form.created_from==="csv_upload"?".csv":"image/*"} onChange={e=>setFile(e.target.files?.[0]||null)} /></label>}
    <Button onClick={save} disabled={saving||!form.customer_id||!form.vehicle_id||(form.created_from!=="manual"&&!file)} className="bg-sky-600 hover:bg-sky-700"><Save />{saving?"Creating…":"Create Draft Session"}</Button>
  </div>;
}
function Field({label,children}){return <div><Label className="text-gray-400">{label}</Label><div className="mt-1">{children}</div></div>}
function Select({options=[],placeholder,value,onChange}){return <select value={value} onChange={onChange} className="h-9 w-full rounded-md border border-gray-700 bg-gray-800 px-3 text-sm text-white"><option value="">{placeholder}</option>{options.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select>}