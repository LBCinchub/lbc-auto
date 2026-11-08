import React from "react";
import { AlertTriangle } from "lucide-react";

// Shown while the app owner's master encryption key isn't set up, so no Stripe key can be saved yet.
export default function StripeSetupNotice({ light, isAdmin }) {
  return (
    <div role="status" className={`mb-4 flex items-start gap-2 rounded-lg border p-3 text-sm ${light ? "border-amber-300 bg-amber-50 text-amber-800" : "border-amber-500/30 bg-amber-500/10 text-amber-300"}`}>
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <p>
        {isAdmin
          ? "Setup needed: shop owners can connect Stripe here once the app's private key (SHOP_KEYS_ENCRYPTION_SECRET on the Secrets page) is at least 32 characters long."
          : "Card payments aren't available yet. Please check back soon."}
      </p>
    </div>
  );
}