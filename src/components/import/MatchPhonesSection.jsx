import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { CheckCircle, Loader2, Phone } from "lucide-react";

export default function MatchPhonesSection() {
  const [matchStatus, setMatchStatus] = useState('idle');
  const [matchResult, setMatchResult] = useState(null);

  const handleMatchFile = async (file) => {
    if (!file) return;
    setMatchStatus('uploading');
    setMatchResult(null);
    // The list holds customer contact details, so it is stored privately and read through a short-lived link.
    const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file });
    const { signed_url } = await base44.integrations.Core.CreateFileSignedUrl({ file_uri });
    setMatchStatus('matching');
    const res = await base44.functions.invoke('matchAndFillPhones', { file_url: signed_url });
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