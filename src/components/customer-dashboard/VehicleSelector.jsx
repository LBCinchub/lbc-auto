import React, { useRef } from "react";
import { Car, Check, ChevronLeft, ChevronRight, Gauge } from "lucide-react";
import { vehicleName, formatDate } from "./dashboardUtils";

export default function VehicleSelector({ vehicles, selectedId, onSelect }) {
  const rowRef = useRef(null);
  const move = (direction) => rowRef.current?.scrollBy({ left: direction * 340, behavior: "smooth" });
  const cards = [{ id: "all", all: true }, ...vehicles];
  return <section className="cd-section"><div className="cd-section-heading"><div><span>Your garage</span><h2>Choose a vehicle</h2></div><div className="cd-carousel-controls"><button onClick={() => move(-1)} aria-label="Previous vehicles"><ChevronLeft /></button><button onClick={() => move(1)} aria-label="Next vehicles"><ChevronRight /></button></div></div>
    <div className="cd-vehicle-row" ref={rowRef}>{cards.map((v) => {
      const active = selectedId === v.id;
      return <button key={v.id} className={`cd-vehicle-card ${active ? "active" : ""}`} onClick={() => onSelect(v.id)} aria-pressed={active}>
        <span className="cd-vehicle-icon"><Car size={22} /></span>{active && <span className="cd-selected"><Check size={13} /></span>}
        <strong>{v.all ? "All Vehicles" : vehicleName(v)}</strong>
        <span>{v.all ? `${vehicles.length} vehicles in your garage` : [v.engine_type, v.fuel_type].filter(Boolean).join(" · ") || "Vehicle details"}</span>
        {!v.all && <small>{v.mileage ? <><Gauge size={13} /> {Number(v.mileage).toLocaleString()} km</> : v.last_service_date ? `Last service ${formatDate(v.last_service_date)}` : "Service history available"}</small>}
      </button>;
    })}</div>
  </section>;
}