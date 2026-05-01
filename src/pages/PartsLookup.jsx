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

  const listboxClass = "w-full border border-gray-400 rounded bg-white text-sm overflow-auto h-48 focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="border-b pb-4 mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Parts Catalog</h1>
          <p className="text-sm text-gray-500 mt-1">Search inventory by vehicle or VIN</p>
        </div>

        {/* VIN Lookup */}
        <div className="mb-6 flex items-center gap-3">
          <label className="text-sm font-semibold text-gray-800 whitespace-nowrap">VIN Lookup</label>
          <Input
            type="text"
            maxLength={17}
            placeholder="Enter 17-character VIN"
            value={vinNumber}
            onChange={(e) => setVinNumber(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && handleVinLookup()}
            className="max-w-xs"
          />
          <Button onClick={handleVinLookup} className="bg-gray-900 text-white hover:bg-gray-800">
            Go
          </Button>
        </div>

        {/* Vehicle Selection */}
        <div className="mb-6 p-4 border border-gray-300 rounded-lg bg-gray-50">
          <p className="font-semibold text-gray-900 mb-4">Select a Vehicle:</p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            {/* Year */}
            <div>
              <div className="text-xs font-bold text-gray-700 bg-gray-300 px-2 py-1 mb-1">Year</div>
              <select
                className={listboxClass}
                size={8}
                value={selectedYear}
                onChange={(e) => {
                  setSelectedYear(e.target.value);
                  setSelectedMake("");
                  setSelectedModel("");
                  setSelectedEngine("");
                }}
              >
                {YEARS.map(year => (
                  <option key={year} value={String(year)}>{year}</option>
                ))}
              </select>
            </div>

            {/* Make */}
            <div>
              <div className="text-xs font-bold text-gray-700 bg-gray-300 px-2 py-1 mb-1">Make</div>
              <select
                className={listboxClass}
                size={8}
                value={selectedMake}
                onChange={(e) => {
                  setSelectedMake(e.target.value);
                  setSelectedModel("");
                  setSelectedEngine("");
                }}
                disabled={!selectedYear}
              >
                {makes.length === 0 && <option disabled>No makes available</option>}
                {makes.map(make => (
                  <option key={make} value={make}>{make}</option>
                ))}
              </select>
            </div>

            {/* Model */}
            <div>
              <div className="text-xs font-bold text-gray-700 bg-gray-300 px-2 py-1 mb-1">Model</div>
              <select
                className={listboxClass}
                size={8}
                value={selectedModel}
                onChange={(e) => {
                  setSelectedModel(e.target.value);
                  setSelectedEngine("");
                }}
                disabled={!selectedMake}
              >
                {models.length === 0 && <option disabled>Select a make first</option>}
                {models.map(model => (
                  <option key={model} value={model}>{model}</option>
                ))}
              </select>
            </div>

            {/* Engine */}
            <div>
              <div className="text-xs font-bold text-gray-700 bg-gray-300 px-2 py-1 mb-1">Engine</div>
              <select
                className={listboxClass}
                size={8}
                value={selectedEngine}
                onChange={(e) => setSelectedEngine(e.target.value)}
                disabled={!selectedModel}
              >
                {engines.length === 0 && <option disabled>Select a model first</option>}
                {engines.map(engine => (
                  <option key={engine} value={engine}>{engine}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Selected summary */}
          {selectedYear && (
            <p className="text-sm text-gray-600 mb-3">
              Selected: <span className="font-medium">{selectedYear} {selectedMake} {selectedModel} {selectedEngine}</span>
            </p>
          )}

          <div className="flex gap-2">
            <Button
              onClick={handleVehicleSearch}
              disabled={!selectedYear || !selectedMake || !selectedModel}
              className="bg-gray-900 text-white hover:bg-gray-800"
            >
              Search Parts
            </Button>
            <Button onClick={handleClear} variant="outline">
              Clear
            </Button>
          </div>
        </div>

        {/* Results */}
        {showResults && (
          <div className="mt-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">
              Search Results — {searchResults.length} part{searchResults.length !== 1 ? "s" : ""} found
            </h2>

            {searchResults.length === 0 ? (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg flex gap-3 items-center">
                <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0" />
                <p className="text-blue-800 text-sm">No parts found for the selected vehicle.</p>
              </div>
            ) : (
              <div className="border border-gray-300 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-900 text-white">
                      <th className="px-4 py-3 text-left font-semibold">Part Number</th>
                      <th className="px-4 py-3 text-left font-semibold">Part Name</th>
                      <th className="px-4 py-3 text-left font-semibold">Supplier</th>
                      <th className="px-4 py-3 text-right font-semibold">Price</th>
                      <th className="px-4 py-3 text-right font-semibold">Stock</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {searchResults.map((part, idx) => (
                      <tr key={part.id} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                        <td className="px-4 py-3 font-medium text-gray-900">{part.part_number || "—"}</td>
                        <td className="px-4 py-3 text-gray-700">{part.name}</td>
                        <td className="px-4 py-3 text-gray-600">{part.supplier || "—"}</td>
                        <td className="px-4 py-3 text-right font-medium text-gray-900">${part.sale_price?.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right text-gray-900">{part.quantity} units</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}