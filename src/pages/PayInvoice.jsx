import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import PaymentConfirmationCard from "@/components/payments/PaymentConfirmationCard";
import { downloadReceipt } from "@/components/payments/paymentReceipt";

const money = (r) => `$${Number(r.amount || 0).toFixed(2)}${r.currency ? ` ${r.currency}` : ""}`;

// Public page behind a shop's card payment link: sends the customer to Stripe Checkout,
// then shows the Stripe-verified result when they come back.
export default function PayInvoice() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("t") || "";
  const returned = params.has("paid") || params.has("cancelled");
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!token) { setResult({ state: "invalid" }); return; }
    base44.functions.invoke("publicCardPayment", { token })
      .then((res) => (res.data.state === "pay" && !returned ? window.location.replace(res.data.url) : setResult(res.data)))
      .catch((e) => setResult({ state: [400, 404].includes(e?.response?.status) ? "invalid" : "error" }));
  }, [token]);

  // A link that doesn't exist is a real 404 for crawlers.
  useEffect(() => {
    if (result?.state !== "invalid") return;
    const meta = Object.assign(document.createElement("meta"), { name: "prerender-status-code", content: "404" });
    document.head.appendChild(meta);
    return () => meta.remove();
  }, [result?.state]);

  if (!result) return (
    <div className="pc-section">
      <Loader2 className="pc-spinner h-8 w-8 animate-spin" />
      <p className="pc-wait">Opening secure checkout…</p>
    </div>
  );
  if (result.state === "paid") return <PaymentConfirmationCard heading="Payment received!" detail={[result.invoice_number, money(result)]} action={{ label: "Save receipt", doneLabel: "Receipt saved", onClick: () => downloadReceipt(result) }} />;
  if (result.state === "pay") return <PaymentConfirmationCard tone="warning" heading="Payment not completed" detail={["No charge was made"]} action={{ label: "Try again", onClick: () => window.location.assign(result.url) }} />;
  if (result.state === "closed") return <PaymentConfirmationCard tone="warning" heading="This link has expired" detail={["Ask the shop for a new payment link"]} />;
  if (result.state === "error") return <PaymentConfirmationCard tone="warning" heading="Something went wrong" detail={["Please try again in a moment"]} action={{ label: "Try again", onClick: () => window.location.reload() }} />;
  return <PaymentConfirmationCard tone="warning" heading="Payment link not found" detail={["Check the link or contact the shop"]} />;
}