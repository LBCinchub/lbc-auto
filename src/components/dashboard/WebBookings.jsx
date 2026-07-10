import React from "react";
import { useNavigate } from "react-router-dom";
import { Globe, ChevronRight } from "lucide-react";

/**
 * Web Bookings tile — shows incoming web bookings from the connected
 * Haj Rims website. Displays the count of web bookings this month plus
 * the 3 most recent ones, along with a "Connected" indicator.
 *
 * Props:
 *   appointments — full appointment list for the shop (already scoped by user)
 */
export default function WebBookings({ appointments = [] }) {
  const navigate = useNavigate();

  // Only web_booking sourced appointments
  const webBookings = (appointments || []).filter(a => a.source === "web_booking");

  // This month's web bookings
  const now = new Date();
  const monthWebBookings = webBookings.filter(a => {
    if (!a.date) return false;
    const d = new Date(a.date + "T12:00:00");
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  // 3 most recent web bookings (newest first)
  const recentWebBookings = [...webBookings]
    .sort((a, b) => (b.created_date || b.date || "").localeCompare(a.created_date || a.date || ""))
    .slice(0, 3);

  return (
    <div className="rounded-xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-gray-900/50 p-6">
      {/* Connected indicator */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          <span className="text-emerald-400 text-xs font-bold tracking-wide">
            🌐 Connected: Haj Rims Website
          </span>
        </div>
        <button onClick={() => navigate("/Appointments")}
          className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors">
          View all →
        </button>
      </div>

      {/* Count this month */}
      <div className="flex items-center gap-3 mb-4">
        <div className="p-3 rounded-xl bg-emerald-500/20">
          <Globe className="w-7 h-7 text-emerald-400" />
        </div>
        <div>
          <p className="text-base text-gray-300 font-semibold">Web Bookings</p>
          <p className="text-4xl font-bold text-white leading-none mt-1">
            {monthWebBookings.length}
            <span className="text-sm font-normal text-gray-400 ml-2">this month</span>
          </p>
        </div>
      </div>

      {/* 3 most recent web bookings */}
      <div className="space-y-2">
        {recentWebBookings.length === 0 && (
          <p className="text-gray-500 text-sm text-center py-4">No web bookings yet</p>
        )}
        {recentWebBookings.map((appt) => {
          const apptDate = appt.date
            ? new Date(appt.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })
            : "—";
          return (
            <button key={appt.id}
              onClick={() => navigate("/Appointments")}
              className="w-full flex items-center justify-between p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20 hover:bg-emerald-500/10 transition-colors text-left gap-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm text-blue-400 font-medium truncate capitalize">{appt.customer_name || "—"}</p>
                  <span className="text-[9px] font-bold tracking-wide px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex-shrink-0">
                    🌐 WEB
                  </span>
                </div>
                <p className="text-sm text-gray-400 truncate capitalize mt-0.5">
                  {appt.service_type || "—"}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs text-gray-400">{apptDate}</span>
                <ChevronRight className="w-4 h-4 text-gray-600" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
