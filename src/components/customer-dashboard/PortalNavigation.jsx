import React from "react";
import { Home, Car, ReceiptText, MessageSquare, Tag, Star } from "lucide-react";

export const NAV_ITEMS = [
  ["home", "Home", Home], ["cars", "My Cars", Car], ["billing", "Billing", ReceiptText],
  ["messages", "Chat", MessageSquare], ["offers", "Offers", Tag], ["review", "Review", Star],
];
function NavButtons({ active, onChange, unread }) {
  return NAV_ITEMS.map(([id, label, Icon]) => <button key={id} className={active === id ? "active" : ""} onClick={() => onChange(id)} aria-current={active === id ? "page" : undefined}>
    <Icon size={19} /><span>{label}</span>{id === "messages" && unread > 0 && <b>{unread}</b>}
  </button>);
}
export function DesktopNav(props) { return <nav className="cd-desktop-nav" aria-label="Customer portal"><NavButtons {...props} /></nav>; }
export function MobileNav(props) { return <nav className="cd-mobile-nav" aria-label="Customer portal"><NavButtons {...props} /></nav>; }