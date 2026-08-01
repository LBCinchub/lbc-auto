import React from "react";
import { Bell, LogOut, ShieldCheck } from "lucide-react";
import { vehicleName } from "./dashboardUtils";

export default function PortalHeader({ session, selectedVehicle, unreadCount, onNotifications, onLogout }) {
  return <header className="cd-header">
    <div className="cd-header-inner">
      <div className="cd-brand">
        {session.logo_url ? <img src={session.logo_url} alt="" /> : <span className="cd-logo">LBC</span>}
        <div><strong>{session.shop_name}</strong><span><ShieldCheck size={13} /> Secure customer portal</span></div>
      </div>
      <div className="cd-greeting"><span>Welcome back, {session.customer_name.split(" ")[0]}</span><strong>{vehicleName(selectedVehicle)}</strong></div>
      <div className="cd-header-actions">
        <button className="cd-icon-button" onClick={onNotifications} aria-label={`Notifications, ${unreadCount} unread`}><Bell size={21} />{unreadCount > 0 && <b>{unreadCount}</b>}</button>
        <button className="cd-logout" onClick={onLogout}><LogOut size={17} /> <span>Log Out</span></button>
      </div>
    </div>
  </header>;
}