import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Zap, HeadphonesIcon, Check, Loader2, CreditCard, Lock } from "lucide-react";

const PLANS = {
  basic: { label: "Basic", price: 199, desc: "Everything except LBC AI Diagnostics" },
  pro:   { label: "Pro",   price: 299, desc: "All features, including LBC AI Diagnostics" },
};

const SETUP_FEE = 3000;

export default function PaymentWall() {
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [selectedTier, setSelectedTier] = useState("pro");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [iframeBlocked, setIframeBlocked] = useState(false);

  useEffect(() => {
    // Stripe Checkout cannot run inside an iframe (e.g. the builder preview).
    if (window.self !== window.top) {
      setIframeBlocked(true);
    }
    base44.auth.me()
      .then((u) => {
        setUser(u);
        if (u?.plan_tier) setSelectedTier(u.plan_tier);
      })
      .finally(() => setLoadingUser(false));
  }, []);

  const isSetupPhase = !user?.setup_fee_paid;
  const plan = PLANS[user?.plan_tier || selectedTier];
  const todayTotal = isSetupPhase ? SETUP_FEE + plan.price : plan.price;

  const handleCheckout = async () => {
    setError("");
    if (iframeBlocked) return;

    setCreating(true);
    try {
      const res = await base44.functions.invoke("createStripeCheckout", {
        plan_tier: selectedTier,
        phase: isSetupPhase ? "setup" : "renewal",
        success_url: window.location.origin + "/",
        cancel_url: window.location.origin + "/PaymentWall",
      });
      const url = res?.data?.url || res?.url;
      if (!url) throw new Error("No checkout URL returned");
      window.location.href = url;
    } catch (err) {
      setError(err?.response?.data?.error || err.message || "Could not start checkout");
      setCreating(false);
    }
  };

  if (loadingUser) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-sky-400 animate-spin" />
      </div>
    );
  }

  if (iframeBlocked) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-2xl border border-gray-800 bg-gray-900/50 p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-bold text-white">Checkout unavailable in preview</h1>
          <p className="text-gray-400 text-sm">
            Secure card checkout only works in the published app. Open the published app in a new tab to complete your subscription.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="rounded-2xl border border-gray-800 bg-gray-900/50 p-8 space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-sky-500 to-purple-600 flex items-center justify-center mx-auto">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">
              {isSetupPhase ? "Activate Your Account" : "Subscription Renewal"}
            </h1>
            <p className="text-gray-400 text-sm">
              {isSetupPhase
                ? "Your 7-day free trial has ended. Complete setup and your monthly plan to activate full access."
                : "Your monthly billing period has ended. Renew to keep access."}
            </p>
          </div>

          {isSetupPhase && (
            <div className="space-y-2">
              <p className="text-xs text-gray-500">Choose your monthly plan (starts after this setup payment)</p>
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(PLANS).map(([key, p]) => (
                  <button
                    key={key}
                    onClick={() => setSelectedTier(key)}
                    className={`text-left rounded-lg border p-3 transition-colors ${
                      selectedTier === key
                        ? "border-sky-500 bg-sky-500/10"
                        : "border-gray-700 bg-gray-800/50 hover:border-gray-600"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-white">{p.label}</span>
                      {selectedTier === key && <Check className="w-4 h-4 text-sky-400" />}
                    </div>
                    <p className="text-lg font-bold text-white mt-1">${p.price}<span className="text-xs text-gray-400 font-normal">/mo</span></p>
                    <p className="text-[11px] text-gray-400 mt-1">{p.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Price breakdown */}
          <div className="bg-sky-500/10 border border-sky-500/30 rounded-lg p-4 space-y-2">
            {isSetupPhase ? (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">One-time setup & training</span>
                  <span className="text-white font-semibold">${SETUP_FEE.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">{plan.label} plan — first month</span>
                  <span className="text-white font-semibold">${plan.price}</span>
                </div>
                <div className="border-t border-sky-500/30 pt-2 flex items-center justify-between">
                  <span className="text-gray-300 text-sm">Due today</span>
                  <span className="text-2xl font-bold text-white">${todayTotal.toLocaleString()}</span>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500">{plan.label} plan — monthly renewal</p>
                  <p className="text-2xl font-bold text-white">${plan.price}</p>
                </div>
                <p className="text-xs text-gray-400">Then ${plan.price}/mo</p>
              </div>
            )}
          </div>

          {error && (
            <p className="text-sm text-red-400 text-center">{error}</p>
          )}

          <Button
            onClick={handleCheckout}
            disabled={creating}
            className="w-full bg-sky-500 hover:bg-sky-600"
          >
            {creating ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Redirecting to checkout…</>
            ) : (
              <><CreditCard className="w-4 h-4 mr-2" /> Pay with Card</>
            )}
          </Button>

          <p className="text-center text-[11px] text-gray-500 flex items-center justify-center gap-1.5">
            <Lock className="w-3 h-3" /> Secure payment powered by Stripe
          </p>

          <div className="text-center">
            <a
              href="mailto:lbchub.support"
              className="inline-flex items-center gap-2 text-xs text-sky-400 hover:text-sky-300 transition-colors"
            >
              <HeadphonesIcon className="w-3.5 h-3.5" />
              Questions? Contact lbchub.support
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}