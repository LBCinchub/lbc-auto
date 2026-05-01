import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, X } from "lucide-react";

const PART_FIELDS = [
  { key: "name", label: "Part Name *", required: true },
  { key: "part_number", label: "Part Number" },
  { key: "supplier", label: "Supplier" },
  { key: "cost_price", label: "Cost Price" },
  { key: "sale_price", label: "Sale Price *", required: true },
  { key: "quantity", label: "Quantity" },
  { key: "min_stock", label: "Min Stock" },
  { key: "category", label: "Category" },
];

export default function CsvImportDialog({ open, onClose, onImportSuccess }) {
  const [step, setStep] = useState("upload"); // upload | map | preview | done
  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [mapping, setMapping] = useState({});
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const fileRef = useRef();

  const reset = () => {
    setStep("upload");
    setHeaders([]);
    setRows([]);
    setMapping({});
    setImporting(false);
    setResult(null);
    setError("");
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const parseCSV = (text) => {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) throw new Error("File must have a header row and at least one data row.");
    const hdrs = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));
    const data = lines.slice(1).map(line => {
      const vals = line.split(",").map(v => v.trim().replace(/^"|"$/g, ""));
      const obj = {};
      hdrs.forEach((h, i) => { obj[h] = vals[i] ?? ""; });
      return obj;
    });
    return { hdrs, data };
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");

    if (file.name.endsWith(".csv")) {
      const text = await file.text();
      try {
        const { hdrs, data } = parseCSV(text);
        setHeaders(hdrs);
        setRows(data);
        // Auto-map columns with matching names
        const autoMap = {};
        PART_FIELDS.forEach(f => {
          const match = hdrs.find(h =>
            h.toLowerCase().replace(/[\s_]/g, "") === f.key.replace(/_/g, "") ||
            h.toLowerCase().includes(f.key.replace(/_/g, " "))
          );
          if (match) autoMap[f.key] = match;
        });
        setMapping(autoMap);
        setStep("map");
      } catch (err) {
        setError(err.message);
      }
    } else if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
      // Use the base44 ExtractDataFromUploadedFile integration
      try {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        const extracted = await base44.integrations.Core.ExtractDataFromUploadedFile({
          file_url,
          json_schema: {
            type: "object",
            properties: {
              rows: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: { type: "string" }
                }
              }
            }
          }
        });
        if (extracted.status !== "success" || !extracted.output?.rows?.length) {
          throw new Error("Could not read Excel file. Try saving as CSV first.");
        }
        const data = extracted.output.rows;
        const hdrs = Object.keys(data[0]);
        const autoMap = {};
        PART_FIELDS.forEach(f => {
          const match = hdrs.find(h =>
            h.toLowerCase().replace(/[\s_]/g, "") === f.key.replace(/_/g, "") ||
            h.toLowerCase().includes(f.key.replace(/_/g, " "))
          );
          if (match) autoMap[f.key] = match;
        });
        setHeaders(hdrs);
        setRows(data);
        setMapping(autoMap);
        setStep("map");
      } catch (err) {
        setError(err.message || "Failed to parse Excel file.");
      }
    } else {
      setError("Please upload a .csv or .xlsx file.");
    }
  };

  const mappedRows = rows.map(row => {
    const part = {};
    PART_FIELDS.forEach(f => {
      if (mapping[f.key]) {
        const val = row[mapping[f.key]];
        if (["cost_price", "sale_price", "quantity", "min_stock"].includes(f.key)) {
          part[f.key] = parseFloat(val) || 0;
        } else {
          part[f.key] = val || "";
        }
      }
    });
    // Defaults
    if (!part.cost_price) part.cost_price = 0;
    if (!part.sale_price) part.sale_price = 0;
    if (!part.quantity) part.quantity = 0;
    return part;
  }).filter(p => p.name);

  const handleImport = async () => {
    setImporting(true);
    try {
      await base44.entities.Part.bulkCreate(mappedRows);
      setResult({ success: mappedRows.length });
      setStep("done");
    } catch (err) {
      setError("Import failed: " + err.message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto bg-gray-900 border-gray-700 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <FileSpreadsheet className="w-5 h-5 text-sky-400" />
            Import Parts from CSV / Excel
          </DialogTitle>
        </DialogHeader>

        {/* Step: Upload */}
        {step === "upload" && (
          <div className="space-y-4">
            <p className="text-gray-400 text-sm">
              Upload a CSV or Excel file with your parts data. Supported columns: Part Name, Part Number, Supplier, Cost Price, Sale Price, Quantity, Min Stock, Category.
            </p>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-400 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <div
              className="border-2 border-dashed border-gray-700 rounded-xl p-10 text-center cursor-pointer hover:border-sky-500 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="w-10 h-10 text-gray-500 mx-auto mb-3" />
              <p className="text-gray-300 font-medium">Click to upload or drag & drop</p>
              <p className="text-gray-500 text-sm mt-1">.csv or .xlsx files</p>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={handleFile}
              />
            </div>

            <div className="text-xs text-gray-500 p-3 bg-gray-800/50 rounded-lg">
              <p className="font-medium text-gray-400 mb-1">CSV template example:</p>
              <code className="text-green-400">
                part_number,name,supplier,cost_price,sale_price,quantity<br />
                OIL-5W30,5W-30 Oil Filter,AutoZone,3.50,7.99,24
              </code>
            </div>
          </div>
        )}

        {/* Step: Map columns */}
        {step === "map" && (
          <div className="space-y-4">
            <p className="text-gray-400 text-sm">
              {rows.length} rows detected. Map your file's columns to the correct part fields.
            </p>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-400 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <div className="space-y-3">
              {PART_FIELDS.map(field => (
                <div key={field.key} className="flex items-center gap-3">
                  <span className="text-sm text-gray-300 w-36 flex-shrink-0">{field.label}</span>
                  <Select
                    value={mapping[field.key] || "__none__"}
                    onValueChange={(val) => setMapping(prev => ({
                      ...prev,
                      [field.key]: val === "__none__" ? undefined : val
                    }))}
                  >
                    <SelectTrigger className="bg-gray-800 border-gray-700 text-gray-300 flex-1">
                      <SelectValue placeholder="— skip —" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— skip —</SelectItem>
                      {headers.map(h => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            <div className="flex justify-between pt-2">
              <Button variant="outline" className="border-gray-700 text-gray-300" onClick={() => setStep("upload")}>
                Back
              </Button>
              <Button
                className="bg-sky-600 hover:bg-sky-500 text-white"
                disabled={!mapping.name || !mapping.sale_price}
                onClick={() => setStep("preview")}
              >
                Preview ({mappedRows.length} parts)
              </Button>
            </div>
          </div>
        )}

        {/* Step: Preview */}
        {step === "preview" && (
          <div className="space-y-4">
            <p className="text-gray-400 text-sm">
              Previewing first 5 rows. {mappedRows.length} parts will be imported.
            </p>

            <div className="overflow-x-auto rounded-lg border border-gray-700">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-700 bg-gray-800/50">
                    <th className="px-3 py-2 text-left text-gray-400">Name</th>
                    <th className="px-3 py-2 text-left text-gray-400">Part #</th>
                    <th className="px-3 py-2 text-left text-gray-400">Supplier</th>
                    <th className="px-3 py-2 text-right text-gray-400">Cost</th>
                    <th className="px-3 py-2 text-right text-gray-400">Sale</th>
                    <th className="px-3 py-2 text-right text-gray-400">Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {mappedRows.slice(0, 5).map((p, i) => (
                    <tr key={i} className="border-b border-gray-800/50">
                      <td className="px-3 py-2 text-white">{p.name}</td>
                      <td className="px-3 py-2 text-gray-400">{p.part_number || "—"}</td>
                      <td className="px-3 py-2 text-gray-400">{p.supplier || "—"}</td>
                      <td className="px-3 py-2 text-right text-gray-400">${p.cost_price?.toFixed(2)}</td>
                      <td className="px-3 py-2 text-right text-white">${p.sale_price?.toFixed(2)}</td>
                      <td className="px-3 py-2 text-right text-gray-400">{p.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {mappedRows.length > 5 && (
              <p className="text-gray-500 text-xs text-center">...and {mappedRows.length - 5} more rows</p>
            )}

            <div className="flex justify-between pt-2">
              <Button variant="outline" className="border-gray-700 text-gray-300" onClick={() => setStep("map")}>
                Back
              </Button>
              <Button
                className="bg-emerald-600 hover:bg-emerald-500 text-white"
                onClick={handleImport}
                disabled={importing}
              >
                {importing ? "Importing..." : `Import ${mappedRows.length} Parts`}
              </Button>
            </div>
          </div>
        )}

        {/* Step: Done */}
        {step === "done" && (
          <div className="text-center py-8 space-y-4">
            <CheckCircle className="w-14 h-14 text-emerald-400 mx-auto" />
            <p className="text-white font-semibold text-lg">Import Complete!</p>
            <p className="text-gray-400 text-sm">{result?.success} parts successfully added to inventory.</p>
            <Button
              className="bg-sky-600 hover:bg-sky-500 text-white mt-4"
              onClick={() => { onImportSuccess(); handleClose(); }}
            >
              View Inventory
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}