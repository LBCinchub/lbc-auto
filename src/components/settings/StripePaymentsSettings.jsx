import React, { useEffect, useState } from "react";
import { CreditCard, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useTheme } from "@/lib/ThemeContext";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import StripeConnectStart from "./StripeConnectStart";
import StripeConnectDialog from "./StripeConnectDialog";
import StripeConnectedCard from "./StripeConnectedCard";

const errorOf = (e) => e?.response?.data?.error || e?.message || "Something went wrong. Please try again.";

// Optional: each shop connects its own Stripe. Saves on its own, not with "Save Settings".
export default function StripePaymentsSettings() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { toast } = useToast();
  const light = theme === "light";
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [connectOpen, setConnectOpen] = useState(false);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    base44.functions.invoke("shopStripe", { action: "status" })
      .then((res) => setStatus(res.data))
      .catch((e) => { setStatus({ connected: false }); setError(errorOf(e)); });
  }, []);

  const run = async (payload) => {
    setBusy(true);
    setError("");
    try {
      const res = await base44.functions.invoke("shopStripe", payload);
      setStatus(res.data);
      return true;
    } catch (e) {
      setError(errorOf(e));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const savePublishable = (publishable_key) => run({ action: "set_publishable_key", publishable_key });

  const connect = async (secret_key, publishable_key) => {
    const ok = await run({ action: "connect", secret_key, publishable_key });
    if (ok) {
      setConnectOpen(false);
      toast({ title: "Stripe connected", description: "You can now send card payment links from any repair order, estimate or invoice." });
    }
    return ok;
  };

  // Re-checks with the server first, so a click always ends in the connect window or a clear message.
  const startConnect = async () => {
    setError("");
    setStarting(true);
    try {
      const res = await base44.functions.invoke("shopStripe", { action: "status" });
      setStatus(res.data);
      if (res.data?.connected) return;
      if (res.data?.available === false) { setError("Stripe can't be connected yet. See the note above."); return; }
      setConnectOpen(true);
    } catch (e) {
      setError(`Couldn't start the Stripe connection: ${errorOf(e)}`);
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className={`${light ? "bg-white border-gray-200" : "bg-gray-900 border-gray-800"} border rounded-lg p-6`}>
      <div className="flex flex-wrap items-center gap-2 mb-1">
        <CreditCard className="w-5 h-5 text-sky-400" />
        <h2 className={`text-xl font-semibold ${light ? "text-gray-900" : "text-white"}`}>Card Payments (Stripe)</h2>
        <span className={`rounded-full px-2 py-0.5 text-xs ${light ? "bg-gray-100 text-gray-600" : "bg-gray-800 text-gray-400"}`}>Optional</span>
      </div>
      <p className={`${light ? "text-gray-600" : "text-gray-500"} text-sm mb-5`}>
        Connect your own Stripe account to send customers a card payment link from any repair order, estimate or invoice. The money goes straight to your Stripe, and the payment is recorded automatically.
      </p>
      {!status ? <Loader2 className="w-5 h-5 animate-spin text-gray-500" aria-label="Loading" />
        : status.connected ? <StripeConnectedCard status={status} busy={busy} light={light} onDisconnect={() => run({ action: "disconnect" })} onSavePublishable={savePublishable} />
        : <StripeConnectStart available={status.available !== false} isAdmin={user?.role === "admin"} light={light} starting={starting} onStart={startConnect} />}
      {error && !connectOpen && <p role="alert" className="mt-3 text-sm text-rose-400">{error}</p>}
      <StripeConnectDialog open={connectOpen} onOpenChange={setConnectOpen} busy={busy} error={error} light={light} onConnect={connect} />
    </div>
  );
}