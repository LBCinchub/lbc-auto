import { base44 } from "@/api/base44Client";

const VEHICLE_KEYS = ["year", "make", "model", "color", "plate", "vin"];
const hasVehicle = (form) => VEHICLE_KEYS.some((k) => form[k].trim());

// Returns a message to show inline, or "" when the form can be saved.
export function validateFirstCustomer(form) {
  if (!form.name.trim() || !form.phone.trim()) return "Enter at least the customer's name and phone.";
  if (hasVehicle(form) && !(parseInt(form.year, 10) && form.make.trim() && form.model.trim())) {
    return "To save the vehicle, also enter its year, make and model.";
  }
  return "";
}

// Create the record the first time; update it if this wizard already saved it.
async function saveRecord(entity, id, data) {
  if (id) {
    await entity.update(id, data);
    return id;
  }
  const record = await entity.create(data);
  return record.id;
}

// Saves the customer, then the vehicle when one was entered. Each id is reported
// as soon as the record exists, so a retry or a second pass updates, never duplicates.
export async function saveFirstCustomer(form, saved, onSaved) {
  const fullName = form.name.trim();
  const customerId = await saveRecord(base44.entities.Customer, saved.customerId, {
    full_name: fullName,
    phone: form.phone.trim(),
    email: form.email.trim(),
    address: form.address.trim(),
  });
  onSaved({ customerId });
  if (!hasVehicle(form)) return;
  const vehicleId = await saveRecord(base44.entities.Vehicle, saved.vehicleId, {
    customer_id: customerId,
    customer_name: fullName,
    year: parseInt(form.year, 10),
    make: form.make.trim(),
    model: form.model.trim(),
    color: form.color.trim(),
    license_plate: form.plate.trim(),
    vin: form.vin.trim(),
  });
  onSaved({ vehicleId });
}