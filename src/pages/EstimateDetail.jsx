import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Printer, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function EstimateDetail() {
  const { estimateId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);

  useEffect(() => {
    const loadUser = async () => {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    };
    loadUser();
  }, []);

  const { data: estimate, isLoading } = useQuery({
    queryKey: ["estimate", estimateId],
    queryFn: () => base44.entities.Estimate.get(estimateId),
    enabled: !!estimateId,
  });

  const { data: customer } = useQuery({
    queryKey: ["customer", estimate?.customer_id],
    queryFn: () => base44.entities.Customer.get(estimate.customer_id),
    enabled: !!estimate?.customer_id,
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

  if (!estimate) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400">Estimate not found</p>
      </div>
    );
  }

  const handlePrint = () => {
    window.print();
  };

  const handleConvertToRepairOrder = async () => {
    if (!window.confirm("Convert this estimate to a repair order?")) return;
    try {
      await base44.entities.RepairOrder.create({
        customer_id: estimate.customer_id,
        customer_name: estimate.customer_name,
        vehicle_id: estimate.vehicle_id,
        vehicle_info: estimate.vehicle_info,
        description: estimate.notes || "Created from estimate #" + estimate.estimate_number,
        status: "waiting",
        labor_hours: estimate.labor_items?.reduce((sum, item) => sum + (parseFloat(item.hours) || 0), 0) || 0,
        labor_cost: estimate.labor_total || 0,
        parts_used: estimate.parts_items?.map(item => ({
          name: item.name,
          part_number: item.part_number,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total: item.total
        })) || [],
        parts_cost: estimate.parts_total || 0,
        total_cost: estimate.grand_total || 0,
      });
      await base44.entities.Estimate.update(estimate.id, { status: "approved" });
      queryClient.invalidateQueries({ queryKey: ["estimates", "repairOrders"] });
      navigate("/RepairOrders");
    } catch (error) {
      console.error("Error converting estimate:", error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between no-print">
        <Button variant="ghost" onClick={() => navigate(-1)} className="text-gray-400 hover:text-white gap-2">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
        <div className="flex gap-2">
          {estimate.status === "approved" && (
            <Button onClick={handleConvertToRepairOrder} className="bg-green-500/20 text-green-400 hover:bg-green-500/30 gap-2">
              <CheckCircle2 className="w-4 h-4" /> Convert to Repair Order
            </Button>
          )}
          <Button onClick={handlePrint} variant="outline" className="gap-2">
            <Printer className="w-4 h-4" /> Print
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-gray-800/50 bg-gray-900/50 p-8 print:border-0 print:bg-white print:text-black print:p-0">
        {/* Header */}
        <div className="mb-8 pb-8 border-b border-gray-800 print:border-gray-300 no-print">
          <div className="flex items-start justify-between mb-6">
            <div>
              {user?.business_name && <h2 className="text-sm font-semibold text-sky-400 print:text-sky-600 mb-2">{user.business_name}</h2>}
              <h1 className="text-4xl font-bold text-white print:text-black">Estimate</h1>
              <p className="text-gray-400 print:text-gray-600 mt-1">#{estimate.estimate_number}</p>
            </div>
            <span className={`text-sm font-medium px-3 py-1 rounded-full capitalize ${
              estimate.status === "draft" ? "bg-gray-700/50 text-gray-300" :
              estimate.status === "sent" ? "bg-blue-500/20 text-blue-400" :
              estimate.status === "approved" ? "bg-green-500/20 text-green-400" :
              estimate.status === "declined" ? "bg-rose-500/20 text-rose-400" :
              "bg-yellow-500/20 text-yellow-400"
            }`}>
              {estimate.status}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-8">
            <div>
              <h3 className="text-xs uppercase text-gray-500 print:text-gray-600 font-semibold mb-2">Customer</h3>
              <p className="text-white print:text-black font-semibold">{estimate.customer_name}</p>
              {customer?.phone && <p className="text-gray-400 print:text-gray-600 text-sm mt-1">{customer.phone}</p>}
            </div>
            <div>
              <h3 className="text-xs uppercase text-gray-500 print:text-gray-600 font-semibold mb-2">Vehicle</h3>
              <p className="text-white print:text-black font-semibold">{estimate.vehicle_info}</p>
            </div>
            <div>
              <h3 className="text-xs uppercase text-gray-500 print:text-gray-600 font-semibold mb-2">Valid Until</h3>
              <p className="text-white print:text-black">{estimate.valid_until ? new Date(estimate.valid_until).toLocaleDateString() : "N/A"}</p>
            </div>
            <div>
              <h3 className="text-xs uppercase text-gray-500 print:text-gray-600 font-semibold mb-2">Estimate Date</h3>
              <p className="text-white print:text-black">{new Date(estimate.created_date).toLocaleDateString()}</p>
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div className="mb-8 print:mb-6">
          {estimate.labor_items && estimate.labor_items.length > 0 && (
            <div className="mb-8 print:mb-6">
              <h2 className="text-lg font-bold text-white print:text-black mb-4">Labor</h2>
              <div className="space-y-2">
                {estimate.labor_items.map((item, idx) => (
                  <div key={`labor-${idx}`} className="flex justify-between items-center bg-gray-800/30 print:bg-gray-100 rounded-lg p-4 print:p-3">
                    <div>
                      <p className="text-white print:text-black font-medium">{item.description}</p>
                      <p className="text-gray-400 print:text-gray-600 text-sm">{item.hours}h @ ${item.rate?.toFixed(2)}/hr</p>
                    </div>
                    <p className="text-white print:text-black font-semibold">${item.total?.toFixed(2)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {estimate.parts_items && estimate.parts_items.length > 0 && (
            <div className="mb-8 print:mb-6">
              <h2 className="text-lg font-bold text-white print:text-black mb-4">Parts</h2>
              <div className="space-y-2">
                {estimate.parts_items.map((item, idx) => (
                  <div key={`parts-${idx}`} className="flex justify-between items-center bg-gray-800/30 print:bg-gray-100 rounded-lg p-4 print:p-3">
                    <div>
                      <p className="text-white print:text-black font-medium">{item.name}</p>
                      <p className="text-gray-400 print:text-gray-600 text-sm">{item.quantity} × ${item.unit_price?.toFixed(2)}</p>
                    </div>
                    <p className="text-white print:text-black font-semibold">${item.total?.toFixed(2)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Summary */}
        <div className="border-t border-gray-800 print:border-gray-300 pt-6 space-y-3">
          <div className="flex justify-between text-gray-300 print:text-gray-600">
            <span>Labor Total:</span>
            <span>${(estimate.labor_total || 0).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-gray-300 print:text-gray-600">
            <span>Parts Total:</span>
            <span>${(estimate.parts_total || 0).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-gray-300 print:text-gray-600">
            <span>Tax ({estimate.tax_rate || 0}%):</span>
            <span>${(estimate.tax_amount || 0).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-white print:text-black text-xl font-bold border-t border-gray-800 print:border-gray-300 pt-3">
            <span>Grand Total:</span>
            <span>${(estimate.grand_total || 0).toFixed(2)}</span>
          </div>
        </div>

        {estimate.notes && (
          <div className="mt-8 pt-8 border-t border-gray-800 print:border-gray-300">
            <h3 className="text-lg font-bold text-white print:text-black mb-3">Notes</h3>
            <p className="text-gray-300 print:text-gray-700 whitespace-pre-wrap">{estimate.notes}</p>
          </div>
        )}
      </div>

      <style>{`
        @media print {
          body { background: white; margin: 0; padding: 0; }
          .print\:border-0 { border: none; }
          .print\:bg-white { background: white; }
          .print\:text-black { color: black; }
          .print\:text-gray-300 { color: #d1d5db; }
          .print\:text-gray-600 { color: #4b5563; }
          .print\:text-gray-700 { color: #374151; }
          .print\:border-gray-300 { border-color: #d1d5db; }
          .print\:bg-gray-100 { background: #f3f4f6; }
          .print\:mb-6 { margin-bottom: 1.5rem; }
          .print\:p-3 { padding: 0.75rem; }
          .no-print { display: none !important; }
        }
      `}</style>
    </div>
  );
}