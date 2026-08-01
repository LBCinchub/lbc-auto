import React from "react";
import { Activity, ChevronRight } from "lucide-react";
import StatusChip from "@/components/customer-dashboard/StatusChip";
import { buildTimeline, formatDate, RECORD_CONFIG } from "@/components/customer-dashboard/portalUtils";

export default function ActivityTimeline({ data, onOpen, onBook }) {
  const events = buildTimeline(data);
  return <section className="portal-panel"><div className="portal-section-heading"><div><p className="portal-eyebrow">Recent activity</p><h2>Service timeline</h2></div><Activity className="text-portal-accent" /></div>{events.length ? <div className="portal-timeline">{events.map((event) => <button key={`${event.type}-${event.record.id}`} onClick={() => onOpen(event.type, event.record)}><span className="portal-timeline-dot" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3>{event.title}</h3><StatusChip status={event.record.status || event.record.urgency || RECORD_CONFIG[event.type].label} /></div><p>{event.summary}</p><small>{formatDate(event.date)} · {RECORD_CONFIG[event.type].label}</small></div><ChevronRight /></button>)}</div> : <div className="portal-empty"><Activity /><h3>Your service timeline starts here</h3><p>No activity is recorded for this vehicle yet.</p><button className="portal-primary-button" onClick={onBook}>Book an appointment</button></div>}</section>;
}