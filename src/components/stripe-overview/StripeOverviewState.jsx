import React from "react";
import { Link } from "react-router-dom";
import { Loader2, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";

// Loading, error and "not connected yet" states for the Stripe overview panel.
export default function StripeOverviewState({ status, message, onRetry }) {
  return (
    <section className="dh2-section">
      <div className="flex flex-col items-center gap-3 text-center px-6 py-14">
        {status === "loading" && (
          <>
            <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
            <p className="text-gray-400 text-sm">Loading your Stripe numbers…</p>
          </>
        )}
        {status === "error" && (
          <>
            <p className="text-rose-400 text-sm max-w-md">{message}</p>
            <Button variant="outline" size="sm" onClick={onRetry} className="border-gray-700 text-gray-300">Try again</Button>
          </>
        )}
        {status === "disconnected" && (
          <>
            <CreditCard className="w-8 h-8 text-emerald-400" />
            <h2 className="text-white font-semibold text-lg">Connect Stripe to see your card revenue</h2>
            <p className="text-gray-400 text-sm max-w-md">Revenue, pending payouts and recent payments show here once your shop's Stripe account is connected.</p>
            <Button asChild size="sm" className="bg-emerald-500 hover:bg-emerald-600 text-white">
              <Link to="/Settings">Connect in Settings</Link>
            </Button>
          </>
        )}
      </div>
    </section>
  );
}