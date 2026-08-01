import React from "react";

export default function PortalLoginForm({ form, setForm, error, loading, onSubmit, onActivate }) {
  const field = "w-full rounded-lg border border-input bg-background px-3 py-3 text-foreground";
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div><label className="mb-1 block text-sm font-medium">Shop email</label><input className={field} type="email" required value={form.shop} onChange={(e) => setForm({ ...form, shop: e.target.value })} autoComplete="organization" /></div>
      <div><label className="mb-1 block text-sm font-medium">Phone number</label><input className={field} type="tel" required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} autoComplete="tel" /></div>
      <div><label className="mb-1 block text-sm font-medium">Passcode</label><input className={field} type="password" inputMode="numeric" required value={form.passcode} onChange={(e) => setForm({ ...form, passcode: e.target.value })} autoComplete="current-password" /></div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <button disabled={loading} className="w-full rounded-lg bg-primary px-4 py-3 font-semibold text-primary-foreground disabled:opacity-50">{loading ? "Signing in…" : "Sign in"}</button>
      <button type="button" onClick={onActivate} className="w-full text-sm text-primary hover:underline">First time here? Set up your secure access</button>
    </form>
  );
}