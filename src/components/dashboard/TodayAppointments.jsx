import React from "react";
import { Link } from "react-router-dom";
import { Clock, User, ChevronRight } from "lucide-react";

export default function TodayAppointments({ appointments, onApptClick }) {
  const today = new Date().toISOString().split("T")[0];
  const todayAppts = appointments.filter(a => a.date === today);

  return (
    <div className="rounded-xl border border-gray-800/50 bg-gray-900/50 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-semibold">Today's Appointments</h3>
        <Link to="/Appointments" className="text-xs text-sky-400 hover:text-sky-300">
          View all →
        </Link>
      </div>
      <div className="space-y-3">
        {todayAppts.length === 0 && (
          <p className="text-gray-500 text-sm text-center py-8">No appointments today</p>
        )}
        {todayAppts.map((appt) => (
          <button
            key={appt.id}
            onClick={() => onApptClick && onApptClick(appt)}
            className="w-full flex items-center gap-3 p-3 rounded-lg bg-gray-800/30 hover:bg-gray-700/50 transition-colors text-left cursor-pointer"
          >
            <div className="w-10 h-10 rounded-lg bg-sky-500/20 flex items-center justify-center flex-shrink-0">
              <Clock className="w-4 h-4 text-sky-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-white font-medium truncate">{appt.customer_name}</p>
              <p className="text-xs text-gray-500">{appt.time_slot} · {appt.service_type}</p>
              {appt.vehicle_info && <p className="text-xs text-gray-600 truncate">{appt.vehicle_info}</p>}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {appt.mechanic_name && (
                <div className="flex items-center gap-1 text-xs text-gray-400">
                  <User className="w-3 h-3" />
                  {appt.mechanic_name}
                </div>
              )}
              <ChevronRight className="w-4 h-4 text-gray-600" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}