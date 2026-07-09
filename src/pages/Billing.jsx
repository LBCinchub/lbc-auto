import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { CreditCard, Calendar, CheckCircle2, Clock, ArrowLeft, Check, Loader2, Gauge } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";

const PLANS = {
  basic: { label: "Basic", price: 199, desc: "Everything except LBC AI Diagnostics" },
  pro:   { label: "Pro",   price: 299, desc: "All features, including LBC AI Diagnostics" },
};

export default function Billing() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [trialDaysLeft, setTrialDaysLeft] = useState(0);
  const [switchingTier, setSwitchingTier] = useState(false);

  useEffect(() => {
    const loadUser = async () => {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      if (currentUser?.trial_started_date) {
        const trialStart = new Date(currentUser.trial_started_date);
        const trialEnd = new Date(trialStart);
        trialEnd.setDate(trialEnd.getDate() + 7);
        const now = new Date();
        const daysLeft = Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24));
        setTrialDaysLeft(Math.max(0, daysLeft));
      }
    };
    loadUser();
  }, []);

  const currentTier = user?.plan_tier ? PLANS[user.plan_tier] : null;

  const handleSwitchTier = async (tier) => {
    if (tier === user?.plan_tier || switchingTier) return;
    setSwitchingTier(true);
    try {
      const updated = await base44.auth.updateMe({ plan_tier: tier });
      setUser(updated);
    } finally {
      setSwitchingTier(false);
    }
  };

  return (
    <div className="space-y-8">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sky-400 hover:text-sky-300 transition-colors mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="text-sm font-medium">Back</span>
      </button>
      <PageHeader title="Billing & Subscription" subtitle="Manage your account and payment" />

      {/* Trial Status */}
      {user?.subscription_status === 'trial' && (
        <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-6 space-y-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-sky-500/20 flex items-center justify-center flex-shrink-0">
              <Clock className="w-6 h-6 text-sky-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-white mb-1">7-Day Free Trial</h3>
              <p className="text-sky-200">{trialDaysLeft} days remaining</p>
            </div>
          </div>
          <div className="w-full bg-sky-500/20 rounded-full h-2 overflow-hidden">
            <div
              className="bg-sky-500 h-full transition-all"
              style={{ width: `${Math.max(0, (trialDaysLeft / 7) * 100)}%` }}
            />
          </div>
          <p className="text-sm text-sky-200">Full access to all features. No payment required.</p>
        </div>
      )}

      {/* Active Subscription */}
      {user?.subscription_status === 'active' && (
        <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-6 space-y-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-green-500/20 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-6 h-6 text-green-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-white mb-1">
                Active — {currentTier?.label || "—"} Plan (${currentTier?.price || "—"}/mo)
              </h3>
              <p className="text-green-200">
                {user?.next_billing_date
                  ? `Renews by ${new Date(user.next_billing_date).toLocaleDateString()}`
                  : "Account verified"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Plan picker */}
      {user?.subscription_status === 'active' && (
        <div className="rounded-xl border border-gray-800/50 bg-gray-900/50 p-6 space-y-4">
          <div className="flex items-center gap-3">
            <Gauge className="w-5 h-5 text-sky-400" />
            <h3 className="font-semibold text-white">Your Plan</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Object.entries(PLANS).map(([key, plan]) => (
              <button
                key={key}
                onClick={() => handleSwitchTier(key)}
                disabled={switchingTier}
                className={`text-left rounded-lg border p-4 transition-colors ${
                  user?.plan_tier === key
                    ? "border-sky-500 bg-sky-500/10"
                    : "border-gray-700 bg-gray-800/50 hover:border-gray-600"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-white">{plan.label}</span>
                  {user?.plan_tier === key && <Check className="w-4 h-4 text-sky-400" />}
                </div>
                <p className="text-xl font-bold text-white mt-1">${plan.price}<span className="text-xs text-gray-400 font-normal">/mo</span></p>
                <p className="text-xs text-gray-400 mt-1">{plan.desc}</p>
              </button>
            ))}
          </div>
          {switchingTier && (
            <p className="text-xs text-gray-500 flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" /> Updating plan...</p>
          )}
          <p className="text-xs text-gray-500">
            Plan changes take effect on your next renewal payment — no charge today.
          </p>
        </div>
      )}

      {/* Payment Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-xl border border-gray-800/50 bg-gray-900/50 p-6 space-y-4">
          <div className="flex items-center gap-3">
            <CreditCard className="w-5 h-5 text-sky-400" />
            <h3 className="font-semibold text-white">Payment Method</h3>
          </div>
          <p className="text-gray-400 text-sm">Solana Wallet (USDC)</p>
        </div>

        <div className="rounded-xl border border-gray-800/50 bg-gray-900/50 p-6 space-y-4">
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-sky-400" />
            <h3 className="font-semibold text-white">Next Payment</h3>
          </div>
          <p className="text-gray-400 text-sm">
            {user?.subscription_status === 'trial'
              ? 'Due after trial ends'
              : user?.next_billing_date
                ? new Date(user.next_billing_date).toLocaleDateString()
                : '—'}
          </p>
        </div>
      </div>

      {/* Payment Instructions */}
      {user?.subscription_status !== 'active' && (
        <div className="rounded-xl border border-gray-800/50 bg-gray-900/50 p-6 space-y-4">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-sky-500 text-white text-xs flex items-center justify-center font-bold">i</span>
            Ready to activate?
          </h3>
          <p className="text-gray-400">
            One-time $2,999 setup covers onboarding + 4 days of on-site training. Then $199/mo (Basic) or $299/mo (Pro, includes AI Diagnostics).
          </p>
          <Button
            onClick={() => window.location.href = '/PaymentWall'}
            className="bg-sky-500 hover:bg-sky-600 text-white w-full sm:w-auto"
          >
            Complete Payment
          </Button>
        </div>
      )}
    </div>
  );
}
