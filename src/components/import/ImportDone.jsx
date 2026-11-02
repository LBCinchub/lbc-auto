import React from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

export default function ImportDone({ result, onAgain }) {
  const { customers, vehicles, skipped, error } = result;
  return (
    <div className="space-y-4 rounded-xl border border-gray-800 bg-gray-900 p-6">
      <div className="flex items-start gap-3">
        {error ? <AlertTriangle className="h-7 w-7 shrink-0 text-amber-400" /> : <CheckCircle className="h-7 w-7 shrink-0 text-emerald-400" />}
        <div className="min-w-0">
          <p className="text-lg font-semibold text-white">{error ? "Import stopped early" : "Import complete"}</p>
          <p className="text-sm text-gray-400">
            {plural(customers, "customer")} added · {plural(vehicles, "vehicle")} added{skipped ? ` · ${skipped} not imported` : ""}
          </p>
          {error && (
            <p className="mt-2 text-sm text-amber-300">
              {error} Paste the same list again: the customers already added show up as existing, so only the rest get imported.
            </p>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button asChild className="bg-sky-500 text-white hover:bg-sky-600"><Link to="/Customers">View customers</Link></Button>
        <Button type="button" variant="outline" onClick={onAgain} className="border-gray-700 text-gray-300">Import another list</Button>
      </div>
    </div>
  );
}