import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, FileText, Plus, Trash2, MoreVertical, Clock, History, Wrench, PenLine, CheckCircle2, XCircle, ChevronDown } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import EstimateFormDialog from "@/components/estimates/EstimateFormDialog";
import SignaturePad from "@/components/orders/SignaturePad";

export default function RepairOrderDetail() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showEstimateDialog, setShowEstimateDialog] = useState(false);
  const [showPartDialog, setShowPartDialog] = useState(false);
  const [newPart, setNewPart] = useState({ name: "", quantity: "", unit_price: "" });
  const [showLaborDialog, setShowLaborDialog] = useState(false);
  const [newLabor, setNewLabor] = useState({ description: "", hours: "", rate: "" });
  const [showSignatureDialog, setShowSignatureDialog] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

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

  // Fetch all repair orders for the same vehicle to show history
  const { data: allOrders = [] } = useQuery({
    queryKey: ["repairOrders", order?.vehicle_id],
    queryFn: () => base44.entities.RepairOrder.filter({ vehicle_id: order.vehicle_id }, "-created_date", 50),
    enabled: !!order?.vehicle_id,
  });

  const previousOrders = allOrders.filter(o => o.id !== orderId);

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
           <Select value={order.status} onValueChange={(newStatus) => {
             setUpdatingStatus(true);
             base44.entities.RepairOrder.update(orderId, { status: newStatus });
             queryClient.invalidateQueries({ queryKey: ["repairOrder", orderId] });
             setUpdatingStatus(false);
           }} disabled={updatingStatus}>
             <SelectTrigger className="w-48 bg-gray-800 border-gray-700 text-white">
               <SelectValue />
             </SelectTrigger>
             <SelectContent className="bg-gray-800 border-gray-700">
               <SelectItem value="waiting">Waiting</SelectItem>
               <SelectItem value="in_progress">In Progress</SelectItem>
               <SelectItem value="waiting_for_parts">Waiting for Parts</SelectItem>
               <SelectItem value="completed">Completed</SelectItem>
               <SelectItem value="delivered">Delivered</SelectItem>
             </SelectContent>
           </Select>
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

        {/* Labor Section */}
        <div className="mt-8 pt-6 border-t border-gray-800">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Wrench className="w-5 h-5 text-sky-400" /> Labor
            </h3>
            <button onClick={() => setShowLaborDialog(true)} className="text-sky-400 hover:text-sky-300 text-sm flex items-center gap-1">
              <Plus className="w-4 h-4" /> Add Labor
            </button>
          </div>
          {order.labor_items && order.labor_items.length > 0 ? (
            <div className="space-y-3">
              {order.labor_items.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center bg-gray-800/30 rounded-lg p-3">
                  <div>
                    <p className="text-white font-medium">{item.description}</p>
                    <p className="text-gray-400 text-sm">{item.hours}h @ ${item.rate}/hr</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-white font-semibold">${(item.hours * item.rate).toFixed(2)}</p>
                    <button onClick={() => removeLabor(idx)} className="text-gray-600 hover:text-rose-400 transition-colors p-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <button onClick={() => setShowLaborDialog(true)} className="text-sky-400 hover:text-sky-300 flex items-center gap-2 font-medium">
              <Plus className="w-5 h-5" /> Add First Labor Entry
            </button>
          )}
        </div>

        {order.notes && (
          <div className="mt-8 pt-6 border-t border-gray-800">
            <h3 className="text-lg font-bold text-white mb-3">Notes</h3>
            <p className="text-gray-300">{order.notes}</p>
          </div>
        )}

        {/* Customer Signature Section */}
        <div className="mt-8 pt-6 border-t border-gray-800">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <PenLine className="w-5 h-5 text-purple-400" /> Customer Sign-off
            </h3>
            {!order.customer_signature && (
              <button onClick={() => setShowSignatureDialog(true)} className="text-purple-400 hover:text-purple-300 text-sm flex items-center gap-1">
                <PenLine className="w-4 h-4" /> Request Signature
              </button>
            )}
          </div>
          {order.customer_signature ? (
            <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-400" />
                <div>
                  <p className="text-green-400 font-medium text-sm">Signed by {order.customer_signature_name || "Customer"}</p>
                  {order.customer_signature_date && (
                    <p className="text-gray-500 text-xs">{new Date(order.customer_signature_date).toLocaleString()}</p>
                  )}
                </div>
                <button onClick={() => setShowSignatureDialog(true)} className="ml-auto text-gray-600 hover:text-gray-400 text-xs">Re-sign</button>
              </div>
              <img
                src={order.customer_signature}
                alt="Customer signature"
                className="max-h-20 rounded-lg bg-gray-800 p-2"
              />
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-gray-700 bg-gray-800/20 p-6 flex flex-col items-center gap-3 text-center">
              <XCircle className="w-8 h-8 text-gray-600" />
              <p className="text-gray-500 text-sm">No signature captured yet</p>
              <button
                onClick={() => setShowSignatureDialog(true)}
                className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium flex items-center gap-2"
              >
                <PenLine className="w-4 h-4" /> Capture Signature
              </button>
            </div>
          )}
        </div>

        {/* Timestamps */}
        <div className="mt-6 pt-4 border-t border-gray-800 flex flex-wrap gap-4 text-xs text-gray-600">
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Created: {new Date(order.created_date).toLocaleString()}</span>
          {order.updated_date && order.updated_date !== order.created_date && (
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Updated: {new Date(order.updated_date).toLocaleString()}</span>
          )}
        </div>
      </div>

      {/* Previous Work on This Vehicle */}
      {previousOrders.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-6">
          <div className="flex items-center gap-2 mb-4">
            <History className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-bold text-amber-400">Previous Work on This Vehicle</h2>
            <span className="text-xs bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full">{previousOrders.length} record{previousOrders.length > 1 ? "s" : ""}</span>
          </div>
          <div className="space-y-3">
            {previousOrders.map(prev => (
              <div key={prev.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-gray-900/60 rounded-lg p-4 border border-amber-500/10 hover:border-amber-500/30 transition-colors cursor-pointer" onClick={() => navigate(`/RepairOrderDetail/${prev.id}`)}>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white font-semibold text-sm">#{prev.order_number}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${
                      prev.status === "completed" || prev.status === "delivered" ? "bg-green-500/20 text-green-400" :
                      prev.status === "in_progress" ? "bg-yellow-500/20 text-yellow-400" :
                      "bg-gray-500/20 text-gray-400"
                    }`}>{prev.status?.replace("_", " ")}</span>
                  </div>
                  <p className="text-gray-400 text-sm mt-0.5 truncate">{prev.description}</p>
                  {prev.mechanic_name && <p className="text-gray-600 text-xs mt-0.5">Mechanic: {prev.mechanic_name}</p>}
                </div>
                <div className="flex items-center gap-4 flex-shrink-0 text-right">
                  {prev.total_cost > 0 && (
                    <div>
                      <p className="text-xs text-gray-500">Total</p>
                      <p className="text-emerald-400 font-semibold">${prev.total_cost.toFixed(2)}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-gray-500">Date</p>
                    <p className="text-gray-300 text-xs">{new Date(prev.created_date).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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

      <Dialog open={showSignatureDialog} onOpenChange={setShowSignatureDialog}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PenLine className="w-4 h-4 text-purple-400" /> Customer Signature
            </DialogTitle>
          </DialogHeader>
          <p className="text-gray-400 text-sm -mt-1">
            Have the customer sign below to approve the repair / estimate for <span className="text-white font-medium">{order.vehicle_info}</span>.
          </p>
          <SignaturePad
            existingSignature={order.customer_signature}
            signerName={order.customer_signature_name || order.customer_name}
            onCancel={() => setShowSignatureDialog(false)}
            onSave={({ signatureDataUrl, signerName, signedAt }) => {
              base44.entities.RepairOrder.update(orderId, {
                customer_signature: signatureDataUrl,
                customer_signature_name: signerName,
                customer_signature_date: signedAt,
              });
              queryClient.invalidateQueries({ queryKey: ["repairOrder", orderId] });
              setShowSignatureDialog(false);
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={showLaborDialog} onOpenChange={setShowLaborDialog}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white">
          <DialogHeader>
            <DialogTitle>Add Labor</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-gray-400">Description</Label>
              <Input value={newLabor.description} onChange={e => setNewLabor({...newLabor, description: e.target.value})}
                className="bg-gray-800 border-gray-700 text-white mt-1" placeholder="e.g. Oil change, Brake replacement" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-400">Hours</Label>
                <Input type="number" step="0.5" value={newLabor.hours} onChange={e => setNewLabor({...newLabor, hours: e.target.value})}
                  className="bg-gray-800 border-gray-700 text-white mt-1" placeholder="0" />
              </div>
              <div>
                <Label className="text-gray-400">Rate ($/hr)</Label>
                <Input type="number" value={newLabor.rate} onChange={e => setNewLabor({...newLabor, rate: e.target.value})}
                  className="bg-gray-800 border-gray-700 text-white mt-1" placeholder="0.00" />
              </div>
            </div>
            {newLabor.hours && newLabor.rate && (
              <p className="text-sky-400 text-sm font-medium">Total: ${(parseFloat(newLabor.hours) * parseFloat(newLabor.rate)).toFixed(2)}</p>
            )}
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowLaborDialog(false)} className="flex-1 px-4 py-2 rounded border border-gray-700 text-gray-300 hover:bg-gray-800">Cancel</button>
              <button onClick={addLabor} className="flex-1 px-4 py-2 rounded bg-sky-500 hover:bg-sky-600 text-white font-medium">Add Labor</button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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

  function addLabor() {
    if (!newLabor.description || !newLabor.hours || !newLabor.rate) return;
    const hours = parseFloat(newLabor.hours) || 0;
    const rate = parseFloat(newLabor.rate) || 0;
    const item = { description: newLabor.description, hours, rate, total: hours * rate };
    const updatedItems = [...(order.labor_items || []), item];
    const newLaborCost = updatedItems.reduce((sum, i) => sum + i.hours * i.rate, 0);
    const newTotal = newLaborCost + (order.parts_cost || 0);
    base44.entities.RepairOrder.update(orderId, {
      labor_items: updatedItems,
      labor_hours: updatedItems.reduce((sum, i) => sum + i.hours, 0),
      labor_cost: newLaborCost,
      total_cost: newTotal,
    });
    setNewLabor({ description: "", hours: "", rate: "" });
    setShowLaborDialog(false);
    queryClient.invalidateQueries({ queryKey: ["repairOrder", orderId] });
  }

  function removeLabor(idx) {
    const updatedItems = order.labor_items.filter((_, i) => i !== idx);
    const newLaborCost = updatedItems.reduce((sum, i) => sum + i.hours * i.rate, 0);
    const newTotal = newLaborCost + (order.parts_cost || 0);
    base44.entities.RepairOrder.update(orderId, {
      labor_items: updatedItems,
      labor_hours: updatedItems.reduce((sum, i) => sum + i.hours, 0),
      labor_cost: newLaborCost,
      total_cost: newTotal,
    });
    queryClient.invalidateQueries({ queryKey: ["repairOrder", orderId] });
  }
}