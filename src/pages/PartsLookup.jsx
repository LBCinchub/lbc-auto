import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const YEARS = Array.from({ length: 40 }, (_, i) => new Date().getFullYear() - i);

export default function PartsLookup() {
  const [vinNumber, setVinNumber] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedMake, setSelectedMake] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [selectedEngine, setSelectedEngine] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [showResults, setShowResults] = useState(false);

  const { data: parts = [] } = useQuery({
    queryKey: ["parts"],
    queryFn: () => base44.entities.Part.list("-created_date", 500),
  });

  const makes = [...new Set(parts.map(p => p.make).filter(Boolean))].sort();
  const models = selectedMake
    ? [...new Set(parts.filter(p => p.make === selectedMake).map(p => p.model).filter(Boolean))].sort()
    : [];
  const engines = selectedModel
    ? [...new Set(parts.filter(p => p.make === selectedMake && p.model === selectedModel).map(p => p.engine_type).filter(Boolean))].sort()
    : [];

  const handleVinLookup = () => {
    if (!vinNumber.trim()) return;
    const resultsForVin = parts.filter(p =>
      (p.name || "").toLowerCase().includes(vinNumber.toLowerCase()) ||
      (p.part_number || "").toLowerCase().includes(vinNumber.toLowerCase())
    );
    setSearchResults(resultsForVin);
    setShowResults(true);
  };

  const handleVehicleSearch = () => {
    if (!selectedYear || !selectedMake || !selectedModel) return;
    const results = parts.filter(p =>
      (!selectedYear || p.year == selectedYear) &&
      (!selectedMake || p.make === selectedMake) &&
      (!selectedModel || p.model === selectedModel) &&
      (!selectedEngine || !p.engine_type || p.engine_type === selectedEngine)
    );
    setSearchResults(results);
    setShowResults(true);
  };

  const handleClear = () => {
    setSelectedYear("");
    setSelectedMake("");
    setSelectedModel("");
    setSelectedEngine("");
    setSearchResults([]);
    setShowResults(false);
  };

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Parts Catalog</h1>
        <p className="text-sm text-gray-400 mt-1">Search inventory by vehicle or VIN</p>
      </div>

      {/* VIN Lookup */}
      <div className="mb-6 flex items-center gap-3">
        <label className="text-sm font-semibold text-gray-300 whitespace-nowrap">VIN Lookup</label>
        <Input
          type="text"
          maxLength={17}
          placeholder="Enter 17-character VIN"
          value={vinNumber}
          onChange={(e) => setVinNumber(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && handleVinLookup()}
          className="max-w-xs bg-gray-800 border-gray-700 text-white placeholder-gray-500"
        />
        <Button onClick={handleVinLookup} className="bg-sky-600 hover:bg-sky-500 text-white">
          Go
        </Button>
      </div>

      {/* Vehicle Selection */}
      <div className="mb-6 p-4 border border-gray-700 rounded-lg bg-gray-800/50">
        <p className="font-semibold text-white mb-4">Select a Vehicle:</p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          {/* Year */}
          <div className="flex flex-col">
            <div className="text-xs font-bold text-gray-300 bg-gray-700 px-2 py-1 mb-1 rounded-t">Year</div>
            <select
              multiple
              size={10}
              value={selectedYear ? [selectedYear] : []}
              onChange={(e) => {
                const val = e.target.options[e.target.selectedIndex]?.value || "";
                setSelectedYear(val);
                setSelectedMake("");
                setSelectedModel("");
                setSelectedEngine("");
              }}
              style={{ height: "220px" }}
              className="w-full border border-gray-600 rounded-b bg-gray-900 text-white text-sm overflow-auto focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer"
            >
              {YEARS.map(year => (
                <option
                  key={year}
                  value={String(year)}
                  className={`px-2 py-1 cursor-pointer ${selectedYear === String(year) ? "bg-sky-600 text-white" : "hover:bg-gray-700"}`}
                >
                  {year}
                </option>
              ))}
            </select>
          </div>

          {/* Make */}
          <div className="flex flex-col">
            <div className="text-xs font-bold text-gray-300 bg-gray-700 px-2 py-1 mb-1 rounded-t">Make</div>
            <select
              multiple
              size={10}
              value={selectedMake ? [selectedMake] : []}
              onChange={(e) => {
                const val = e.target.options[e.target.selectedIndex]?.value || "";
                setSelectedMake(val);
                setSelectedModel("");
                setSelectedEngine("");
              }}
              disabled={!selectedYear}
              style={{ height: "220px" }}
              className="w-full border border-gray-600 rounded-b bg-gray-900 text-white text-sm overflow-auto focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {makes.length === 0
                ? <option disabled className="text-gray-500 px-2 py-1">No makes available</option>
                : makes.map(make => (
                  <option
                    key={make}
                    value={make}
                    className={`px-2 py-1 cursor-pointer ${selectedMake === make ? "bg-sky-600 text-white" : "hover:bg-gray-700"}`}
                  >
                    {make}
                  </option>
                ))
              }
            </select>
          </div>

          {/* Model */}
          <div className="flex flex-col">
            <div className="text-xs font-bold text-gray-300 bg-gray-700 px-2 py-1 mb-1 rounded-t">Model</div>
            <select
              multiple
              size={10}
              value={selectedModel ? [selectedModel] : []}
              onChange={(e) => {
                const val = e.target.options[e.target.selectedIndex]?.value || "";
                setSelectedModel(val);
                setSelectedEngine("");
              }}
              disabled={!selectedMake}
              style={{ height: "220px" }}
              className="w-full border border-gray-600 rounded-b bg-gray-900 text-white text-sm overflow-auto focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {models.length === 0
                ? <option disabled className="text-gray-500 px-2 py-1">Select a make first</option>
                : models.map(model => (
                  <option
                    key={model}
                    value={model}
                    className={`px-2 py-1 cursor-pointer ${selectedModel === model ? "bg-sky-600 text-white" : "hover:bg-gray-700"}`}
                  >
                    {model}
                  </option>
                ))
              }
            </select>
          </div>

          {/* Engine */}
          <div className="flex flex-col">
            <div className="text-xs font-bold text-gray-300 bg-gray-700 px-2 py-1 mb-1 rounded-t">Engine</div>
            <select
              multiple
              size={10}
              value={selectedEngine ? [selectedEngine] : []}
              onChange={(e) => {
                const val = e.target.options[e.target.selectedIndex]?.value || "";
                setSelectedEngine(val);
              }}
              disabled={!selectedModel}
              style={{ height: "220px" }}
              className="w-full border border-gray-600 rounded-b bg-gray-900 text-white text-sm overflow-auto focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {engines.length === 0
                ? <option disabled className="text-gray-500 px-2 py-1">Select a model first</option>
                : engines.map(engine => (
                  <option
                    key={engine}
                    value={engine}
                    className={`px-2 py-1 cursor-pointer ${selectedEngine === engine ? "bg-sky-600 text-white" : "hover:bg-gray-700"}`}
                  >
                    {engine}
                  </option>
                ))
              }
            </select>
          </div>
        </div>

        {/* Selected summary */}
        {selectedYear && (
          <p className="text-sm text-gray-300 mb-3">
            Selected: <span className="font-medium text-white">{selectedYear} {selectedMake} {selectedModel} {selectedEngine}</span>
          </p>
        )}

        <div className="flex gap-2">
          <Button
            onClick={handleVehicleSearch}
            disabled={!selectedYear}
            className="bg-sky-600 hover:bg-sky-500 text-white"
          >
            Search Parts
          </Button>
          <Button onClick={handleClear} variant="outline" className="border-gray-600 text-gray-300 hover:bg-gray-700">
            Clear
          </Button>
        </div>
      </div>

      {/* Results */}
      {showResults && (
        <div className="mt-4">
          <h2 className="text-lg font-bold text-white mb-4">
            Search Results — {searchResults.length} part{searchResults.length !== 1 ? "s" : ""} found
          </h2>

          {searchResults.length === 0 ? (
            <div className="p-4 bg-sky-900/30 border border-sky-700/50 rounded-lg flex gap-3 items-center">
              <AlertCircle className="w-5 h-5 text-sky-400 flex-shrink-0" />
              <p className="text-sky-300 text-sm">No parts found for the selected vehicle.</p>
            </div>
          ) : (
            <div className="border border-gray-700 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-800 text-gray-300">
                    <th className="px-4 py-3 text-left font-semibold">Part Number</th>
                    <th className="px-4 py-3 text-left font-semibold">Part Name</th>
                    <th className="px-4 py-3 text-left font-semibold">Supplier</th>
                    <th className="px-4 py-3 text-right font-semibold">Price</th>
                    <th className="px-4 py-3 text-right font-semibold">Stock</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {searchResults.map((part, idx) => (
                    <tr key={part.id} className={idx % 2 === 0 ? "bg-gray-900" : "bg-gray-800/50"}>
                      <td className="px-4 py-3 font-medium text-gray-300">{part.part_number || "—"}</td>
                      <td className="px-4 py-3 text-white">{part.name}</td>
                      <td className="px-4 py-3 text-gray-400">{part.supplier || "—"}</td>
                      <td className="px-4 py-3 text-right font-medium text-white">${part.sale_price?.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right text-gray-300">{part.quantity} units</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}