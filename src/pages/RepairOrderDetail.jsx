import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, FileText, Plus, Trash2, MoreVertical } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import EstimateFormDialog from "@/components/estimates/EstimateFormDialog";

export default function RepairOrderDetail() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showEstimateDialog, setShowEstimateDialog] = useState(false);
  const [showPartDialog, setShowPartDialog] = useState(false);
  const [newPart, setNewPart] = useState({ name: "", quantity: "", unit_price: "" });

  const { data: order, isLoading } = useQuery({
    queryKey: ["repairOrder", orderId],
    queryFn: () => base44.entities.RepairOrder.get(orderId),
    enabled: !!orderId,
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: () => base44.entities.Customer.list(),
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles"],
    queryFn: () => base44.entities.Vehicle.list(),
  });

  const { data: customer } = useQuery({
    queryKey: ["customer", order?.customer_id],
    queryFn: () => base44.entities.Customer.get(order.customer_id),
    enabled: !!order?.customer_id,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate(-1)} className="text-gray-400 hover:text-white gap-2">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
        <div className="h-40 rounded-xl bg-gray-800/30 animate-pulse" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400">Repair order not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate(-1)} className="text-gray-400 hover:text-white gap-2">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
        <div className="flex items-center gap-2">
          <Button onClick={() => setShowEstimateDialog(true)} className="bg-green-600 hover:bg-green-700 gap-2">
            <Plus className="w-4 h-4" /> Create Estimate
          </Button>
          <Button onClick={() => navigate("/Estimates")} className="bg-sky-500 hover:bg-sky-600 gap-2">
            <FileText className="w-4 h-4" /> View Estimates
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-gray-800/50 bg-gray-900/50 p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-white">Repair Order #{order.order_number}</h1>
            <p className="text-gray-400 mt-1">{order.customer_name}</p>
            {customer?.phone && <p className="text-gray-500 text-sm mt-1">{customer.phone}</p>}
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            order.status === "completed"
              ? "bg-green-500/20 text-green-400"
              : order.status === "in_progress"
              ? "bg-yellow-500/20 text-yellow-400"
              : order.status === "waiting_for_parts"
              ? "bg-orange-500/20 text-orange-400"
              : "bg-gray-500/20 text-gray-400"
          }`}>
            {order.status}
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mb-8">
          <div>
            <p className="text-gray-500 text-xs uppercase mb-1">Vehicle</p>
            <p className="text-white font-semibold">{order.vehicle_info}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs uppercase mb-1">Mechanic</p>
            <p className="text-white">{order.mechanic_name || "Unassigned"}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs uppercase mb-1">Status</p>
            <p className="text-white capitalize">{order.status?.replace("_", " ")}</p>
          </div>
        </div>

        <div className="border-t border-gray-800 pt-6">
          <h2 className="text-lg font-bold text-white mb-4">Description</h2>
          <p className="text-gray-300">{order.description}</p>
        </div>

        <div className="grid grid-cols-3 gap-4 mt-8 pt-6 border-t border-gray-800">
          <div>
            <p className="text-gray-500 text-xs uppercase mb-1">Labor Hours</p>
            <p className="text-white text-lg font-semibold">{order.labor_hours || 0}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs uppercase mb-1">Labor Cost</p>
            <p className="text-white text-lg font-semibold">${order.labor_cost?.toFixed(2) || "0.00"}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs uppercase mb-1">Parts Cost</p>
            <p className="text-white text-lg font-semibold">${order.parts_cost?.toFixed(2) || "0.00"}</p>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-gray-800">
          <p className="text-gray-500 text-xs uppercase mb-2">Total Cost</p>
          <p className="text-white text-3xl font-bold">${order.total_cost?.toFixed(2) || "0.00"}</p>
        </div>

        {order.parts_used && order.parts_used.length > 0 && (
          <div className="mt-8 pt-6 border-t border-gray-800">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Parts Used</h3>
              <button onClick={() => setShowPartDialog(true)} className="text-sky-400 hover:text-sky-300 text-sm flex items-center gap-1">
                <Plus className="w-4 h-4" /> Add Part
              </button>
            </div>
            <div className="space-y-3">
              {order.parts_used.map((part, idx) => (
                <div key={idx} className="flex justify-between items-center bg-gray-800/30 rounded-lg p-3">
                  <div>
                    <p className="text-white font-medium">{part.name}</p>
                    <p className="text-gray-400 text-sm">Qty: {part.quantity}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-white font-semibold">${part.total?.toFixed(2)}</p>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="text-gray-600 hover:text-gray-400 transition-colors p-1">
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="bg-gray-800 border-gray-700 text-white">
                        <DropdownMenuItem onClick={() => setShowPartDialog(true)} className="cursor-pointer hover:bg-gray-700">
                          <Plus className="w-4 h-4 mr-2" /> Add Part
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => removePart(idx)} className="cursor-pointer hover:bg-gray-700 text-rose-400">
                          <Trash2 className="w-4 h-4 mr-2" /> Remove
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) || (
          <div className="mt-8 pt-6 border-t border-gray-800">
            <button onClick={() => setShowPartDialog(true)} className="text-sky-400 hover:text-sky-300 flex items-center gap-2 font-medium">
              <Plus className="w-5 h-5" /> Add First Part
            </button>
          </div>
        )}

        {order.notes && (
          <div className="mt-8 pt-6 border-t border-gray-800">
            <h3 className="text-lg font-bold text-white mb-3">Notes</h3>
            <p className="text-gray-300">{order.notes}</p>
          </div>
        )}
      </div>

      <EstimateFormDialog
        open={showEstimateDialog}
        onClose={() => setShowEstimateDialog(false)}
        estimate={null}
        customers={customers}
        vehicles={vehicles}
        repairOrderId={orderId}
        onSaved={() => {
          setShowEstimateDialog(false);
          navigate("/Estimates");
        }}
      />

      <Dialog open={showPartDialog} onOpenChange={setShowPartDialog}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white">
          <DialogHeader>
            <DialogTitle>Add Part</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-gray-400">Part Name</Label>
              <Input value={newPart.name} onChange={e => setNewPart({...newPart, name: e.target.value})} 
                className="bg-gray-800 border-gray-700 text-white mt-1" placeholder="e.g. Oil Filter" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-400">Quantity</Label>
                <Input type="number" value={newPart.quantity} onChange={e => setNewPart({...newPart, quantity: e.target.value})} 
                  className="bg-gray-800 border-gray-700 text-white mt-1" placeholder="0" />
              </div>
              <div>
                <Label className="text-gray-400">Unit Price</Label>
                <Input type="number" value={newPart.unit_price} onChange={e => setNewPart({...newPart, unit_price: e.target.value})} 
                  className="bg-gray-800 border-gray-700 text-white mt-1" placeholder="0.00" />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowPartDialog(false)} className="flex-1 px-4 py-2 rounded border border-gray-700 text-gray-300 hover:bg-gray-800">Cancel</button>
              <button onClick={addPart} className="flex-1 px-4 py-2 rounded bg-sky-500 hover:bg-sky-600 text-white font-medium">Add Part</button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );

  function addPart() {
    if (!newPart.name || !newPart.quantity || !newPart.unit_price) return;
    const qty = parseFloat(newPart.quantity) || 0;
    const price = parseFloat(newPart.unit_price) || 0;
    const part = { name: newPart.name, quantity: qty, unit_price: price, total: qty * price };
    const updatedParts = [...(order.parts_used || []), part];
    base44.entities.RepairOrder.update(orderId, { parts_used: updatedParts });
    setNewPart({ name: "", quantity: "", unit_price: "" });
    setShowPartDialog(false);
    queryClient.invalidateQueries({ queryKey: ["repairOrder", orderId] });
  }

  function removePart(idx) {
    const updatedParts = order.parts_used.filter((_, i) => i !== idx);
    base44.entities.RepairOrder.update(orderId, { parts_used: updatedParts });
    queryClient.invalidateQueries({ queryKey: ["repairOrder", orderId] });
  }
}