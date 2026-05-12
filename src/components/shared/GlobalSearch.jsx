import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { Search, X, Wrench, Users, Car, FileText, Package, ChevronRight, ClipboardList, CalendarDays } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";

function highlight(text, query) {
  if (!text || !query) return text;
  const str = String(text);
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return str;

  // Build a regex that matches any of the tokens
  const pattern = new RegExp(`(${tokens.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  const parts = str.split(pattern);

  return (
    <>
      {parts.map((part, i) =>
        tokens.some(t => part.toLowerCase() === t.toLowerCase())
          ? <mark key={i} className="bg-sky-500/30 text-sky-300 rounded px-0.5">{part}</mark>
          : part
      )}
    </>
  );
}

function scoreMatch(haystack, tokens) {
  const h = haystack.toLowerCase();
  let score = 0;
  for (const t of tokens) {
    if (h.startsWith(t)) score += 3;
    else if (h.includes(t)) score += 1;
    else return -1; // required token missing
  }
  return score;
}

export default function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState(null);
  const ref = useRef(null);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    base44.auth.me().then(setUser);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Keyboard shortcut: Ctrl+K / Cmd+K
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const enabled = !!user && query.trim().length >= 1;

  const { data: orders = [] } = useQuery({
    queryKey: ["repairOrders", user?.email],
    queryFn: () => base44.entities.RepairOrder.filter({ created_by: user.email }, "-created_date", 200),
    enabled: !!user,
  });
  const { data: customers = [] } = useQuery({
    queryKey: ["customers", user?.email],
    queryFn: () => base44.entities.Customer.filter({ created_by: user.email }, "-created_date", 200),
    enabled: !!user,
  });
  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles", user?.email],
    queryFn: () => base44.entities.Vehicle.filter({ created_by: user.email }, "-created_date", 200),
    enabled: !!user,
  });
  const { data: invoices = [] } = useQuery({
    queryKey: ["invoices", user?.email],
    queryFn: () => base44.entities.Invoice.filter({ created_by: user.email }, "-created_date", 200),
    enabled: !!user,
  });
  const { data: parts = [] } = useQuery({
    queryKey: ["parts"],
    queryFn: () => base44.entities.Part.list("-created_date", 200),
    enabled: !!user,
  });
  const { data: estimates = [] } = useQuery({
    queryKey: ["estimates", user?.email],
    queryFn: () => base44.entities.Estimate.filter({ created_by: user.email }, "-created_date", 200),
    enabled: !!user,
  });
  const { data: appointments = [] } = useQuery({
    queryKey: ["appointments", user?.email],
    queryFn: () => base44.entities.Appointment.filter({ created_by: user.email }, "-created_date", 200),
    enabled: !!user,
  });

  const results = useMemo(() => {
    if (!enabled) return [];
    const q = query.trim();
    const tokens = q.toLowerCase().split(/\s+/);
    const all = [];

    // Orders
    orders.forEach(o => {
      const h = [o.order_number, o.customer_name, o.vehicle_info, o.description, o.mechanic_name].filter(Boolean).join(" ");
      const score = scoreMatch(h, tokens);
      if (score >= 0) all.push({ type: "order", score, item: o });
    });

    // Customers
    customers.forEach(c => {
      const h = [c.full_name, c.phone, c.email, c.address].filter(Boolean).join(" ");
      const score = scoreMatch(h, tokens);
      if (score >= 0) all.push({ type: "customer", score, item: c });
    });

    // Vehicles
    vehicles.forEach(v => {
      const h = [v.year, v.make, v.model, v.vin, v.license_plate, v.customer_name].filter(Boolean).join(" ");
      const score = scoreMatch(h, tokens);
      if (score >= 0) all.push({ type: "vehicle", score, item: v });
    });

    // Invoices
    invoices.forEach(i => {
      const h = [i.invoice_number, i.customer_name, i.vehicle_info].filter(Boolean).join(" ");
      const score = scoreMatch(h, tokens);
      if (score >= 0) all.push({ type: "invoice", score, item: i });
    });

    // Parts
    parts.forEach(p => {
      const h = [p.name, p.part_number, p.supplier, p.category].filter(Boolean).join(" ");
      const score = scoreMatch(h, tokens);
      if (score >= 0) all.push({ type: "part", score, item: p });
    });

    // Estimates
    estimates.forEach(e => {
      const h = [e.estimate_number, e.customer_name, e.vehicle_info, e.status].filter(Boolean).join(" ");
      const score = scoreMatch(h, tokens);
      if (score >= 0) all.push({ type: "estimate", score, item: e });
    });

    // Appointments
    appointments.forEach(a => {
      const h = [a.customer_name, a.vehicle_info, a.service_type, a.date, a.notes, a.time_slot].filter(Boolean).join(" ");
      const score = scoreMatch(h, tokens);
      if (score >= 0) all.push({ type: "appointment", score, item: a });
    });

    return all.sort((a, b) => b.score - a.score).slice(0, 20);
  }, [query, orders, customers, vehicles, invoices, parts, estimates, appointments, enabled]);

  const typeConfig = {
    order:       { icon: Wrench,        label: "Repair Order", color: "text-sky-400",    bg: "bg-sky-500/10",    nav: (item) => navigate(`/RepairOrderDetail/${item.id}`) },
    customer:    { icon: Users,         label: "Customer",     color: "text-emerald-400", bg: "bg-emerald-500/10", nav: (item) => navigate(`/CustomerDetails?id=${item.id}`) },
    vehicle:     { icon: Car,           label: "Vehicle",      color: "text-amber-400",  bg: "bg-amber-500/10",  nav: (item) => navigate(`/Vehicles?vehicleId=${item.id}`) },
    invoice:     { icon: FileText,      label: "Invoice",      color: "text-purple-400", bg: "bg-purple-500/10", nav: (item) => navigate(`/InvoiceDetail/${item.id}`) },
    part:        { icon: Package,       label: "Part",         color: "text-rose-400",   bg: "bg-rose-500/10",   nav: () => navigate(`/Parts`) },
    estimate:    { icon: ClipboardList, label: "Estimate",     color: "text-violet-400", bg: "bg-violet-500/10", nav: (item) => navigate(`/EstimateDetail/${item.id}`) },
    appointment: { icon: CalendarDays,  label: "Appointment",  color: "text-orange-400", bg: "bg-orange-500/10", nav: (item) => navigate(`/Appointments?appointmentId=${item.id}`) },
  };

  const handleSelect = (result) => {
    setQuery("");
    setOpen(false);
    typeConfig[result.type].nav(result.item);
  };

  const getTitle = (result) => {
    const { type, item } = result;
    if (type === "order") return `#${item.order_number} — ${item.customer_name}`;
    if (type === "customer") return item.full_name;
    if (type === "vehicle") return `${item.year} ${item.make} ${item.model}`;
    if (type === "invoice") return `${item.invoice_number} — ${item.customer_name}`;
    if (type === "part") return item.name;
    if (type === "estimate") return `${item.estimate_number} — ${item.customer_name}`;
    if (type === "appointment") return `${item.customer_name} — ${item.service_type}`;
    return "";
  };

  const getSubtitle = (result) => {
    const { type, item } = result;
    if (type === "order") return item.vehicle_info || item.status;
    if (type === "customer") return [item.phone, item.email].filter(Boolean).join(" · ");
    if (type === "vehicle") return [item.vin && `VIN: ${item.vin}`, item.license_plate].filter(Boolean).join(" · ");
    if (type === "invoice") return `$${(item.total || 0).toFixed(2)} · ${item.status}`;
    if (type === "part") return [item.part_number && `#${item.part_number}`, item.supplier].filter(Boolean).join(" · ");
    if (type === "estimate") return `$${(item.grand_total || 0).toFixed(2)} · ${item.status}`;
    if (type === "appointment") return `${item.date} ${item.time_slot} · ${item.status}`;
    return "";
  };

  const inputContainerRef = useRef(null);
  const [dropdownStyle, setDropdownStyle] = useState({});

  useEffect(() => {
    if (open && inputContainerRef.current) {
      const rect = inputContainerRef.current.getBoundingClientRect();
      setDropdownStyle({
        position: 'fixed',
        top: rect.bottom + 6,
        left: rect.left,
        width: Math.max(rect.width * 2, 500),
        zIndex: 9999,
      });
    }
  }, [open, query]);

  return (
    <div ref={ref} className="relative w-full">
      <div className="relative" ref={inputContainerRef}>
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Search everything... (⌘K)"
          className="w-full pl-10 pr-8 py-2 bg-gray-800/60 border border-gray-700/60 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-sky-500/70 focus:border-sky-500/50 transition-all"
        />
        {query && (
          <button onClick={() => { setQuery(""); setOpen(false); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {open && query.trim().length >= 1 && (
        <div style={dropdownStyle} className="bg-gray-900 border border-gray-700/80 rounded-xl shadow-2xl shadow-black/50 overflow-hidden">
          {results.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-gray-500">
              No results for <span className="text-gray-300">"{query}"</span>
            </div>
          ) : (
            <div className="py-1.5 max-h-[480px] overflow-y-auto">
              {(() => {
                const groupOrder = ["customer", "vehicle", "order", "invoice", "estimate", "appointment", "part"];
                const groupLabels = {
                  customer: "Customers", vehicle: "Vehicles", order: "Repair Orders",
                  invoice: "Invoices", estimate: "Estimates", appointment: "Appointments", part: "Parts"
                };
                const grouped = {};
                results.forEach(r => {
                  if (!grouped[r.type]) grouped[r.type] = [];
                  grouped[r.type].push(r);
                });
                return groupOrder.filter(t => grouped[t]).map(type => (
                  <div key={type}>
                    <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-gray-600 bg-gray-900/80 sticky top-0">
                      {groupLabels[type]} <span className="text-gray-700">({grouped[type].length})</span>
                    </div>
                    {grouped[type].map((result) => {
                      const cfg = typeConfig[result.type];
                      const Icon = cfg.icon;
                      const title = getTitle(result);
                      const subtitle = getSubtitle(result);
                      return (
                        <button
                          key={`${result.type}-${result.item.id}`}
                          onClick={() => handleSelect(result)}
                          className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-800/70 transition-colors text-left group"
                        >
                          <div className={`w-8 h-8 rounded-lg ${cfg.bg} flex items-center justify-center flex-shrink-0`}>
                            <Icon className={`w-4 h-4 ${cfg.color}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-white font-medium truncate">
                              {highlight(title, query)}
                            </div>
                            {subtitle && (
                              <div className="text-xs text-gray-500 truncate mt-0.5">
                                {highlight(subtitle, query)}
                              </div>
                            )}
                          </div>
                          <ChevronRight className="w-3.5 h-3.5 text-gray-600 group-hover:text-gray-400 transition-colors flex-shrink-0" />
                        </button>
                      );
                    })}
                  </div>
                ));
              })()}
              <div className="border-t border-gray-800/60 px-3 py-2 text-[10px] text-gray-600 flex justify-between">
                <span>{results.length} result{results.length !== 1 ? "s" : ""}</span>
                <span>ESC to close</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}