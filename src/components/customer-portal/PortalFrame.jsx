import React from "react";
import { ShieldCheck } from "lucide-react";

export default function PortalFrame({ children }) {
  return (
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center p-5">
      <section className="w-full max-w-md rounded-2xl border border-border bg-card p-7 shadow-xl">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary"><ShieldCheck /></div>
        <h1 className="text-center text-2xl font-bold">Customer Portal</h1>
        <p className="mb-6 text-center text-sm text-muted-foreground">Secure access to your vehicle and service history</p>
        {children}
      </section>
    </main>
  );
}