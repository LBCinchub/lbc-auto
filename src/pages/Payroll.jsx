import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, subMonths, isWithinInterval, parseISO } from "date-fns";
import { DollarSign, Clock, Users, ChevronDown } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const PAY_PERIODS = [
  { label: "This Week", value: "this_week" },
  { label: "Last Week", value: "last_week" },
  { label: "This Month", value: "this_month" },
  { label: "Last Month", value: "last_month" },
];

function getPeriodRange(period) {
  const now = new Date();
  switch (period) {
    case "this_week":
      return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
    case "last_week": {
      const lw = subWeeks(now, 1);
      return { start: startOfWeek(lw, { weekStartsOn: 1 }), end: endOfWeek(lw, { weekStartsOn: 1 }) };
    }
    case "this_month":
      return { start: startOfMonth(now), end: endOfMonth(now) };
    case "last_month": {
      const lm = subMonths(now, 1);
      return { start: startOfMonth(lm), end: endOfMonth(lm) };
    }
    default:
      return { start: startOfMonth(now), end: endOfMonth(now) };
  }
}

export default function Payroll() {
  const [period, setPeriod] = useState("this_month");

  const { data: mechanics = [] } = useQuery({
    queryKey: ["mechanics"],
    queryFn: () => base44.entities.Mechanic.list(),
  });

  const { data: timeEntries = [] } = useQuery({
    queryKey: ["timeEntries", "all"],
    queryFn: () => base44.entities.TimeEntry.list("-clock_in", 1000),
  });

  const { start, end } = getPeriodRange(period);
  const periodLabel = `${format(start, "MMM d")} – ${format(end, "MMM d, yyyy")}`;

  const payrollData = useMemo(() => {
    const filtered = timeEntries.filter((e) => {
      if (!e.clock_in || !e.duration_minutes) return false;
      try {
        return isWithinInterval(parseISO(e.clock_in), { start, end });
      } catch {
        return false;
      }
    });

    return mechanics.map((mech) => {
      const entries = filtered.filter((e) => e.mechanic_id === mech.id);
      const totalMinutes = entries.reduce((sum, e) => sum + (e.duration_minutes || 0), 0);
      const totalHours = totalMinutes / 60;
      const grossPay = totalHours * (mech.hourly_rate || 0);
      const sessions = entries.length;
      const days = [...new Set(entries.map((e) => e.date))].length;
      return {
        id: mech.id,
        name: mech.name,
        specialty: mech.specialty,
        hourlyRate: mech.hourly_rate || 0,
        sessions,
        days,
        totalMinutes,
        totalHours: parseFloat(totalHours.toFixed(2)),
        grossPay: parseFloat(grossPay.toFixed(2)),
        entries,
      };
    }).sort((a, b) => b.grossPay - a.grossPay);
  }, [mechanics, timeEntries, start, end]);

  const totals = useMemo(() => ({
    hours: payrollData.reduce((s, m) => s + m.totalHours, 0),
    pay: payrollData.reduce((s, m) => s + m.grossPay, 0),
    active: payrollData.filter((m) => m.totalHours > 0).length,
  }), [payrollData]);

  const formatDuration = (minutes) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Payroll</h1>
          <p className="text-gray-400 text-sm mt-1">{periodLabel}</p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-44 bg-gray-900 border-gray-700 text-gray-200">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-gray-900 border-gray-700 text-gray-200">
            {PAY_PERIODS.map((p) => (
              <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-sky-700/30 bg-sky-950/20 p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-full bg-sky-500/20 flex items-center justify-center">
            <Clock className="w-5 h-5 text-sky-400" />
          </div>
          <div>
            <p className="text-xs text-gray-400">Total Hours</p>
            <p className="text-2xl font-bold text-gray-100">{totals.hours.toFixed(1)}<span className="text-sm font-normal text-gray-400 ml-1">hrs</span></p>
          </div>
        </div>
        <div className="rounded-xl border border-emerald-700/30 bg-emerald-950/20 p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-full bg-emerald-500/20 flex items-center justify-center">
            <DollarSign className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <p className="text-xs text-gray-400">Total Labor Cost</p>
            <p className="text-2xl font-bold text-emerald-400">${totals.pay.toFixed(2)}</p>
          </div>
        </div>
        <div className="rounded-xl border border-purple-700/30 bg-purple-950/20 p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-full bg-purple-500/20 flex items-center justify-center">
            <Users className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <p className="text-xs text-gray-400">Active Employees</p>
            <p className="text-2xl font-bold text-gray-100">{totals.active}<span className="text-sm font-normal text-gray-400 ml-1">/ {mechanics.length}</span></p>
          </div>
        </div>
      </div>

      {/* Payroll table */}
      <div className="rounded-xl border border-gray-800 overflow-hidden">
        <div className="px-5 py-4 bg-gray-900 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-gray-200">Employee Breakdown</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-900/60 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-5 py-3 text-left">Employee</th>
                <th className="px-5 py-3 text-right">Rate / hr</th>
                <th className="px-5 py-3 text-right">Sessions</th>
                <th className="px-5 py-3 text-right">Days</th>
                <th className="px-5 py-3 text-right">Time Worked</th>
                <th className="px-5 py-3 text-right">Gross Pay</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {payrollData.map((m) => (
                <tr key={m.id} className={`bg-gray-950 hover:bg-gray-900 transition-colors ${m.totalHours === 0 ? "opacity-40" : ""}`}>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-sky-500/20 flex items-center justify-center text-sky-400 font-bold text-xs">
                        {m.name?.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-gray-200 font-medium">{m.name}</p>
                        {m.specialty && <p className="text-xs text-gray-500">{m.specialty}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-right text-gray-400">${m.hourlyRate.toFixed(2)}</td>
                  <td className="px-5 py-4 text-right text-gray-400">{m.sessions}</td>
                  <td className="px-5 py-4 text-right text-gray-400">{m.days}</td>
                  <td className="px-5 py-4 text-right text-sky-400 font-medium">
                    {m.totalMinutes > 0 ? formatDuration(m.totalMinutes) : "—"}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <span className={`font-semibold ${m.grossPay > 0 ? "text-emerald-400" : "text-gray-600"}`}>
                      ${m.grossPay.toFixed(2)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-gray-700 bg-gray-900">
              <tr>
                <td colSpan={4} className="px-5 py-3 text-xs text-gray-400 font-semibold uppercase tracking-wider">Total</td>
                <td className="px-5 py-3 text-right text-sky-400 font-bold">{formatDuration(Math.round(totals.hours * 60))}</td>
                <td className="px-5 py-3 text-right text-emerald-400 font-bold">${totals.pay.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}