import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { CreditCard, Calendar, CheckCircle2, Clock } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";

export default function Billing() {
  const [user, setUser] = useState(null);
  const [trialDaysLeft, setTrialDaysLeft] = useState(0);

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

  return (
    <div className="space-y-8">
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
              <h3 className="text-lg font-semibold text-white mb-1">Active Subscription</h3>
              <p className="text-green-200">Your account is active and verified</p>
            </div>
          </div>
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
            {user?.subscription_status === 'trial' ? 'Due after trial ends' : 'Automatic renewal'}
          </p>
        </div>
      </div>

      {/* Payment Instructions */}
      {user?.subscription_status !== 'active' && (
        <div className="rounded-xl border border-gray-800/50 bg-gray-900/50 p-6 space-y-4">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-sky-500 text-white text-xs flex items-center justify-center font-bold">i</span>
            Ready to upgrade?
          </h3>
          <p className="text-gray-400">Send $2,000 USDC to upgrade your account and continue after your trial.</p>
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