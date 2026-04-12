import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function RepairOrderDetail() {
  const { orderId } = useParams();
  const navigate = useNavigate();

  const { data: order, isLoading } = useQuery({
    queryKey: ["repairOrder", orderId],
    queryFn: () => base44.entities.RepairOrder.get(orderId),
    enabled: !!orderId,
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
        <Button onClick={() => navigate("/Estimates")} className="bg-sky-500 hover:bg-sky-600 gap-2">
          <FileText className="w-4 h-4" /> View Estimates
        </Button>
      </div>

      <div className="rounded-xl border border-gray-800/50 bg-gray-900/50 p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-white">Repair Order #{order.order_number}</h1>
            <p className="text-gray-400 mt-1">{order.customer_name}</p>
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
            <h3 className="text-lg font-bold text-white mb-4">Parts Used</h3>
            <div className="space-y-3">
              {order.parts_used.map((part, idx) => (
                <div key={idx} className="flex justify-between items-center bg-gray-800/30 rounded-lg p-3">
                  <div>
                    <p className="text-white font-medium">{part.name}</p>
                    <p className="text-gray-400 text-sm">Qty: {part.quantity}</p>
                  </div>
                  <p className="text-white font-semibold">${part.total?.toFixed(2)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {order.notes && (
          <div className="mt-8 pt-6 border-t border-gray-800">
            <h3 className="text-lg font-bold text-white mb-3">Notes</h3>
            <p className="text-gray-300">{order.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}