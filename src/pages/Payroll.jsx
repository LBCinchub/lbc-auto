import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, subMonths, isWithinInterval, parseISO } from "date-fns";
import { DollarSign, Clock, Users, Banknote, Plus, Trash2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedMechanic, setSelectedMechanic] = useState(null);
  const [paymentForm, setPaymentForm] = useState({ amount: "", payment_date: format(new Date(), "yyyy-MM-dd"), notes: "" });
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  const { data: mechanics = [] } = useQuery({
    queryKey: ["mechanics"],
    queryFn: () => base44.entities.Mechanic.list(),
  });

  const { data: timeEntries = [] } = useQuery({
    queryKey: ["timeEntries", "all"],
    queryFn: () => base44.entities.TimeEntry.list("-clock_in", 1000),
  });

  const { data: paymentRecords = [] } = useQuery({
    queryKey: ["paymentRecords"],
    queryFn: () => base44.entities.PaymentRecord.list("-payment_date", 500),
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

  const handleSavePayment = async () => {
    if (!selectedMechanic || !paymentForm.amount) return;
    setSaving(true);
    await base44.entities.PaymentRecord.create({
      mechanic_id: selectedMechanic.id,
      mechanic_name: selectedMechanic.name,
      amount: Number(paymentForm.amount),
      payment_date: paymentForm.payment_date,
      period: periodLabel,
      notes: paymentForm.notes,
    });
    setSaving(false);
    queryClient.invalidateQueries({ queryKey: ["paymentRecords"] });
    setPaymentDialogOpen(false);
    setPaymentForm({ amount: "", payment_date: format(new Date(), "yyyy-MM-dd"), notes: "" });
    setSelectedMechanic(null);
  };

  const handleDeletePayment = async (id) => {
    if (window.confirm("Delete this payment record?")) {
      await base44.entities.PaymentRecord.delete(id);
      queryClient.invalidateQueries({ queryKey: ["paymentRecords"] });
    }
  };

  const getMechanicPayments = (mechId) => {
    return paymentRecords.filter(p => p.mechanic_id === mechId);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
            <Banknote className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
          <h1 className="text-2xl font-bold text-gray-100">Payroll</h1>
          <p className="text-gray-400 text-sm mt-1">{periodLabel}</p>
          </div>
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
        <div className="px-5 py-4 bg-gray-900 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-200">Employee Breakdown</h2>
          <Button onClick={() => setPaymentDialogOpen(true)} className="gap-1.5 text-xs h-8">
            <Plus className="w-3.5 h-3.5" /> Record Payment
          </Button>
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
                <th className="px-5 py-3 text-right">Paid</th>
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
                  <td className="px-5 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-gray-400 text-xs">
                        ${getMechanicPayments(m.id).reduce((sum, p) => sum + p.amount, 0).toFixed(2)}
                      </span>
                      {m.totalHours > 0 && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 text-sky-400 hover:text-sky-300"
                          onClick={() => {
                            setSelectedMechanic(m);
                            setPaymentForm({ amount: "", payment_date: format(new Date(), "yyyy-MM-dd"), notes: "" });
                            setPaymentDialogOpen(true);
                          }}
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
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

        {/* Payment Records */}
        {paymentRecords.length > 0 && (
        <div className="rounded-xl border border-gray-800 overflow-hidden">
          <div className="px-5 py-4 bg-gray-900 border-b border-gray-800">
            <h2 className="text-sm font-semibold text-gray-200">Payment History</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-900/60 text-gray-500 text-xs uppercase">
                <tr>
                  <th className="px-5 py-3 text-left">Employee</th>
                  <th className="px-5 py-3 text-left">Period</th>
                  <th className="px-5 py-3 text-left">Date</th>
                  <th className="px-5 py-3 text-right">Amount</th>
                  <th className="px-5 py-3 text-left">Notes</th>
                  <th className="px-5 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {paymentRecords.map((p) => (
                  <tr key={p.id} className="bg-gray-950 hover:bg-gray-900 transition-colors">
                    <td className="px-5 py-4 text-gray-200">{p.mechanic_name}</td>
                    <td className="px-5 py-4 text-gray-400 text-xs">{p.period}</td>
                    <td className="px-5 py-4 text-gray-400">{format(parseISO(p.payment_date), "MMM d, yyyy")}</td>
                    <td className="px-5 py-4 text-right text-emerald-400 font-semibold">${p.amount.toFixed(2)}</td>
                    <td className="px-5 py-4 text-gray-400 text-xs">{p.notes || "—"}</td>
                    <td className="px-5 py-4 text-center">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 text-rose-400 hover:text-rose-300"
                        onClick={() => handleDeletePayment(p.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        )}

        {/* Payment Dialog */}
        <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-md">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-gray-400">Employee *</Label>
              {selectedMechanic ? (
                <div className="text-sm text-gray-200 mt-1 px-3 py-2 bg-gray-800 rounded border border-gray-700">
                  {selectedMechanic.name}
                </div>
              ) : (
                <Select
                  value={selectedMechanic?.id || ""}
                  onValueChange={(id) => setSelectedMechanic(mechanics.find(m => m.id === id) || null)}
                >
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white mt-1">
                    <SelectValue placeholder="Select an employee" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-900 border-gray-700 text-gray-200">
                    {mechanics.map(m => (
                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div>
              <Label className="text-gray-400">Amount ($) *</Label>
              <Input
                type="number"
                placeholder="0.00"
                value={paymentForm.amount}
                onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                className="bg-gray-800 border-gray-700 text-white mt-1"
              />
            </div>
            <div>
              <Label className="text-gray-400">Payment Date *</Label>
              <Input
                type="date"
                value={paymentForm.payment_date}
                onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })}
                className="bg-gray-800 border-gray-700 text-white mt-1"
              />
            </div>
            <div>
              <Label className="text-gray-400">Notes</Label>
              <Input
                placeholder="e.g., Weekly payment, including overtime"
                value={paymentForm.notes}
                onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                className="bg-gray-800 border-gray-700 text-white mt-1"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setPaymentDialogOpen(false)}
                className="flex-1 border-gray-700 text-gray-300"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSavePayment}
                disabled={saving || !selectedMechanic || !paymentForm.amount}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
              >
                {saving ? "Saving..." : "Record Payment"}
              </Button>
            </div>
          </div>
        </DialogContent>
        </Dialog>
        </div>
        );
        }