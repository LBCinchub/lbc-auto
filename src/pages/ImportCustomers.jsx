import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Upload, CheckCircle, AlertCircle, Loader2 } from "lucide-react";

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
    </div>
  );
}