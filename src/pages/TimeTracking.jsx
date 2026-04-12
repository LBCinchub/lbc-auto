import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Clock, LogIn, LogOut, Timer, CalendarDays } from "lucide-react";
import { format, differenceInMinutes, parseISO } from "date-fns";

export default function TimeTracking() {
  const queryClient = useQueryClient();
  const [loadingId, setLoadingId] = useState(null);
  const [, setTick] = useState(0);

  // Re-render every 30 seconds so live durations update
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  const { data: mechanics = [] } = useQuery({
    queryKey: ["mechanics"],
    queryFn: () => base44.entities.Mechanic.list(),
  });

  const today = format(new Date(), "yyyy-MM-dd");

  const { data: todayEntries = [] } = useQuery({
    queryKey: ["timeEntries", today],
    queryFn: () => base44.entities.TimeEntry.filter({ date: today }),
    refetchInterval: 30000,
  });

  const { data: allEntries = [] } = useQuery({
    queryKey: ["timeEntries", "all"],
    queryFn: () => base44.entities.TimeEntry.list("-clock_in", 100),
  });

  const getActiveEntry = (mechanicId) =>
    todayEntries.find((e) => e.mechanic_id === mechanicId && !e.clock_out);

  const handleClockIn = async (mechanic) => {
    setLoadingId(mechanic.id);
    const now = new Date().toISOString();
    await base44.entities.TimeEntry.create({
      mechanic_id: mechanic.id,
      mechanic_name: mechanic.name,
      clock_in: now,
      date: today,
    });
    await base44.entities.Mechanic.update(mechanic.id, { status: "available" });
    queryClient.invalidateQueries({ queryKey: ["timeEntries"] });
    queryClient.invalidateQueries({ queryKey: ["mechanics"] });
    setLoadingId(null);
  };

  const handleClockOut = async (mechanic) => {
    const entry = getActiveEntry(mechanic.id);
    if (!entry) return;
    setLoadingId(mechanic.id);
    const now = new Date();
    const duration = differenceInMinutes(now, new Date(entry.clock_in));
    await base44.entities.TimeEntry.update(entry.id, {
      clock_out: now.toISOString(),
      duration_minutes: duration,
    });
    await base44.entities.Mechanic.update(mechanic.id, { status: "off_duty" });
    queryClient.invalidateQueries({ queryKey: ["timeEntries"] });
    queryClient.invalidateQueries({ queryKey: ["mechanics"] });
    setLoadingId(null);
  };

  const formatDuration = (minutes) => {
    if (!minutes) return "—";
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const formatTime = (iso) => (iso ? format(parseISO(iso), "h:mm a") : "—");

  const recentEntries = allEntries.filter((e) => e.clock_out).slice(0, 30);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-100">Time Tracking</h1>
        <p className="text-gray-400 text-sm mt-1">
          {format(new Date(), "EEEE, MMMM d, yyyy")}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {mechanics.map((mechanic) => {
          const activeEntry = getActiveEntry(mechanic.id);
          const isClockedIn = !!activeEntry;
          const isLoading = loadingId === mechanic.id;

          return (
            <div
              key={mechanic.id}
              className={`rounded-xl border p-5 flex flex-col gap-4 transition-all ${
                isClockedIn
                  ? "bg-green-950/30 border-green-700/40"
                  : "bg-gray-900 border-gray-800"
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-gray-100 font-semibold">{mechanic.name}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">{mechanic.specialty || "General"}</p>
                </div>
                <span
                  className={`text-xs font-medium px-2 py-1 rounded-full ${
                    isClockedIn
                      ? "bg-green-500/20 text-green-400"
                      : "bg-gray-800 text-gray-500"
                  }`}
                >
                  {isClockedIn ? "● Working" : "○ Off"}
                </span>
              </div>

              {isClockedIn && activeEntry && (
                <div className="flex items-center gap-2 text-sm text-green-400">
                  <Timer className="w-4 h-4" />
                  <span>Clocked in at {formatTime(activeEntry.clock_in)}</span>
                </div>
              )}

              <Button
                onClick={() =>
                  isClockedIn ? handleClockOut(mechanic) : handleClockIn(mechanic)
                }
                disabled={isLoading}
                className={
                  isClockedIn
                    ? "bg-red-600 hover:bg-red-700 text-white"
                    : "bg-sky-600 hover:bg-sky-700 text-white"
                }
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : isClockedIn ? (
                  <>
                    <LogOut className="w-4 h-4" /> Clock Out
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" /> Clock In
                  </>
                )}
              </Button>
            </div>
          );
        })}
      </div>

      <div>
        <h2 className="text-lg font-semibold text-gray-200 mb-3 flex items-center gap-2">
          <Clock className="w-5 h-5 text-sky-400" /> Today's Log
        </h2>
        {todayEntries.length === 0 ? (
          <p className="text-gray-500 text-sm">No entries yet today.</p>
        ) : (
          <div className="rounded-xl border border-gray-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-900 text-gray-400 text-xs uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Employee</th>
                  <th className="px-4 py-3 text-left">Clock In</th>
                  <th className="px-4 py-3 text-left">Clock Out</th>
                  <th className="px-4 py-3 text-left">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {todayEntries.map((entry) => (
                  <tr key={entry.id} className="bg-gray-950 hover:bg-gray-900 transition-colors">
                    <td className="px-4 py-3 text-gray-200 font-medium">{entry.mechanic_name}</td>
                    <td className="px-4 py-3 text-gray-400">{formatTime(entry.clock_in)}</td>
                    <td className="px-4 py-3 text-gray-400">
                      {entry.clock_out ? formatTime(entry.clock_out) : <span className="text-green-400">Active</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-400">
                      {entry.clock_out
                        ? formatDuration(entry.duration_minutes)
                        : formatDuration(differenceInMinutes(new Date(), parseISO(entry.clock_in)))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <h2 className="text-lg font-semibold text-gray-200 mb-3 flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-sky-400" /> Recent History
        </h2>
        {recentEntries.length === 0 ? (
          <p className="text-gray-500 text-sm">No history yet.</p>
        ) : (
          <div className="rounded-xl border border-gray-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-900 text-gray-400 text-xs uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Employee</th>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Clock In</th>
                  <th className="px-4 py-3 text-left">Clock Out</th>
                  <th className="px-4 py-3 text-left">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {recentEntries.map((entry) => (
                  <tr key={entry.id} className="bg-gray-950 hover:bg-gray-900 transition-colors">
                    <td className="px-4 py-3 text-gray-200 font-medium">{entry.mechanic_name}</td>
                    <td className="px-4 py-3 text-gray-400">{entry.date}</td>
                    <td className="px-4 py-3 text-gray-400">{formatTime(entry.clock_in)}</td>
                    <td className="px-4 py-3 text-gray-400">{formatTime(entry.clock_out)}</td>
                    <td className="px-4 py-3 text-gray-400">{formatDuration(entry.duration_minutes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}