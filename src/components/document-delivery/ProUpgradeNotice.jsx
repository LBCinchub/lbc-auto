import React from "react";
import { Link } from "react-router-dom";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

// Shown when the server refuses document texting for a shop that isn't confirmed on Pro.
// Uses the existing Billing page as the upgrade flow; no send control is offered here.
export default function ProUpgradeNotice({ lock, onClose }) {
  const unverified = lock?.code === "pro_unverified";
  return (
    <div role="alert" className="space-y-3 rounded-lg border border-amber-800 bg-amber-950/30 p-4 text-sm">
      <p className="flex items-center gap-2 font-semibold text-amber-200">
        <Lock className="h-4 w-4" /> {unverified ? "Pro plan couldn't be confirmed" : "Pro feature"}
      </p>
      <p className="text-gray-300">{lock?.message || "Texting estimates and invoices is included with the Pro plan ($299/mo). Nothing was sent."}</p>
      <p className="text-xs text-gray-500">Email, print and download are still available on every plan.</p>
      {!unverified && (
        <Button asChild className="bg-sky-600 hover:bg-sky-500">
          <Link to="/Billing" onClick={onClose}>Upgrade To Pro</Link>
        </Button>
      )}
    </div>
  );
}