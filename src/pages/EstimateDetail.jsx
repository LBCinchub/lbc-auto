import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import PrintTemplate from "@/components/shared/PrintTemplate";

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
    // handled inside PrintTemplate
  };

  const handleConvertToInvoice = async () => {
    if (!window.confirm("Convert this estimate to an invoice?")) return;
    try {
      const lineItems = [
        ...(estimate.parts_items || []).map(p => ({
          description: p.name,
          type: "part",
          quantity: p.quantity || 1,
          unit_price: p.unit_price || 0,
          total: p.total || 0,
        })),
        ...(estimate.labor_items || []).map(l => ({
          description: l.description || "Labor",
          type: "labor",
          quantity: l.hours || 1,
          unit_price: l.rate || 0,
          total: l.total || 0,
        })),
      ];
      const inv = await base44.entities.Invoice.create({
        estimate_id: estimate.id,
        customer_id: estimate.customer_id,
        customer_name: estimate.customer_name,
        vehicle_info: estimate.vehicle_info,
        line_items: lineItems,
        parts_total: estimate.parts_total || 0,
        labor_total: estimate.labor_total || 0,
        tax_rate: estimate.tax_rate || 0,
        tax_amount: estimate.tax_amount || 0,
        total: estimate.grand_total || 0,
        balance_due: estimate.grand_total || 0,
        amount_paid: 0,
        status: "unpaid",
      });
      await base44.entities.Estimate.update(estimate.id, { status: "approved" });
      navigate(`/InvoiceDetail/${inv.id}`);
    } catch (error) {
      console.error("Error converting estimate to invoice:", error);
    }
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

  // Build line items for print template
  const lineItems = [];
  (estimate.parts_items || []).forEach(p => {
    lineItems.push({
      name: p.name,
      description: p.part_number ? `Part #: ${p.part_number}` : "",
      unit_price: p.unit_price || 0,
      qty: p.quantity || 1,
      amount: p.total || (p.unit_price || 0) * (p.quantity || 1),
    });
  });
  (estimate.labor_items || []).forEach(l => {
    lineItems.push({
      name: l.description || "Labor",
      description: `${l.hours}h @ $${(l.rate || 0).toFixed(2)}/hr`,
      unit_price: l.rate || 0,
      qty: l.hours || 0,
      amount: l.total || 0,
    });
  });

  const financials = {
    partsTotal: estimate.parts_total || 0,
    laborTotal: estimate.labor_total || 0,
    subtotal: (estimate.parts_total || 0) + (estimate.labor_total || 0),
    taxRate: estimate.tax_rate || 0,
    taxAmount: estimate.tax_amount || 0,
    grandTotal: estimate.grand_total || 0,
    amountPaid: 0,
    balanceDue: estimate.grand_total || 0,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate(-1)} className="text-gray-400 hover:text-white gap-2">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
        <div className="flex gap-2">
          {estimate.status === "approved" && (
            <Button onClick={handleConvertToInvoice} className="bg-emerald-500 hover:bg-emerald-600 text-white gap-2">
              <CheckCircle2 className="w-4 h-4" /> Convert to Invoice
            </Button>
          )}
          {estimate.status !== "approved" && (
            <Button onClick={handleConvertToRepairOrder} className="bg-green-500/20 text-green-400 hover:bg-green-500/30 gap-2">
              <CheckCircle2 className="w-4 h-4" /> Convert to Repair Order
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-gray-800/50 bg-white p-8">
        <PrintTemplate
          type="Estimate"
          docNumber={estimate.estimate_number}
          createdDate={new Date(estimate.created_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          user={user}
          customer={{ name: estimate.customer_name, phone: customer?.phone, email: customer?.email }}
          vehicle={{ info: estimate.vehicle_info }}
          lineItems={lineItems}
          paymentHistory={[]}
          financials={financials}
          notes={estimate.notes}
        />
      </div>
    </div>
  );
}