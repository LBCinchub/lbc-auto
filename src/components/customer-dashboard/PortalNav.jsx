import React from "react";
import { Car, FileText, Home, MessageSquare, Star, Tag } from "lucide-react";

const items = [{ id: "home", label: "Home", icon: Home }, { id: "cars", label: "My Cars", icon: Car }, { id: "billing", label: "Billing", icon: FileText }, { id: "messages", label: "Chat", icon: MessageSquare }, { id: "offers", label: "Offers", icon: Tag }, { id: "review", label: "Review", icon: Star }];
export default function PortalNav({ active, onChange, unread }) {
  return <><nav className="portal-desktop-nav" aria-label="Customer portal">{items.map(({ id, label, icon: Icon }) => <button key={id} className={active === id ? "active" : ""} onClick={() => onChange(id)}><Icon /><span>{label}</span>{id === "messages" && unread > 0 && <b>{unread}</b>}</button>)}</nav>
  <nav className="portal-mobile-nav" aria-label="Customer portal">{items.map(({ id, label, icon: Icon }) => <button key={id} className={active === id ? "active" : ""} onClick={() => onChange(id)}><Icon /><span>{label}</span>{id === "messages" && unread > 0 && <b>{unread}</b>}</button>)}</nav></>;
}