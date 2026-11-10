import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { ShieldCheck } from "lucide-react";

const unwrap = (result) => result?.data || result || {};

export default function PortalAccessPanel({ customerId }) {
  const [status, setStatus] = useState(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const call = async (action) => {
    try {
      return unwrap(await base44.functions.invoke("manageCustomerPortalAccess", { customer_id: customerId, action }));
    } catch (e) {
      const code = e?.response?.status;
      setError(code === 403
        ? "Portal access isn't available for this customer because the record isn't linked to your shop yet."
        : e?.response?.data?.error || "Could not load portal access.");
      return null;
    }
  };
  const load = async () => { const data = await call("status"); if (data) { setError(""); setStatus(data); } };
  useEffect(() => { load(); }, [customerId]);
  const run = async (action) => { setBusy(true); const data = await call(action); if (data?.activation_code) setCode(data.activation_code); if (data) await load(); setBusy(false); };
  if (error && !status) return <p className="text-xs text-muted-foreground">{error}</p>;
  if (!status) return null;
  return (
    <section className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /><h2 className="font-semibold">Customer Portal Access</h2></div>
      <p className="text-sm text-muted-foreground">{status.activation_required ? "Activation Required" : status.enabled ? "Enabled" : "Disabled"} · {status.active_sessions} active session(s){status.locked_until ? " · Locked" : ""}</p>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {code && <div className="rounded-lg border border-border bg-muted p-3"><p className="text-xs text-muted-foreground">Show this once to the customer; expires in 10 minutes.</p><p className="text-2xl font-bold tracking-widest">{code}</p><button onClick={() => setCode("")} className="text-xs text-primary hover:underline">Hide code</button></div>}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={busy || !status.eligible_for_activation} onClick={() => run("issue_shop_code")}>{status.activation_required ? "Activate Portal Access" : "Reissue activation code"}</Button>
        {status.configured && <Button size="sm" variant="outline" disabled={busy} onClick={() => run(status.enabled ? "disable" : "enable")}>{status.enabled ? "Disable access" : "Enable access"}</Button>}
        <Button size="sm" variant="outline" disabled={busy || !status.locked_until} onClick={() => run("reset_lockout")}>Reset lockout</Button>
        <Button size="sm" variant="outline" disabled={busy || !status.active_sessions} onClick={() => run("revoke_sessions")}>Revoke sessions</Button>
      </div>
    </section>
  );
}