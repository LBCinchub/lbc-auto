import React from "react";
import { UserPlus, Car } from "lucide-react";
import CustomerSearchInput from "@/components/shared/CustomerSearchInput";
import VehicleInfoBanner from "@/components/diagnostics/VehicleInfoBanner";

export default function VehiclePanel({
  customers, customerId, customerName, vehicles, vehicleId, selectedVehicle,
  onCustomerChange, onVehicleChange, onAddCustomer, onAddVehicle,
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <h2 className="text-white font-semibold text-sm mb-3">VEHICLE</h2>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <CustomerSearchInput
            customers={customers}
            value={customerId}
            onChange={onCustomerChange}
          />
          <button
            onClick={onAddCustomer}
            className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1"
          >
            <UserPlus className="w-3 h-3" /> New customer
          </button>
        </div>
        <div className="space-y-1.5">
          <select
            value={vehicleId}
            onChange={(e) => onVehicleChange(e.target.value)}
            disabled={!customerId}
            className="bg-gray-800 border border-gray-700 text-white rounded-md px-3 py-2 text-sm disabled:opacity-50 w-full"
          >
            <option value="">{customerId ? "Select a vehicle..." : "Select a customer first"}</option>
            {vehicles.map(v => (
              <option key={v.id} value={v.id}>
                {v.year} {v.make} {v.model} {v.license_plate ? `— ${v.license_plate}` : ""}
              </option>
            ))}
          </select>
          <button
            onClick={onAddVehicle}
            disabled={!customerId}
            className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Car className="w-3 h-3" /> {customerId ? "Add vehicle to this customer" : "Select a customer first"}
          </button>
        </div>
      </div>

      {selectedVehicle && (
        <div className="mt-3">
          <VehicleInfoBanner vehicle={selectedVehicle} customerName={customerName} />
        </div>
      )}
    </div>
  );
}