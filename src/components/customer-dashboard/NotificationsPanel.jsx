import React from "react";
import { Bell, CheckCheck, X } from "lucide-react";
import { timeAgo } from "./viewUtils";

export default function NotificationsPanel({ open, notifications, onClose, onOpen, onMarkRead, busy }) {
  if (!open) return null; const unread = notifications.filter((n) => !n.is_read);
  return <><button className="cd-notification-scrim" onClick={() => {}} aria-label="Notifications open"/><aside className="cd-notifications" aria-label="Notifications"><div className="cd-panel-head"><div><span>Updates</span><h2>Notifications</h2></div><button onClick={onClose} aria-label="Close notifications"><X /></button></div>
    {unread.length > 0 && <button className="cd-mark-read" disabled={busy} onClick={() => onMarkRead(unread.map((n) => n.id))}><CheckCheck />Mark all as read</button>}
    <div className="cd-notification-list">{notifications.length ? notifications.map((n) => <button key={n.id} className={n.is_read ? "read" : ""} onClick={() => onOpen(n)}><span className="cd-notification-icon"><Bell /></span><div><strong>{n.title}</strong>{n.body && <p>{n.body}</p>}<small>{timeAgo(n.sent_at)}</small></div>{!n.is_read && <i />}</button>) : <div className="cd-empty"><Bell/><strong>You’re all caught up</strong><p>Shop updates appear here.</p></div>}</div>
    <button className="cd-panel-close" onClick={onClose}>Close</button>
  </aside></>;
}