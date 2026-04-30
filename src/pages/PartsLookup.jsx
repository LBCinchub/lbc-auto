import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const YEARS = Array.from({ length: 40 }, (_, i) => new Date().getFullYear() - i);

export default function PartsLookup() {
  const [vinNumber, setVinNumber] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedMake, setSelectedMake] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [selectedEngine, setSelectedEngine] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const queryClient = useQueryClient();

  const { data: parts = [] } = useQuery({
    queryKey: ["parts"],
    queryFn: () => base44.entities.Part.list("-created_date", 500),
  });

  // Get unique makes for selected year
  const makes = [...new Set(parts.map(p => p.make).filter(Boolean))].sort();

  // Get unique models for selected year/make
  const models = selectedMake
    ? [...new Set(parts.filter(p => p.make === selectedMake).map(p => p.model).filter(Boolean))].sort()
    : [];

  // Get unique engines for selected year/make/model
  const engines = selectedModel
    ? [...new Set(parts.filter(p => p.make === selectedMake && p.model === selectedModel).map(p => p.engine_type).filter(Boolean))].sort()
    : [];

  const handleVinLookup = () => {
    if (!vinNumber.trim()) return;
    
    const resultsForVin = parts.filter(p => 
      p.name.toLowerCase().includes(vinNumber.toLowerCase()) ||
      p.part_number.toLowerCase().includes(vinNumber.toLowerCase())
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
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="border-b pb-4 mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Parts Catalog</h1>
          <p className="text-sm text-gray-600 mt-1">Vehicle</p>
        </div>

        {/* Info Section */}
        <div className="mb-8 p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <p className="font-semibold text-gray-900 mb-3">Here you can:</p>
          <ul className="list-disc list-inside space-y-2 text-gray-700 text-sm">
            <li>Find any part or component with part numbers and descriptions</li>
            <li>Search the database by vehicle year, make, and model</li>
            <li>Look up parts using VIN number</li>
            <li>Create a printable list of parts you need</li>
          </ul>
        </div>

        {/* VIN Lookup */}
        <div className="mb-8 p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            VIN Lookup
          </label>
          <div className="flex gap-2">
            <Input
              type="text"
              maxLength="17"
              placeholder="Enter VIN number"
              value={vinNumber}
              onChange={(e) => setVinNumber(e.target.value.toUpperCase())}
              onKeyPress={(e) => e.key === 'Enter' && handleVinLookup()}
              className="border-gray-900 max-w-xs"
            />
            <Button
              onClick={handleVinLookup}
              className="bg-gray-900 text-white hover:bg-gray-800"
            >
              Go
            </Button>
          </div>
        </div>

        {/* Vehicle Selection */}
        <div className="mb-8 p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <p className="font-semibold text-gray-900 mb-4">Select a Vehicle:</p>

          <div className="grid grid-cols-4 gap-4 mb-6">
            {/* Year Column */}
            <div>
              <label className="text-xs font-bold text-gray-700 bg-gray-300 p-2 block mb-1">
                Year
              </label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="border-gray-900 h-64">
                  <SelectValue placeholder="Select year" />
                </SelectTrigger>
                <SelectContent>
                  {YEARS.map(year => (
                    <SelectItem key={year} value={String(year)}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Make Column */}
            <div>
              <label className="text-xs font-bold text-gray-700 bg-gray-300 p-2 block mb-1">
                Make
              </label>
              <Select value={selectedMake} onValueChange={(val) => {
                setSelectedMake(val);
                setSelectedModel("");
                setSelectedEngine("");
              }} disabled={!selectedYear}>
                <SelectTrigger className="border-gray-900 h-64">
                  <SelectValue placeholder="Select make" />
                </SelectTrigger>
                <SelectContent>
                  {makes.map(make => (
                    <SelectItem key={make} value={make}>
                      {make}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Model Column */}
            <div>
              <label className="text-xs font-bold text-gray-700 bg-gray-300 p-2 block mb-1">
                Model
              </label>
              <Select value={selectedModel} onValueChange={(val) => {
                setSelectedModel(val);
                setSelectedEngine("");
              }} disabled={!selectedMake}>
                <SelectTrigger className="border-gray-900 h-64">
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  {models.map(model => (
                    <SelectItem key={model} value={model}>
                      {model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Engine Column */}
            <div>
              <label className="text-xs font-bold text-gray-700 bg-gray-300 p-2 block mb-1">
                Engine
              </label>
              <Select value={selectedEngine} onValueChange={setSelectedEngine} disabled={!selectedModel}>
                <SelectTrigger className="border-gray-900 h-64">
                  <SelectValue placeholder="Select engine" />
                </SelectTrigger>
                <SelectContent>
                  {engines.map(engine => (
                    <SelectItem key={engine} value={engine}>
                      {engine}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-2 justify-center">
            <Button
              onClick={handleVehicleSearch}
              disabled={!selectedModel}
              className="bg-gray-900 text-white hover:bg-gray-800"
            >
              Search Parts
            </Button>
            <Button
              onClick={handleClear}
              variant="outline"
              className="border-gray-900 text-gray-900"
            >
              Clear
            </Button>
          </div>
        </div>

        {/* Search Results */}
        {showResults && (
          <div className="mt-8">
            <h2 className="text-lg font-bold text-gray-900 mb-4">
              Search Results ({searchResults.length} parts found)
            </h2>

            {searchResults.length === 0 ? (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg flex gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0" />
                <p className="text-blue-800">No parts found for the selected vehicle.</p>
              </div>
            ) : (
              <div className="border border-gray-300 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-900 text-white">
                      <th className="px-4 py-3 text-left text-sm font-semibold">Part Number</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Part Name</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Supplier</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold">Price</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold">Stock</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {searchResults.map((part, idx) => (
                      <tr key={part.id} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {part.part_number}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {part.name}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {part.supplier || "—"}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium">
                          ${part.sale_price?.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-right">
                          {part.quantity} units
                        </td>
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