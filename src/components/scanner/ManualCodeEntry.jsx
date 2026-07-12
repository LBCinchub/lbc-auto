import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Type, ArrowRight, AlertTriangle } from "lucide-react";
import { parseDtcInput, validateDtcCode } from "@/lib/dtcDatabase";

export default function ManualCodeEntry({ onSubmit }) {
  const [input, setInput] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = () => {
    const codes = parseDtcInput(input);
    if (codes.length === 0) {
      setError("Enter valid DTC codes (e.g. P0300, P0420, C0035). Format: letter P/B/C/U + 3-4 digits.");
      return;
    }
    const invalid = input.split(",").map(c => c.trim().toUpperCase()).filter(c => c && !validateDtcCode(c));
    if (invalid.length > 0) {
      setError(`Invalid code(s): ${invalid.join(", ")}. Use format like P0300.`);
      return;
    }
    setError("");
    setInput("");
    onSubmit(codes);
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3">
      <h2 className="text-white font-semibold text-sm flex items-center gap-2">
        <Type className="w-4 h-4 text-sky-400" /> ENTER CODES MANUALLY
      </h2>
      <p className="text-xs text-gray-500">
        Enter DTC codes separated by commas (e.g. P0300, P0420, C0035).
      </p>
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder="P0300, P0420, C0035"
          className="flex-1 bg-gray-800 border border-gray-700 text-white font-mono rounded-md px-3 py-2 text-sm placeholder:text-gray-600 focus:outline-none focus:border-sky-500"
        />
        <Button
          onClick={handleSubmit}
          size="sm"
          className="bg-sky-500 hover:bg-sky-600 text-white gap-2"
        >
          Submit <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
      {error && (
        <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-md p-2 flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {error}
        </div>
      )}
    </div>
  );
}