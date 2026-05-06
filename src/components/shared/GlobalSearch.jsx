import React, { useState, useRef, useEffect, useMemo } from "react";
import { Search, X, Wrench, Users, Car, FileText, Package, ChevronRight } from "lucide-react";
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

    return all.sort((a, b) => b.score - a.score).slice(0, 12);
  }, [query, orders, customers, vehicles, invoices, parts, enabled]);

  const typeConfig = {
    order: { icon: Wrench, label: "Repair Order", color: "text-sky-400", bg: "bg-sky-500/10", nav: (item) => navigate(`/RepairOrderDetail/${item.id}`) },
    customer: { icon: Users, label: "Customer", color: "text-emerald-400", bg: "bg-emerald-500/10", nav: (item) => navigate(`/Customers`) },
    vehicle: { icon: Car, label: "Vehicle", color: "text-amber-400", bg: "bg-amber-500/10", nav: (item) => navigate(`/VehicleTimeline/${item.id}`) },
    invoice: { icon: FileText, label: "Invoice", color: "text-purple-400", bg: "bg-purple-500/10", nav: (item) => navigate(`/InvoiceDetail/${item.id}`) },
    part: { icon: Package, label: "Part", color: "text-rose-400", bg: "bg-rose-500/10", nav: () => navigate(`/Parts`) },
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
    return "";
  };

  const getSubtitle = (result) => {
    const { type, item } = result;
    if (type === "order") return item.vehicle_info || item.status;
    if (type === "customer") return [item.phone, item.email].filter(Boolean).join(" · ");
    if (type === "vehicle") return [item.vin && `VIN: ${item.vin}`, item.license_plate].filter(Boolean).join(" · ");
    if (type === "invoice") return `$${(item.total || 0).toFixed(2)} · ${item.status}`;
    if (type === "part") return [item.part_number && `#${item.part_number}`, item.supplier].filter(Boolean).join(" · ");
    return "";
  };

  return (
    <div ref={ref} className="relative w-full">
      <div className="relative">
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
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-gray-900 border border-gray-700/80 rounded-xl shadow-2xl shadow-black/50 z-50 overflow-hidden">
          {results.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-gray-500">
              No results for <span className="text-gray-300">"{query}"</span>
            </div>
          ) : (
            <div className="py-1.5 max-h-[420px] overflow-y-auto">
              {results.map((result, i) => {
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
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${cfg.bg} ${cfg.color}`}>
                        {cfg.label}
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 text-gray-600 group-hover:text-gray-400 transition-colors" />
                    </div>
                  </button>
                );
              })}
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