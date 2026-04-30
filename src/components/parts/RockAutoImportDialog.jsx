import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";

export default function RockAutoImportDialog({ open, onClose, onImportSuccess }) {
  const [year, setYear] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [parts, setParts] = useState([]);
  const [importing, setImporting] = useState(false);
  const [successCount, setSuccessCount] = useState(0);

  const handleFetchParts = async () => {
    if (!year || !make || !model) {
      setError("Please fill in all vehicle fields");
      return;
    }

    setLoading(true);
    setError("");
    setParts([]);

    try {
      const response = await base44.functions.invoke('fetchRockAutoParts', {
        year,
        make,
        model
      });

      if (response.data.success) {
        setParts(response.data.parts);
      } else {
        setError(response.data.message || 'Failed to fetch parts');
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch parts from RockAuto');
    } finally {
      setLoading(false);
    }
  };

  const handleImportAll = async () => {
    setImporting(true);
    setError("");
    let count = 0;

    try {
      for (const part of parts) {
        try {
          await base44.entities.Part.create({
            name: part.name,
            part_number: part.part_number,
            supplier: part.supplier,
            cost_price: parseFloat(part.cost_price) || 0,
            sale_price: parseFloat(part.sale_price) || 0,
            quantity: part.quantity || 0,
            category: part.category
          });
          count++;
        } catch (err) {
          console.error(`Failed to import ${part.name}:`, err);
        }
      }

      setSuccessCount(count);
      setParts([]);
      setYear("");
      setMake("");
      setModel("");
      onImportSuccess?.();
    } catch (err) {
      setError(`Failed to import parts: ${err.message}`);
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setYear("");
    setMake("");
    setModel("");
    setParts([]);
    setError("");
    setSuccessCount(0);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import Parts from RockAuto</DialogTitle>
        </DialogHeader>

        {successCount > 0 ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
              <div>
                <p className="font-semibold text-emerald-400">{successCount} parts imported successfully!</p>
                <p className="text-sm text-emerald-300/70">Your parts list has been updated.</p>
              </div>
            </div>
            <Button onClick={handleClose} className="w-full bg-sky-600 hover:bg-sky-700">
              Close
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Vehicle Selection */}
            <div className="space-y-3 bg-gray-800/30 rounded-lg p-4">
              <p className="text-sm font-semibold text-gray-300">Select Vehicle</p>
              <div className="grid grid-cols-3 gap-3">
                <Input
                  placeholder="Year (e.g., 2020)"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  className="bg-gray-800 border-gray-700 text-white"
                  type="number"
                />
                <Input
                  placeholder="Make (e.g., Toyota)"
                  value={make}
                  onChange={(e) => setMake(e.target.value)}
                  className="bg-gray-800 border-gray-700 text-white"
                />
                <Input
                  placeholder="Model (e.g., Camry)"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-3 bg-rose-500/10 border border-rose-500/30 rounded-lg p-3">
                <AlertCircle className="w-4 h-4 text-rose-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-rose-300">{error}</p>
              </div>
            )}

            {/* Parts List */}
            {parts.length > 0 && (
              <div className="bg-gray-800/30 rounded-lg p-4 space-y-2">
                <p className="text-sm font-semibold text-gray-300">{parts.length} parts found</p>
                <div className="max-h-64 overflow-y-auto space-y-1 text-sm">
                  {parts.slice(0, 10).map((p, i) => (
                    <div key={i} className="text-gray-400 text-xs">
                      • {p.name} #{p.part_number}
                    </div>
                  ))}
                  {parts.length > 10 && (
                    <div className="text-gray-500 text-xs">... and {parts.length - 10} more</div>
                  )}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button
                onClick={handleFetchParts}
                disabled={loading || !year || !make || !model}
                className="flex-1 bg-sky-600 hover:bg-sky-700"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Fetching...
                  </>
                ) : (
                  'Search Parts'
                )}
              </Button>
              {parts.length > 0 && (
                <Button
                  onClick={handleImportAll}
                  disabled={importing}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                >
                  {importing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    `Import ${parts.length} Parts`
                  )}
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}