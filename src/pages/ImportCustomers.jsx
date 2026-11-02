import React, { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import PageHeader from "@/components/shared/PageHeader";
import CsvSourceInput from "@/components/import/CsvSourceInput";
import ImportReview from "@/components/import/ImportReview";
import ImportDone from "@/components/import/ImportDone";
import MatchPhonesSection from "@/components/import/MatchPhonesSection";
import { fetchShopCustomers } from "@/lib/shopCustomers";
import { readCustomerCsv } from "@/lib/customerCsv";
import { indexCustomers } from "@/lib/customerImportChecks";
import { importCustomers } from "@/lib/customerImport";

// Import a customer list in three steps: supply it (file or paste), review duplicates and
// missing details, then save the chosen customers.
export default function ImportCustomers() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  // The shop's current customers, so the review can point out the ones already on file.
  const { data: customers, isError } = useQuery({
    queryKey: ["customers", "import-check", user?.email],
    queryFn: () => fetchShopCustomers(user),
    enabled: !!user,
  });
  const existing = useMemo(() => customers && indexCustomers(customers), [customers]);
  const [parsed, setParsed] = useState(null);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(null);
  const [result, setResult] = useState(null);

  const review = (text) => {
    const next = readCustomerCsv(text);
    if (next.error || !next.entries.length) {
      setError(next.error || "No customers found in that list.");
      return;
    }
    setError("");
    setParsed(next);
  };

  const runImport = async (items) => {
    setProgress({ done: 0, total: items.length });
    const outcome = await importCustomers(items, user.email, (done) => setProgress({ done, total: items.length }));
    queryClient.invalidateQueries({ queryKey: ["customers"] });
    queryClient.invalidateQueries({ queryKey: ["vehicles"] });
    setResult({ ...outcome, skipped: parsed.entries.length - items.length });
    setParsed(null);
    setProgress(null);
  };

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="Import Customers & Vehicles"
        subtitle="Add a customer list from a CSV file or by pasting it. You review duplicates and missing details before anything is saved."
      />
      {progress ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <Loader2 className="h-9 w-9 animate-spin text-sky-400" />
          <p className="font-medium text-white">Importing customers… {progress.done} of {progress.total}</p>
        </div>
      ) : result ? (
        <ImportDone result={result} onAgain={() => setResult(null)} />
      ) : parsed ? (
        <ImportReview parsed={parsed} existing={existing} onImport={runImport} onCancel={() => setParsed(null)} />
      ) : (
        <CsvSourceInput
          onText={review}
          disabled={!existing}
          loading={!existing && !isError}
          error={isError ? "Couldn't load your current customers to check for duplicates. Refresh the page to try again." : error}
        />
      )}
      <MatchPhonesSection />
    </div>
  );
}