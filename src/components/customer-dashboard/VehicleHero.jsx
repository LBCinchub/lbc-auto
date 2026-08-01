import React from "react";
import { CalendarPlus, Car, History, MessageSquare, Gauge, CalendarClock } from "lucide-react";
import { formatDate, maskVin, vehicleName } from "./dashboardUtils";

export default function VehicleHero({ vehicle, vehicles, orders, appointments, recommendations, onAction }) {
  const latestOrder = orders[0]; const nextAppointment = appointments.filter((a) => !["completed", "cancelled"].includes(a.status)).sort((a,b) => String(a.date).localeCompare(String(b.date)))[0];
  const nextRecommendation = recommendations.find((r) => !r.is_resolved);
  return <section className="cd-hero">
    <div className="cd-hero-copy"><span className="cd-eyebrow">{vehicle ? "Selected vehicle" : "Your garage overview"}</span><h1>{vehicle ? vehicleName(vehicle) : `${vehicles.length} Vehicles, One Simple View`}</h1>
      <p>{vehicle ? [vehicle.trim, maskVin(vehicle.vin)].filter(Boolean).join(" · ") || "Your service history and documents in one place." : "Track service, appointments, estimates, and invoices across your garage."}</p>
      <div className="cd-hero-stats">{vehicle?.mileage != null && <span><Gauge /> <b>{Number(vehicle.mileage).toLocaleString()} km</b><small>Current mileage</small></span>}{vehicle?.last_service_date && <span><History /><b>{formatDate(vehicle.last_service_date)}</b><small>Latest service</small></span>}{latestOrder && <span><Car /><b>{String(latestOrder.status || "Pending").replaceAll("_", " ")}</b><small>Service status</small></span>}{(nextAppointment || nextRecommendation) && <span><CalendarClock /><b>{nextAppointment ? formatDate(nextAppointment.date) : nextRecommendation.title}</b><small>{nextAppointment ? "Next appointment" : "Next recommendation"}</small></span>}</div>
    </div>
    <div className="cd-quick-actions"><button onClick={() => onAction("details")}><Car />View Vehicle Details</button><button onClick={() => onAction("history")}><History />Service History</button><button onClick={() => onAction("message")}><MessageSquare />Message Shop</button><button className="primary" onClick={() => onAction("book")} disabled={!vehicle}><CalendarPlus />Book Appointment</button></div>
  </section>;
}