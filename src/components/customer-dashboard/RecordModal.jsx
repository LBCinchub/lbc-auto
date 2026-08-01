import React from "react";
import { X, Check, Ban, MessageSquare } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDate, formatMoney, formatStatus, maskVin, vehicleName } from "./dashboardUtils";

function DetailRows({ item }) {
  const r = item.record || item; const type = item.type || "vehicle";
  const rows = type === "vehicle" ? [["Vehicle", vehicleName(r)], ["VIN", maskVin(r.vin)], ["Mileage", r.mileage != null ? `${Number(r.mileage).toLocaleString()} km` : ""], ["Engine", r.engine_type], ["Fuel", r.fuel_type], ["Last service", formatDate(r.last_service_date)]] :
    [["Status", formatStatus(r.status || r.auth_status)], ["Date", formatDate(r.date || r.scan_timestamp || r.created_date)], ["Vehicle", r.vehicle_info], ["Description", r.description || r.service_reason || r.service_type || r.title || r.customer_note], ["Estimate", r.grand_total != null ? formatMoney(r.grand_total) : ""], ["Total", r.total != null ? formatMoney(r.total) : ""], ["Balance due", r.balance_due != null ? formatMoney(r.balance_due) : ""], ["Due", formatDate(r.due_date || r.valid_until || r.estimated_completion)], ["Diagnostic codes", r.dtc_codes?.length ? `${r.dtc_codes.length} recorded` : ""]];
  return <div className="cd-detail-list">{rows.filter(([,v]) => v).map(([k,v]) => <div key={k}><span>{k}</span><strong>{v}</strong></div>)}</div>;
}
export default function RecordModal({ item, onClose, onEstimateDecision, actionState, onMessage }) {
  if (!item) return null; const r = item.record || item; const isEstimate = item.type === "estimate" && !["approved","declined","invoiced","expired","cancelled"].includes(r.status);
  return <Dialog open onOpenChange={() => {}}><DialogContent className="cd-modal" onEscapeKeyDown={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()}>
    <DialogHeader><DialogTitle>{item.title || item.label || (item.type === "vehicle" ? "Vehicle details" : "Record details")}</DialogTitle><DialogDescription>Secure customer view</DialogDescription></DialogHeader><DetailRows item={item}/>{actionState?.error && <p className="cd-inline-error">{actionState.error}</p>}
    <div className="cd-financial-bar">{isEstimate && <><button disabled={actionState?.loading} onClick={() => onEstimateDecision(r, "decline")}><Ban />Decline</button><button className="primary" disabled={actionState?.loading} onClick={() => onEstimateDecision(r, "approve")}><Check />Approve Estimate</button></>}<button onClick={onMessage}><MessageSquare />Message Shop</button><button onClick={onClose}><X />Close</button></div>
  </DialogContent></Dialog>;
}