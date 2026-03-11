import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { HardHat, Phone, Mail, Pencil, Trash2, Wrench, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PageHeader from "../components/shared/PageHeader";
import EmptyState from "../components/shared/EmptyState";
import StatusBadge from "../components/shared/StatusBadge";

export default function Mechanics() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", phone: "", email: "", specialty: "", hourly_rate: "", status: "available" });
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  const { data: mechanics = [] } = useQuery({
    queryKey: ["mechanics"],
    queryFn: () => base44.entities.Mechanic.list("-created_date", 50),
  });

  const { data: orders = [] } = useQuery({
    queryKey: ["repairOrders"],
    queryFn: () => base44.entities.RepairOrder.list("-created_date", 200),
  });

  const openDialog = (mech) => {
    setEditing(mech);
    setForm(mech ? {
      name: mech.name || "", phone: mech.phone || "", email: mech.email || "",
      specialty: mech.specialty || "", hourly_rate: mech.hourly_rate || "", status: mech.status || "available"
    } : { name: "", phone: "", email: "", specialty: "", hourly_rate: "", status: "available" });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    const data = { ...form, hourly_rate: Number(form.hourly_rate) || 0 };
    if (editing) {
      await base44.entities.Mechanic.update(editing.id, data);
    } else {
      await base44.entities.Mechanic.create(data);
    }
    setSaving(false);
    queryClient.invalidateQueries({ queryKey: ["mechanics"] });
    setDialogOpen(false);
  };

  const handleDelete = async (id) => {
    if (window.confirm("Delete this mechanic?")) {
      await base44.entities.Mechanic.delete(id);
      queryClient.invalidateQueries({ queryKey: ["mechanics"] });
    }
  };

  const getMechanicStats = (mechId) => {
    const mechOrders = orders.filter(o => o.mechanic_id === mechId);
    const active = mechOrders.filter(o => o.status === "in_progress").length;
    const completed = mechOrders.filter(o => o.status === "completed" || o.status === "delivered").length;
    const totalHours = mechOrders.reduce((sum, o) => sum + (o.labor_hours || 0), 0);
    const totalRevenue = mechOrders.reduce((sum, o) => sum + (o.labor_cost || 0), 0);
    return { active, completed, totalHours, totalRevenue };
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Mechanics" subtitle={`${mechanics.length} team members`}
        onAdd={() => openDialog(null)} addLabel="Add Mechanic" />

      {mechanics.length === 0 ? (
        <EmptyState icon={HardHat} title="No mechanics yet" description="Add your first mechanic."
          onAction={() => openDialog(null)} actionLabel="Add Mechanic" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {mechanics.map(m => {
            const stats = getMechanicStats(m.id);
            return (
              <div key={m.id} className="rounded-xl border border-gray-800/50 bg-gray-900/50 p-5 hover:border-sky-500/30 transition-colors">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-sky-500/20 flex items-center justify-center">
                      <span className="text-sky-400 font-bold">{m.name?.charAt(0)?.toUpperCase()}</span>
                    </div>
                    <div>
                      <h3 className="text-white font-semibold">{m.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <StatusBadge status={m.status} />
                        <span className="text-xs text-gray-500">${m.hourly_rate}/hr</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-white"
                      onClick={() => openDialog(m)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-rose-400"
                      onClick={() => handleDelete(m.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                {m.specialty && <p className="text-xs text-gray-500 mb-3">{m.specialty}</p>}

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-gray-800/30 p-3 text-center">
                    <p className="text-lg font-bold text-white">{stats.active}</p>
                    <p className="text-[10px] text-gray-500">Active Jobs</p>
                  </div>
                  <div className="rounded-lg bg-gray-800/30 p-3 text-center">
                    <p className="text-lg font-bold text-white">{stats.completed}</p>
                    <p className="text-[10px] text-gray-500">Completed</p>
                  </div>
                  <div className="rounded-lg bg-gray-800/30 p-3 text-center">
                    <p className="text-lg font-bold text-white">{stats.totalHours.toFixed(1)}</p>
                    <p className="text-[10px] text-gray-500">Hours Logged</p>
                  </div>
                  <div className="rounded-lg bg-gray-800/30 p-3 text-center">
                    <p className="text-lg font-bold text-emerald-400">${stats.totalRevenue.toFixed(0)}</p>
                    <p className="text-[10px] text-gray-500">Revenue</p>
                  </div>
                </div>

                <div className="mt-3 space-y-1">
                  {m.phone && (
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Phone className="w-3 h-3" /> {m.phone}
                    </div>
                  )}
                  {m.email && (
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Mail className="w-3 h-3" /> {m.email}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Mechanic" : "New Mechanic"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label className="text-gray-400">Full Name *</Label>
              <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                className="bg-gray-800 border-gray-700 text-white mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-gray-400">Phone</Label>
                <Input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})}
                  className="bg-gray-800 border-gray-700 text-white mt-1" />
              </div>
              <div>
                <Label className="text-gray-400">Email</Label>
                <Input value={form.email} onChange={e => setForm({...form, email: e.target.value})}
                  className="bg-gray-800 border-gray-700 text-white mt-1" />
              </div>
            </div>
            <div>
              <Label className="text-gray-400">Specialty</Label>
              <Input value={form.specialty} onChange={e => setForm({...form, specialty: e.target.value})}
                className="bg-gray-800 border-gray-700 text-white mt-1" placeholder="e.g., Engine, Transmission" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-gray-400">Hourly Rate ($) *</Label>
                <Input type="number" value={form.hourly_rate}
                  onChange={e => setForm({...form, hourly_rate: e.target.value})}
                  className="bg-gray-800 border-gray-700 text-white mt-1" />
              </div>
              <div>
                <Label className="text-gray-400">Status</Label>
                <Select value={form.status} onValueChange={v => setForm({...form, status: v})}>
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700">
                    <SelectItem value="available">Available</SelectItem>
                    <SelectItem value="busy">Busy</SelectItem>
                    <SelectItem value="off_duty">Off Duty</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}
                className="flex-1 border-gray-700 text-gray-300">Cancel</Button>
              <Button onClick={handleSave} disabled={saving || !form.name || !form.hourly_rate}
                className="flex-1 bg-sky-500 hover:bg-sky-600">
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}