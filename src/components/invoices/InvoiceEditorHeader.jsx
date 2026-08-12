import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import StatusBadge from "@/components/shared/StatusBadge";
import { buildVehicleInfo } from "@/utils/buildVehicleInfo";
import { formatPhone } from "@/utils/formatPhone";

export default function InvoiceEditorHeader({ data }) {
  const navigate = useNavigate();
  const invoice = data?.invoice;
  const customer = data?.customer;
  const vehicle = data?.vehicle;
  const customerId = invoice?.customer_id || customer?.id;
  const vehicleId = invoice?.vehicle_id || vehicle?.id;
  const vehicleLine = buildVehicleInfo(vehicle) || invoice?.vehicle_info || "";

  return (
    <div className="border-b border-gray-800 px-5 py-4 md:px-6">
      <div className="flex items-start justify-between gap-4">
        {/* LEFT — back button + customer/vehicle info block */}
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <button
            onClick={() => navigate(-1)}
            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-gray-700 text-gray-300 transition-colors hover:border-sky-500 hover:text-sky-400"
            title="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-sky-400">Invoice</p>
            <button
              disabled={!customerId}
              onClick={() => customerId && navigate(`/CustomerDetails?id=${customerId}`)}
              className={`mt-1 block max-w-full truncate text-left text-lg font-bold text-white ${customerId ? "cursor-pointer hover:text-sky-300 hover:underline" : "cursor-default"}`}
              title={customer?.full_name || ""}
            >
              {customer?.full_name || invoice?.customer_name || "—"}
            </button>
            {customer?.phone && (
              <p className="text-sm text-gray-400">{formatPhone(customer.phone)}</p>
            )}
            {vehicleLine && (
              <button
                disabled={!vehicleId}
                onClick={() => vehicleId && navigate(`/VehicleTimeline/${vehicleId}`)}
                className={`mt-1 block max-w-full truncate text-left text-sm font-medium text-gray-200 ${vehicleId ? "cursor-pointer hover:text-sky-300 hover:underline" : "cursor-default"}`}
                title={vehicleLine}
              >
                {vehicleLine}
              </button>
            )}
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-500">
              {vehicle?.vin && <span>VIN: {vehicle.vin}</span>}
              {vehicle?.license_plate && <span>Plate: {vehicle.license_plate}</span>}
            </div>
          </div>
        </div>

        {/* RIGHT — LBC logo + number + status badge */}
        <div className="flex shrink-0 flex-col items-end gap-2">
          <span className="inline-flex items-center rounded-md bg-sky-500/15 px-2 py-0.5 text-xs font-extrabold tracking-wider text-sky-400 ring-1 ring-inset ring-sky-500/30">
            LBC
          </span>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-white">{invoice?.invoice_number || "New Invoice"}</h2>
            {invoice && <StatusBadge status={invoice.status} />}
          </div>
        </div>
      </div>
      {(data?.estimate || data?.repair_order) && (
        <p className="mt-2 text-xs text-gray-500">
          {data.estimate?.estimate_number && `Estimate ${data.estimate.estimate_number}`}
          {data.estimate && data.repair_order && " · "}
          {data.repair_order?.order_number && `Repair Order ${data.repair_order.order_number}`}
        </p>
      )}
    </div>
  );
}