import React, { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { fuzzyMatch } from "@/utils/fuzzySearch";

export default function CustomerSearchInput({ customers = [], value, onChange }) {
  const selected = customers.find(c => c.id === value);
  const [query, setQuery] = useState(selected?.full_name || "");
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    setQuery(selected?.full_name || "");
  }, [value, customers]);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = customers.filter(c =>
    fuzzyMatch(query, [c.full_name, c.phone, c.email])
  );

  const handleSelect = (customer) => {
    onChange(customer.id, customer.full_name);
    setQuery(customer.full_name);
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          value={query}
          autoCapitalize="words"
          onChange={e => {
            const v = e.target.value.replace(/(^|\s)(\S)/g, (_, s, c) => s + c.toUpperCase());
            setQuery(v); setOpen(true); if (!v) onChange("", "");
          }}
          onFocus={() => setOpen(true)}
          className="bg-gray-800 border-gray-700 text-white mt-1 pl-9"
          placeholder="Search customer by name or phone..."
        />
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-700 rounded-md shadow-lg max-h-48 overflow-y-auto">
          {filtered.map(c => (
            <div key={c.id} onClick={() => handleSelect(c)}
              className="px-3 py-2 cursor-pointer hover:bg-gray-700 text-white text-sm">
              <div className="font-medium">{c.full_name}</div>
              {c.phone && <div className="text-gray-400 text-xs">{c.phone}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}