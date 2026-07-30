import React from "react";

export default function PortalActivationForm({ form, setForm, requested, error, notice, loading, onRequest, onSetup, onBack }) {
  const field = "w-full rounded-lg border border-input bg-background px-3 py-3 text-foreground";
  return (
    <form onSubmit={requested ? onSetup : onRequest} className="space-y-4">
      <button type="button" onClick={onBack} className="text-sm text-primary hover:underline">← Back to sign in</button>
      <div><label className="mb-1 block text-sm font-medium">Shop email</label><input className={field} type="email" required value={form.shop} onChange={(e) => setForm({ ...form, shop: e.target.value })} /></div>
      <div><label className="mb-1 block text-sm font-medium">Phone number</label><input className={field} type="tel" required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
      {requested && <><div><label className="mb-1 block text-sm font-medium">6-digit activation code</label><input className={field} inputMode="numeric" required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></div><div><label className="mb-1 block text-sm font-medium">Create passcode</label><input className={field} type="password" inputMode="numeric" required minLength={6} value={form.newPasscode} onChange={(e) => setForm({ ...form, newPasscode: e.target.value })} /><p className="mt-1 text-xs text-muted-foreground">Use 6–12 digits; avoid repeated or sequential numbers.</p></div></>}
      {notice && <p className="text-sm text-muted-foreground">{notice}</p>}{error && <p className="text-sm text-destructive">{error}</p>}
      <button disabled={loading} className="w-full rounded-lg bg-primary px-4 py-3 font-semibold text-primary-foreground disabled:opacity-50">{loading ? "Please wait…" : requested ? "Create passcode" : "Request activation"}</button>
    </form>
  );
}