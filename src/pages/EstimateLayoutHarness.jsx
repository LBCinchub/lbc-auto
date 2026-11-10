// TEMPORARY synthetic layout harness — removed after verification. No saves happen unless Save is clicked.
import React from "react";
import EstimateFormDialog from "@/components/estimates/EstimateFormDialog";

const n = Number(new URLSearchParams(window.location.search).get("rows") ?? 20);
const long = "Synthetic Very Long Line Item Name For Wrapping Checks ";
const estimate = {
  customer_id: "synthetic-c1",
  customer_name: "Test Customer",
  labor_items: Array.from({ length: Math.ceil(n / 2) }, (_, i) => ({ description: `${i % 3 ? "Labor" : long}${i + 1}`, details: i % 4 ? "" : long.repeat(3), hours: 1, rate: 100 })),
  parts_items: Array.from({ length: Math.floor(n / 2) }, (_, i) => ({ name: `Part ${i + 1}`, details: "Synthetic part", quantity: 2, unit_price: 25 })),
};
const customers = [{ id: "synthetic-c1", full_name: "Test Customer", phone: "555-0100" }];
const vehicles = [{ id: "synthetic-v1", customer_id: "synthetic-c1", year: 2018, make: "Toyota", model: "Camry" }];

export default function EstimateLayoutHarness() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {Array.from({ length: 60 }, (_, i) => <p key={i} className="p-2">Background page row {i + 1}</p>)}
      <EstimateFormDialog open onClose={() => {}} estimate={estimate} customers={customers} vehicles={vehicles} parts={[]} />
    </div>
  );
}