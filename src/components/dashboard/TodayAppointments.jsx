import React from "react";
import { useNavigate } from "react-router-dom";
import { Calendar, Clock, ChevronRight, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatPhone } from "@/utils/formatPhone";

const apptStatusConfig = {
  scheduled:  { label: "Scheduled",  cls: "bg-sky-500/20 text-sky-400 border-sky-500/30" },
  confirmed:  { label: "Confirmed",  cls: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  completed:  { label: "Completed",  cls: "bg-gray-500/20 text-gray-400 border-gray-500/30" },
  cancelled:  { label: "Cancelled",  cls: "bg-rose-500/20 text-rose-400 border-rose-500/30" },
  no_show:    { label: "No Show",    cls: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
};

export default function TodayAppointments({ appointments = [], customers = [], onApptClick }) {
  const navigate = useNavigate();
  const today = new Date().toISOString().split("T")[0];

  // Show today first, then upcoming — max 15
  const todayAppts  = appointments.filter(a => a.date === today)
    .sort((a, b) => (a.time_slot || "").localeCompare(b.time_slot || ""));
  const upcomingAppts = appointments
    .filter(a => a.date > today && a.status !== "cancelled")
    .sort((a, b) => a.date.localeCompare(b.date) || (a.time_slot || "").localeCompare(b.time_slot || ""))
    .slice(0, Math.max(0, 15 - todayAppts.length));

  const allAppts = [...todayAppts, ...upcomingAppts];

  return (
    <div className="rounded-xl border border-gray-800/50 bg-gray-900/50 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-white font-bold text-lg">Appointments</h3>
          {todayAppts.length > 0 && (
            <span className="text-sm font-bold bg-purple-500/20 text-purple-400 border border-purple-500/30 px-2 py-0.5 rounded-full">
              {todayAppts.length} today
            </span>
          )}
        </div>
        <button onClick={() => navigate("/Appointments")}
          className="text-sm text-sky-400 hover:text-sky-300 transition-colors">
          View all →
        </button>
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
        {allAppts.length === 0 && (
          <p className="text-gray-500 text-sm text-center py-8">No upcoming appointments</p>
        )}

        {/* Today divider */}
        {todayAppts.length > 0 && (
          <p className="text-sm font-semibold text-purple-400 uppercase tracking-wider px-1 pb-1">Today</p>
        )}

        {todayAppts.map((appt) => {
          const cfg = apptStatusConfig[appt.status] || apptStatusConfig.scheduled;
          const customer = customers.find(c => c.id === appt.customer_id);
          return (
            <button key={appt.id}
              onClick={() => onApptClick ? onApptClick(appt) : navigate("/Appointments")}
              className="w-full flex items-center justify-between p-3 rounded-lg bg-purple-500/5 border border-purple-500/20 hover:bg-purple-500/10 transition-colors text-left gap-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-base text-blue-400 font-medium truncate capitalize">{appt.customer_name || "—"}</p>
                  <span className="text-sm text-purple-400 font-mono flex-shrink-0 flex items-center gap-1">
                    <Clock className="w-3 h-3" />{appt.time_slot || "—"}
                  </span>
                </div>
                {customer?.phone && (
                  <p className="text-sm text-amber-400">{formatPhone(customer.phone)}</p>
                )}
                <p className="text-sm text-green-400 truncate capitalize mt-0.5">{appt.vehicle_info || "—"}</p>
                {appt.service_type && (
                  <p className="text-sm text-gray-500 truncate">{appt.service_type}</p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Badge variant="outline" className={cn("text-xs", cfg.cls)}>{cfg.label}</Badge>
                <ChevronRight className="w-5 h-5 text-gray-600" />
              </div>
            </button>
          );
        })}

        {/* Upcoming divider */}
        {upcomingAppts.length > 0 && (
          <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider px-1 pt-2 pb-1">Upcoming</p>
        )}

        {upcomingAppts.map((appt) => {
          const cfg = apptStatusConfig[appt.status] || apptStatusConfig.scheduled;
          const customer = customers.find(c => c.id === appt.customer_id);
          const apptDate = new Date(appt.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
          return (
            <button key={appt.id}
              onClick={() => onApptClick ? onApptClick(appt) : navigate("/Appointments")}
              className="w-full flex items-center justify-between p-4 rounded-lg bg-gray-800/30 hover:bg-gray-700/50 transition-colors text-left gap-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-base text-blue-400 font-medium truncate capitalize">{appt.customer_name || "—"}</p>
                  <span className="text-sm text-gray-400 flex-shrink-0 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />{apptDate}
                  </span>
                </div>
                {customer?.phone && (
                  <p className="text-sm text-amber-400">{formatPhone(customer.phone)}</p>
                )}
                <p className="text-sm text-green-400 truncate capitalize mt-0.5">{appt.vehicle_info || "—"}</p>
                {appt.service_type && (
                  <p className="text-sm text-gray-500 truncate">{appt.service_type}</p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Badge variant="outline" className={cn("text-xs", cfg.cls)}>{cfg.label}</Badge>
                <ChevronRight className="w-5 h-5 text-gray-600" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
