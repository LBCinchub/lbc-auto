import React, { useState, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { Search, X, Wrench, Users, Car, FileText, Package, ChevronRight, ClipboardList, CalendarDays } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";

function highlight(text, query) {
  if (!text || !query) return text;
  const str = String(text);
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return str;
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
    else return -1;
  }
  return score;
}

// Portal dropdown — renders directly on document.body, bypasses all overflow/clip containers
function SearchDropdown({ open, style, results, query, typeConfig, getTitle, getSubtitle, handleSelect }) {
  if (!open) return null;
  const groupOrder = ["customer", "vehicle", "order", "invoice", "estimate", "appointment", "part"];
  const groupLabels = {
    customer: "Customers", vehicle: "Vehicles", order: "Repair Orders",
    invoice: "Invoices", estimate: "Estimates", appointment: "Appointments", part: "Parts"
  };

  const dropdown = (
    <div
      style={{ ...style, position: "fixed", zIndex: 999999 }}
      className="bg-gray-900 border border-gray-700/60 rounded-xl shadow-2xl overflow-hidden"
    >
      <div className="max-h-[70vh] overflow-y-auto overscroll-contain">
        {results.length === 0 && query.trim().length >= 1 && (
          <div className="px-4 py-8 text-center text-gray-500 text-sm">
            No results for <span className="text-gray-300">"{query}"</span>
          </div>
        )}
        {results.length > 0 && (() => {
          const grouped = {};
          results.forEach(r => {
            if (!grouped[r.type]) grouped[r.type] = [];
            grouped[r.type].push(r);
          });
          return groupOrder.filter(t => grouped[t]).map(type => (
            <div key={type}>
              <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-gray-500 bg-gray-900/90 sticky top-0 backdrop-blur-sm border-b border-gray-800/40">
                {groupLabels[type]} <span className="text-gray-600">({grouped[type].length})</span>
              </div>
              {grouped[type].map((result) => {
                const cfg = typeConfig[result.type];
                const Icon = cfg.icon;
                const title = getTitle(result);
                const subtitle = getSubtitle(result);
                return (
                  <button
                    key={`${result.type}-${result.item.id}`}
                    onMouseDown={(e) => { e.preventDefault(); handleSelect(result); }}
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
        {results.length > 0 && (
          <div className="border-t border-gray-800/60 px-3 py-2 text-[10px] text-gray-600 flex justify-between sticky bottom-0 bg-gray-900">
            <span>{results.length} result{results.length !== 1 ? "s" : ""}</span>
            <span>ESC to close</span>
          </div>
        )}
      </div>
      {/* Jump-to-page footer */}
      {results.length > 0 && (() => {
        const typeCounts = {};
        results.forEach(r => { typeCounts[r.type] = (typeCounts[r.type] || 0) + 1; });
        const jumpLinks = Object.entries(typeCounts)
          .filter(([type]) => typeConfig[type]?.listNav)
          .slice(0, 4);
        if (jumpLinks.length === 0) return null;
        return (
          <div className="border-t border-gray-800/60 px-3 py-2 flex flex-wrap gap-2 bg-gray-900">
            {jumpLinks.map(([type, count]) => {
              const cfg = typeConfig[type];
              return (
                <button key={type}
                  onMouseDown={(e) => { e.preventDefault(); cfg.listNav(query.trim()); }}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${cfg.bg} ${cfg.color} hover:opacity-80`}>
                  <cfg.icon className="w-3 h-3" />
                  See all {count} {cfg.label}{count !== 1 ? "s" : ""} →
                </button>
              );
            })}
          </div>
        );
      })()}
    </div>
  );

  return createPortal(dropdown, document.body);
}

export default function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [dropdownStyle, setDropdownStyle] = useState({});
  const ref = useRef(null);
  const inputRef = useRef(null);
  const inputContainerRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    base44.auth.me().then(setUser);
  }, []);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (e.key === "Escape") { setOpen(false); setQuery(""); }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // Recompute dropdown position whenever open/query changes
  useEffect(() => {
    if (open && inputContainerRef.current) {
      const rect = inputContainerRef.current.getBoundingClientRect();
      const dropW = Math.max(rect.width * 2.2, 520);
      // Keep within viewport horizontally
      const left = Math.min(rect.left, window.innerWidth - dropW - 12);
      setDropdownStyle({
        top: rect.bottom + 6,
        left: Math.max(8, left),
        width: dropW,
      });
    }
  }, [open, query]);

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
    const tokens = query.trim().toLowerCase().split(/\s+/);
    const all = [];
    orders.forEach(o => {
      const h = [o.order_number, o.customer_name, o.vehicle_info, o.description, o.mechanic_name].filter(Boolean).join(" ");
      const score = scoreMatch(h, tokens);
      if (score >= 0) all.push({ type: "order", score, item: o });
    });
    customers.forEach(c => {
      const h = [c.full_name, c.phone, c.email, c.address].filter(Boolean).join(" ");
      const score = scoreMatch(h, tokens);
      if (score >= 0) all.push({ type: "customer", score, item: c });
    });
    vehicles.forEach(v => {
      const h = [v.year, v.make, v.model, v.vin, v.license_plate, v.customer_name].filter(Boolean).join(" ");
      const score = scoreMatch(h, tokens);
      if (score >= 0) all.push({ type: "vehicle", score, item: v });
    });
    invoices.forEach(i => {
      const h = [i.invoice_number, i.customer_name, i.vehicle_info].filter(Boolean).join(" ");
      const score = scoreMatch(h, tokens);
      if (score >= 0) all.push({ type: "invoice", score, item: i });
    });
    parts.forEach(p => {
      const h = [p.name, p.part_number, p.supplier, p.category].filter(Boolean).join(" ");
      const score = scoreMatch(h, tokens);
      if (score >= 0) all.push({ type: "part", score, item: p });
    });
    estimates.forEach(e => {
      const h = [e.estimate_number, e.customer_name, e.vehicle_info, e.status].filter(Boolean).join(" ");
      const score = scoreMatch(h, tokens);
      if (score >= 0) all.push({ type: "estimate", score, item: e });
    });
    appointments.forEach(a => {
      const h = [a.customer_name, a.vehicle_info, a.service_type, a.date, a.notes, a.time_slot].filter(Boolean).join(" ");
      const score = scoreMatch(h, tokens);
      if (score >= 0) all.push({ type: "appointment", score, item: a });
    });
    return all.sort((a, b) => b.score - a.score).slice(0, 20);
  }, [query, orders, customers, vehicles, invoices, parts, estimates, appointments, enabled]);

  const typeConfig = {
    order:       { icon: Wrench,        label: "Repair Order", color: "text-sky-400",    bg: "bg-sky-500/10",    nav: (item) => navigate(`/RepairOrderDetail/${item.id}`), listNav: (q) => navigate(`/RepairOrders?q=${encodeURIComponent(q)}`) },
    customer:    { icon: Users,         label: "Customer",     color: "text-emerald-400", bg: "bg-emerald-500/10", nav: (item) => navigate(`/CustomerDetails?id=${item.id}`), listNav: (q) => navigate(`/Customers?q=${encodeURIComponent(q)}`) },
    vehicle:     { icon: Car,           label: "Vehicle",      color: "text-amber-400",  bg: "bg-amber-500/10",  nav: (item) => navigate(`/Vehicles?vehicleId=${item.id}`), listNav: (q) => navigate(`/Vehicles?q=${encodeURIComponent(q)}`) },
    invoice:     { icon: FileText,      label: "Invoice",      color: "text-purple-400", bg: "bg-purple-500/10", nav: (item) => navigate(`/InvoiceDetail/${item.id}`), listNav: (q) => navigate(`/Invoices?q=${encodeURIComponent(q)}`) },
    part:        { icon: Package,       label: "Part",         color: "text-rose-400",   bg: "bg-rose-500/10",   nav: () => navigate(`/Parts`) },
    estimate:    { icon: ClipboardList, label: "Estimate",     color: "text-violet-400", bg: "bg-violet-500/10", nav: (item) => navigate(`/EstimateDetail/${item.id}`), listNav: (q) => navigate(`/Estimates?q=${encodeURIComponent(q)}`) },
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
          onKeyDown={e => { if (e.key === "Enter" && results.length > 0) handleSelect(results[0]); }}
          placeholder="Search everything... (⌘K)"
          className="w-full pl-9 pr-8 py-2 bg-gray-800/60 border border-gray-700/50 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-sky-500/60 focus:border-sky-500/40 transition-all"
        />
        {query && (
          <button
            onClick={() => { setQuery(""); setOpen(false); }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <SearchDropdown
        open={open && (results.length > 0 || query.trim().length >= 1)}
        style={dropdownStyle}
        results={results}
        query={query}
        typeConfig={typeConfig}
        getTitle={getTitle}
        getSubtitle={getSubtitle}
        handleSelect={handleSelect}
      />
    </div>
  );
}
