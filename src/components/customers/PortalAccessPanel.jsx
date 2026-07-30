import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { ShieldCheck } from "lucide-react";

const unwrap = (result) => result?.data || result || {};

export default function PortalAccessPanel({ customerId }) {
  const [status, setStatus] = useState(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const load = async () => setStatus(unwrap(await base44.functions.invoke("manageCustomerPortalAccess", { customer_id: customerId, action: "status" })));
  useEffect(() => { load(); }, [customerId]);
  const run = async (action) => { setBusy(true); const data = unwrap(await base44.functions.invoke("manageCustomerPortalAccess", { customer_id: customerId, action })); if (data.activation_code) setCode(data.activation_code); await load(); setBusy(false); };
  if (!status) return null;
  return (
    <section className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /><h2 className="font-semibold">Customer Portal Access</h2></div>
      <p className="text-sm text-muted-foreground">{status.configured ? status.enabled ? "Enabled" : "Disabled" : "Passcode not configured"} · {status.active_sessions} active session(s){status.locked_until ? " · Locked" : ""}</p>
      {code && <div className="rounded-lg border border-border bg-muted p-3"><p className="text-xs text-muted-foreground">Show this once to the customer; expires in 10 minutes.</p><p className="text-2xl font-bold tracking-widest">{code}</p><button onClick={() => setCode("")} className="text-xs text-primary hover:underline">Hide code</button></div>}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={busy} onClick={() => run("issue_shop_code")}>Issue activation code</Button>
        {status.configured && <Button size="sm" variant="outline" disabled={busy} onClick={() => run(status.enabled ? "disable" : "enable")}>{status.enabled ? "Disable access" : "Enable access"}</Button>}
        <Button size="sm" variant="outline" disabled={busy || !status.locked_until} onClick={() => run("reset_lockout")}>Reset lockout</Button>
        <Button size="sm" variant="outline" disabled={busy || !status.active_sessions} onClick={() => run("revoke_sessions")}>Revoke sessions</Button>
      </div>
    </section>
  );
}