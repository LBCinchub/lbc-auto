import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Upload, CheckCircle, Loader2, Phone } from "lucide-react";

function parseCSVLine(line) {
  const fields = [];
  let current = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuote = !inQuote;
    } else if (ch === ',' && !inQuote) {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

function extractPhone(str) {
  if (!str) return '';
  const digits = str.replace(/\D/g, '');
  return digits.length >= 7 ? digits : '';
}

function parseVehicle(vehicleStr) {
  if (!vehicleStr || vehicleStr.length < 3) return null;
  const yearMatch = vehicleStr.match(/\b(19|20)\d{2}\b/);
  const year = yearMatch ? parseInt(yearMatch[0]) : 0;
  const rest = vehicleStr.replace(yearMatch ? yearMatch[0] : '', '').trim();
  const parts = rest.split(/\s+/).filter(Boolean);
  const make = parts[0] || 'Unknown';
  const model = parts.slice(1).join(' ') || make;
  return { make, model, year, vehicle_info: vehicleStr };
}

export default function ImportCustomers() {
  const [status, setStatus] = useState('idle'); // idle | parsing | importing | done | error
  const [log, setLog] = useState([]);
  const [summary, setSummary] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  const addLog = (msg) => setLog(prev => [...prev, msg]);

  const processCSV = async (text) => {
    setStatus('parsing');
    setLog([]);
    setSummary(null);

    const lines = text.split('\n').slice(1);
    const customerMap = new Map();

    for (const line of lines) {
      if (!line.trim()) continue;
      const fields = parseCSVLine(line);

      const customerName = (fields[4] || '').replace(/^"|"$/g, '').trim();
      const company = (fields[5] || '').replace(/^"|"$/g, '').trim();
      const vehicleInfo = (fields[6] || '').replace(/^"|"$/g, '').trim();

      if (!customerName || customerName.length < 2) continue;
      if (customerName.toLowerCase().includes('customer 1')) continue;
      if (customerName.includes('undefined')) continue;

      const phone = extractPhone(company);

      if (!customerMap.has(customerName)) {
        customerMap.set(customerName, { phone, vehicles: new Set() });
      } else {
        const ex = customerMap.get(customerName);
        if (phone && !ex.phone) ex.phone = phone;
      }

      if (vehicleInfo && vehicleInfo.length > 2) {
        customerMap.get(customerName).vehicles.add(vehicleInfo.trim());
      }
    }

    addLog(`Found ${customerMap.size} unique customers in CSV`);
    setStatus('importing');

    let customersCreated = 0;
    let vehiclesCreated = 0;
    let errors = 0;

    for (const [name, data] of customerMap) {
      try {
        const customer = await base44.entities.Customer.create({
          full_name: name,
          phone: data.phone || '',
        });
        customersCreated++;

        for (const vehicleStr of data.vehicles) {
          const v = parseVehicle(vehicleStr);
          if (!v) continue;
          try {
            await base44.entities.Vehicle.create({
              customer_id: customer.id,
              customer_name: name,
              make: v.make,
              model: v.model,
              year: v.year,
            });
            vehiclesCreated++;
          } catch {
            errors++;
          }
        }
      } catch (e) {
        addLog(`⚠️ Skipped: ${name} — ${e.message}`);
        errors++;
      }
    }

    setSummary({ customersCreated, vehiclesCreated, errors });
    setStatus('done');
    addLog(`✅ Done! ${customersCreated} customers and ${vehiclesCreated} vehicles imported.`);
  };

  const handleFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => processCSV(e.target.result);
    reader.readAsText(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  return (
    <div className="max-w-2xl mx-auto py-10 px-4">
      <h1 className="text-2xl font-bold mb-2">Import Customers & Vehicles</h1>
      <p className="text-muted-foreground mb-8">Upload your CSV export to import customer names, phone numbers, and vehicles.</p>

      {status === 'idle' && (
        <label
          className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-16 cursor-pointer transition-colors ${dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary'}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          <Upload className="w-10 h-10 text-muted-foreground mb-4" />
          <span className="font-medium text-lg">Drop your CSV file here</span>
          <span className="text-muted-foreground text-sm mt-1">or click to browse</span>
          <input type="file" accept=".csv" className="hidden" onChange={(e) => handleFile(e.target.files[0])} />
        </label>
      )}

      {(status === 'parsing' || status === 'importing') && (
        <div className="flex flex-col items-center py-16 gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-lg font-medium">
            {status === 'parsing' ? 'Parsing CSV...' : 'Importing customers & vehicles...'}
          </p>
        </div>
      )}

      {status === 'done' && summary && (
        <div className="border rounded-xl p-6 bg-green-50 border-green-200 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-8 h-8 text-green-600" />
            <div>
              <p className="font-semibold text-lg text-green-800">Import Complete!</p>
              <p className="text-green-700 text-sm">{summary.customersCreated} customers · {summary.vehiclesCreated} vehicles · {summary.errors} errors</p>
            </div>
          </div>
          <Button variant="outline" onClick={() => setStatus('idle')}>Import Another File</Button>
        </div>
      )}

      {log.length > 0 && (
        <div className="mt-6 bg-muted rounded-lg p-4 max-h-60 overflow-y-auto text-sm font-mono space-y-1">
          {log.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      )}

      <MatchPhonesSection />
    </div>
  );
}

function MatchPhonesSection() {
  const [matchStatus, setMatchStatus] = useState('idle');
  const [matchResult, setMatchResult] = useState(null);

  const handleMatchFile = async (file) => {
    if (!file) return;
    setMatchStatus('uploading');
    setMatchResult(null);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setMatchStatus('matching');
    const res = await base44.functions.invoke('matchAndFillPhones', { file_url });
    setMatchResult(res.data);
    setMatchStatus('done');
  };

  return (
    <div className="mt-12 border-t pt-10">
      <div className="flex items-center gap-2 mb-2">
        <Phone className="w-5 h-5 text-primary" />
        <h2 className="text-xl font-bold">Match Missing Phones from File</h2>
      </div>
      <p className="text-muted-foreground mb-6 text-sm">Upload a tab-separated file (Customer / Email / Mobile) to automatically fill in missing phone numbers for existing customers by matching names.</p>

      {matchStatus === 'idle' && (
        <label className="flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-12 cursor-pointer transition-colors border-border hover:border-primary">
          <Phone className="w-8 h-8 text-muted-foreground mb-3" />
          <span className="font-medium">Drop your phone list file here</span>
          <span className="text-muted-foreground text-sm mt-1">Supports .txt or .csv tab-separated files</span>
          <input type="file" accept=".txt,.csv,.tsv" className="hidden" onChange={(e) => handleMatchFile(e.target.files[0])} />
        </label>
      )}

      {(matchStatus === 'uploading' || matchStatus === 'matching') && (
        <div className="flex flex-col items-center py-12 gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="font-medium">{matchStatus === 'uploading' ? 'Uploading file...' : 'Matching customers and updating phones...'}</p>
        </div>
      )}

      {matchStatus === 'done' && matchResult && (
        <div className="border rounded-xl p-6 bg-green-50 border-green-200 space-y-3">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-7 h-7 text-green-600" />
            <div>
              <p className="font-semibold text-green-800">Match Complete!</p>
              <p className="text-green-700 text-sm">{matchResult.total_updated} customers updated · {matchResult.still_missing} still missing phones</p>
            </div>
          </div>
          <div className="text-sm text-green-800 space-y-1">
            <p>✅ Exact matches: <strong>{matchResult.exact_matches_updated}</strong></p>
            <p>🔍 Partial matches: <strong>{matchResult.partial_matches_updated}</strong></p>
            <p>❓ Still missing: <strong>{matchResult.still_missing}</strong></p>
          </div>
          {matchResult.still_missing_names?.length > 0 && (
            <div className="mt-2">
              <p className="text-xs font-medium text-muted-foreground mb-1">Still missing (first 20):</p>
              <div className="bg-white rounded p-2 text-xs font-mono text-gray-600 max-h-32 overflow-y-auto">
                {matchResult.still_missing_names.map((n, i) => <div key={i}>{n}</div>)}
              </div>
            </div>
          )}
          <Button variant="outline" size="sm" onClick={() => { setMatchStatus('idle'); setMatchResult(null); }}>Run Again</Button>
        </div>
      )}
    </div>
  );
}