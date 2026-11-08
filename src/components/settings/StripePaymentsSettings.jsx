import React, { useEffect, useState } from "react";
import { CreditCard, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useTheme } from "@/lib/ThemeContext";
import StripeConnectForm from "./StripeConnectForm";
import StripeConnectedCard from "./StripeConnectedCard";

const errorOf = (e) => e?.response?.data?.error || e?.message || "Something went wrong. Please try again.";

// Optional: each shop connects its own Stripe. Saves on its own, not with "Save Settings".
export default function StripePaymentsSettings() {
  const { theme } = useTheme();
  const light = theme === "light";
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

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
        : status.connected ? <StripeConnectedCard status={status} busy={busy} light={light} onDisconnect={() => run({ action: "disconnect" })} />
        : status.available === false ? <p className={`${light ? "text-amber-700" : "text-amber-400"} text-sm`}>Card payments aren't available yet. Please check back soon.</p>
        : <StripeConnectForm busy={busy} light={light} onConnect={(secret_key) => run({ action: "connect", secret_key })} />}
      {error && <p role="alert" className="mt-3 text-sm text-rose-400">{error}</p>}
    </div>
  );
}