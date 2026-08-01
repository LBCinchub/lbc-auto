import React from "react";
import { Activity, ChevronRight } from "lucide-react";
import { formatDate, formatStatus } from "./dashboardUtils";

export default function ActivityTimeline({ events, onOpen, onMessage }) {
  return <section className="cd-section cd-timeline-section"><div className="cd-section-heading"><div><span>Recent activity</span><h2>Service timeline</h2></div></div>
    {events.length ? <div className="cd-timeline">{events.map((event) => <button key={`${event.type}-${event.record.id}`} onClick={() => onOpen(event)} className="cd-timeline-item"><span className="cd-timeline-dot"><Activity /></span><div><small>{event.label} · {formatDate(event.date)}</small><strong>{event.title}</strong><p>{event.summary}</p></div><span className="cd-status">{formatStatus(event.status)}</span><ChevronRight className="cd-timeline-chevron" /></button>)}</div> : <div className="cd-empty"><Activity /><strong>No service activity yet</strong><p>New appointments and service updates appear here.</p><button onClick={onMessage}>Message the shop</button></div>}
  </section>;
}