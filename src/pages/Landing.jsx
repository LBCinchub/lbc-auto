import React from "react";
import { Button } from "@/components/ui/button";
import { Wrench, Users, FileText, Calendar, BarChart3, Zap, Gauge } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function Landing() {
  const features = [
    { icon: Gauge, title: "AI Diagnostics", desc: "Plug in a Bluetooth OBD2 scanner, get an AI root-cause diagnosis, and a draft estimate — all in the browser, no extra app" },
    { icon: Wrench, title: "Repair Orders", desc: "Manage jobs from intake to delivery" },
    { icon: Users, title: "Customer Management", desc: "Track customers and their vehicles" },
    { icon: FileText, title: "Invoicing", desc: "Generate and track invoices with payments" },
    { icon: Calendar, title: "Scheduling", desc: "Book and manage appointments" },
    { icon: BarChart3, title: "Analytics", desc: "Track revenue and business metrics" },
    { icon: Zap, title: "Time Tracking", desc: "Log mechanic hours and payroll" },
  ];

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Hero */}
      <div className="max-w-6xl mx-auto px-4 py-20">
        <div className="text-center space-y-6">
          <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center mx-auto">
            <Zap className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-5xl font-bold text-white">LBC Auto</h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Complete auto shop management system. Run your business smarter with invoicing, scheduling, and analytics.
          </p>
          <p className="text-base text-sky-400 font-medium max-w-2xl mx-auto">
            Scan the car. AI finds the root cause. The estimate writes itself — before you even close the hood.
          </p>
          <div className="flex gap-4 justify-center">
            <Button
              onClick={() => base44.auth.redirectToLogin()}
              className="bg-sky-500 hover:bg-sky-600 text-white px-8"
            >
              Get Started - 7 Days Free
            </Button>
            <Button
              variant="outline"
              className="border-gray-700 text-gray-300 px-8"
            >
              Learn More
            </Button>
          </div>
          <p className="text-sm text-gray-500">No credit card required. Full access for 7 days.</p>
        </div>
      </div>

      {/* Features Grid */}
      <div className="max-w-6xl mx-auto px-4 py-20">
        <h2 className="text-3xl font-bold text-white mb-12 text-center">Everything You Need</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, idx) => (
            <div
              key={idx}
              className="rounded-xl border border-gray-800/50 bg-gray-900/50 p-6 hover:border-sky-500/30 transition-colors"
            >
              <div className="w-12 h-12 rounded-lg bg-sky-500/10 flex items-center justify-center mb-4">
                <feature.icon className="w-6 h-6 text-sky-400" />
              </div>
              <h3 className="text-white font-semibold mb-2">{feature.title}</h3>
              <p className="text-gray-400 text-sm">{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="max-w-4xl mx-auto px-4 py-20">
        <div className="rounded-2xl border border-sky-500/30 bg-sky-500/10 p-12 text-center space-y-4">
          <h2 className="text-3xl font-bold text-white">Ready to streamline your shop?</h2>
          <p className="text-gray-400">Start your 7-day free trial. No payment method required.</p>
          <Button
            onClick={() => base44.auth.redirectToLogin()}
            className="bg-sky-500 hover:bg-sky-600 text-white px-8 mx-auto"
          >
            Create Account
          </Button>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-gray-800/50 py-8">
        <div className="max-w-6xl mx-auto px-4 text-center text-gray-500 text-sm">
          <p>&copy; 2026 LBC Auto. All rights reserved. | <a href="https://lbchub.support" target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:text-sky-300">Support</a></p>
        </div>
      </div>
    </div>
  );
}