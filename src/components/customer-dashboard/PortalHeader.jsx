import React from "react";
import { Bell, LogOut, ShieldCheck } from "lucide-react";
import { vehicleName } from "@/components/customer-dashboard/portalUtils";

export default function PortalHeader({ session, vehicle, unread, onNotifications, onLogout, loggingOut }) {
  return <header className="portal-header">
    <div className="portal-header-inner">
      <div className="flex min-w-0 items-center gap-3">
        {session.logo_url ? <img src={session.logo_url} alt="" className="h-11 w-11 rounded-xl object-cover" /> : <div className="portal-logo"><ShieldCheck /></div>}
        <div className="min-w-0"><p className="truncate text-sm font-semibold text-portal-accent">{session.shop_name}</p><h1 className="truncate text-xl font-bold text-portal-text">Welcome, {session.customer_name?.split(" ")[0]}</h1><p className="truncate text-xs text-portal-muted md:hidden">{vehicleName(vehicle)}</p></div>
      </div>
      <div className="hidden min-w-0 flex-1 px-8 md:block"><p className="text-xs font-semibold uppercase tracking-wider text-portal-muted">Selected vehicle</p><p className="truncate font-semibold text-portal-text">{vehicleName(vehicle)}</p></div>
      <div className="flex items-center gap-2">
        <button className="portal-icon-button relative" onClick={onNotifications} aria-label={`Notifications, ${unread} unread`}><Bell />{unread > 0 && <span className="portal-badge">{unread}</span>}</button>
        <button className="portal-secondary-button" onClick={onLogout} disabled={loggingOut}><LogOut /><span className="hidden sm:inline">{loggingOut ? "Logging out…" : "Log Out"}</span></button>
      </div>
    </div>
  </header>;
}