import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2, FileText, Loader2, AlertCircle } from "lucide-react";

export default function InvoiceSign() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");

  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [signerName, setSignerName] = useState("");
  const [signing, setSigning] = useState(false);
  const [done, setDone] = useState(false);

  const [vehicleRecord, setVehicleRecord] = useState(null);

  useEffect(() => {
    if (!token) { setError("Invalid link."); setLoading(false); return; }
    base44.entities.Invoice.filter({ auth_token: token }).then(async results => {
      if (!results?.length) { setError("Invoice not found or link expired."); }
      else {
        const inv = results[0];
        if (inv.auth_status === "approved") setDone(true);
        setInvoice(inv);
        if (inv.vehicle_id) {
          try { setVehicleRecord(await base44.entities.Vehicle.get(inv.vehicle_id)); } catch {}
        }
      }
      setLoading(false);
    });
  }, [token]);

  const handleSign = async () => {
    if (!signerName.trim()) return;
    setSigning(true);
    await base44.entities.Invoice.update(invoice.id, {
      auth_status: "approved",
      auth_signer_name: signerName.trim(),
      auth_signed_at: new Date().toISOString(),
    });
    setDone(true);
    setSigning(false);
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-sky-400 animate-spin" />
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="text-center">
        <AlertCircle className="w-12 h-12 text-rose-400 mx-auto mb-3" />
        <p className="text-white text-lg font-semibold">{error}</p>
      </div>
    </div>
  );

  if (done) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="text-center space-y-3">
        <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto" />
        <h2 className="text-white text-2xl font-bold">Invoice Approved!</h2>
        <p className="text-gray-400">Thank you, {invoice?.auth_signer_name || "customer"}. Your approval has been recorded.</p>
        <p className="text-gray-500 text-sm">Invoice #{invoice?.invoice_number} · ${invoice?.total?.toFixed(2)}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="w-14 h-14 rounded-full bg-sky-500/20 flex items-center justify-center mx-auto mb-3">
            <FileText className="w-7 h-7 text-sky-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Invoice Authorization</h1>
          <p className="text-gray-400 text-sm mt-1">LBC Auto — Please review and approve</p>
        </div>

        {/* Invoice Summary */}
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-5 space-y-3">
          <div className="flex justify-between">
            <span className="text-gray-400 text-sm">Invoice #</span>
            <span className="text-white font-medium">{invoice.invoice_number}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400 text-sm">Customer</span>
            <span className="text-white">{invoice.customer_name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400 text-sm">Vehicle</span>
            <div className="text-right">
              <span className="text-white block">{invoice.vehicle_info}</span>
              {vehicleRecord?.license_plate && (
                <span className="text-gray-400 text-xs font-mono block mt-0.5">🪪 {vehicleRecord.license_plate.toUpperCase()}</span>
              )}
              {vehicleRecord?.vin && (
                <span className="text-gray-500 text-xs font-mono block mt-0.5">VIN: {vehicleRecord.vin.toUpperCase()}</span>
              )}
            </div>
          </div>
          {invoice.line_items?.length > 0 && (
            <div className="border-t border-gray-800 pt-3 space-y-2">
              {invoice.line_items.map((item, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-gray-400">{item.description}</span>
                  <span className="text-white">${(item.total || 0).toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
          <div className="border-t border-gray-800 pt-3 flex justify-between">
            <span className="text-white font-semibold">Total</span>
            <span className="text-sky-400 text-xl font-bold">${invoice.total?.toFixed(2)}</span>
          </div>
        </div>

        {/* Sign */}
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-5 space-y-4">
          <p className="text-gray-300 text-sm">By entering your name below, you authorize LBC Auto to proceed with this invoice.</p>
          <div>
            <label className="text-gray-400 text-sm mb-1 block">Full Name *</label>
            <Input
              value={signerName}
              onChange={e => setSignerName(e.target.value)}
              placeholder="Enter your full name"
              className="bg-gray-800 border-gray-700 text-white"
            />
          </div>
          <Button
            onClick={handleSign}
            disabled={signing || !signerName.trim()}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold"
          >
            {signing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
            Approve & Sign Invoice
          </Button>
        </div>
      </div>
      <div className="mt-12 text-center">
        <p className="text-gray-600 text-xs">Powered by <span className="text-sky-400 font-semibold">LBC.Network</span></p>
      </div>
    </div>
  );
}