import React, { useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

const EXAMPLE = 'Name,Phone,Email,Address\nJane Smith,613-555-0101,jane@example.com,"12 Main St, Ottawa, ON"';

// Step 1: choose or drop a CSV file, or paste the list (CSV text or cells copied from a spreadsheet).
export default function CsvSourceInput({ onText, disabled, loading, error }) {
  const [text, setText] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const readFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => onText(String(e.target.result || ""));
    reader.readAsText(file);
  };
  return (
    <div className="space-y-5">
      <label
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition-colors ${dragOver ? "border-sky-500 bg-sky-500/5" : "border-gray-700 hover:border-sky-500"} ${disabled ? "pointer-events-none opacity-60" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); readFile(e.dataTransfer.files[0]); }}
      >
        <Upload className="mb-3 h-8 w-8 text-gray-400" />
        <span className="font-medium text-white">Choose a CSV file</span>
        <span className="mt-1 text-sm text-gray-400">or drop it here</span>
        <input type="file" accept=".csv,.tsv,.txt,text/csv" className="hidden" onChange={(e) => { readFile(e.target.files[0]); e.target.value = ""; }} />
      </label>
      <div className="space-y-2">
        <label htmlFor="customer-list-paste" className="block text-sm font-medium text-gray-300">Or paste your customer list</label>
        <textarea
          id="customer-list-paste" data-no-capitalize spellCheck={false} rows={7} value={text}
          onChange={(e) => setText(e.target.value)} placeholder={EXAMPLE}
          className="w-full rounded-lg border border-gray-700 bg-gray-900 p-3 font-mono text-sm text-white placeholder:text-gray-600 focus:border-sky-500 focus:outline-none"
        />
        <p className="text-xs text-gray-500">Start with a row of column names: Name (or First Name and Last Name), Phone, Email, Address. A Vehicle column, or Year, Make and Model, adds vehicles too.</p>
        {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
        <Button type="button" onClick={() => onText(text)} disabled={disabled || !text.trim()} className="bg-sky-500 text-white hover:bg-sky-600">
          {loading ? "Loading your customers…" : "Review customers"}
        </Button>
      </div>
    </div>
  );
}