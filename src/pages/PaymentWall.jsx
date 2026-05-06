import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Copy, ExternalLink, Zap, HeadphonesIcon } from "lucide-react";

export default function PaymentWall() {
  const [copying, setCopying] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [txId, setTxId] = useState("");
  const [verifying, setVerifying] = useState(false);

  const walletAddress = "2SYh5UjyGEVwCMTQrY5LJrGRfEAmU9MqXECRrAMsNK34";
  const amount = "2000";

  const copyWallet = () => {
    navigator.clipboard.writeText(walletAddress);
    setCopying(true);
    setTimeout(() => setCopying(false), 2000);
  };

  const handleVerify = async () => {
    if (!txId.trim()) {
      alert("Please enter your transaction ID");
      return;
    }
    setVerifying(true);
    try {
      await base44.functions.invoke("verifyPayment", { transaction_id: txId });
      alert("Payment verified! Your account is now active.");
      window.location.href = "/";
    } catch (err) {
      alert("Failed to verify payment: " + (err?.response?.data?.error || err.message));
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="rounded-2xl border border-gray-800 bg-gray-900/50 p-8 space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-sky-500 to-purple-600 flex items-center justify-center mx-auto">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">Subscription Required</h1>
            <p className="text-gray-400 text-sm">Your free trial has ended. Activate your account to continue.</p>
          </div>

          <div className="bg-sky-500/10 border border-sky-500/30 rounded-lg p-4 space-y-3">
            <div>
              <p className="text-xs text-gray-500 mb-1">Send Amount</p>
              <p className="text-2xl font-bold text-white">{amount} USDC</p>
              <p className="text-xs text-gray-400">or equivalent in SOL</p>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-gray-500">Recipient Wallet</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={walletAddress}
                  readOnly
                  className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-xs text-gray-300 font-mono"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={copyWallet}
                  className="border-gray-700"
                >
                  <Copy className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            <a
              href={`https://solscan.io/address/${walletAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300"
            >
              View on Solscan <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          {!submitted ? (
            <Button
              onClick={() => setSubmitted(true)}
              className="w-full bg-sky-500 hover:bg-sky-600"
            >
              I've Sent Payment
            </Button>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-400 block mb-2">Transaction ID (Signature)</label>
                <input
                  type="text"
                  value={txId}
                  onChange={(e) => setTxId(e.target.value)}
                  placeholder="Paste your Solana transaction signature"
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white placeholder-gray-500"
                />
              </div>
              <Button
                onClick={handleVerify}
                disabled={verifying || !txId.trim()}
                className="w-full bg-emerald-500 hover:bg-emerald-600"
              >
                {verifying ? "Verifying..." : "Verify Payment"}
              </Button>
              <Button
                onClick={() => setSubmitted(false)}
                variant="outline"
                className="w-full border-gray-700"
              >
                Back
              </Button>
            </div>
          )}

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