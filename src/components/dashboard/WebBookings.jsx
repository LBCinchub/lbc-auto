import React from "react";
import { useNavigate } from "react-router-dom";
import { Globe, ChevronRight, ExternalLink, Sparkles } from "lucide-react";

/**
 * Web Bookings tile — tenant-aware.
 * - If the shop has a connected website (lbchub.ink slug), shows their web bookings.
 * - If not, shows an LBC promo card to get their website built.
 *
 * Props:
 *   appointments — full appointment list (already scoped by user)
 *   user         — current authenticated user object (has business_name, email, etc.)
 */
export default function WebBookings({ appointments = [], user = null }) {
  const navigate = useNavigate();

  // Determine if this shop has a connected LBC website
  // We check if any appointment has source === "web_booking" as a proxy,
  // OR if the user has a business_name (used to build their slug).
  // Only Haj Rims (hajwheels@gmail.com) is currently live — all others get the promo.
  const LIVE_WEBSITE_SHOPS = ["hajwheels@gmail.com"];
  const hasWebsite = user?.email && LIVE_WEBSITE_SHOPS.includes(user.email);

  // ── NO WEBSITE — show promo ─────────────────────────────────────────────────
  if (!hasWebsite) {
    const shopSlug = (user?.business_name || "yourshop")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");

    return (
      <div className="rounded-xl border border-blue-500/30 bg-gradient-to-br from-blue-500/10 to-gray-900/50 p-6 flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-blue-500/20">
            <Globe className="w-7 h-7 text-blue-400" />
          </div>
          <div>
            <p className="text-base text-white font-semibold">Your LBC Website</p>
            <p className="text-xs text-gray-400">Not connected yet</p>
          </div>
        </div>

        {/* Promo copy */}
        <div className="rounded-lg bg-blue-500/5 border border-blue-500/20 p-4 space-y-2">
          <p className="text-sm text-gray-300 font-medium flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-400 flex-shrink-0" />
            Get your shop online with LBC
          </p>
          <p className="text-xs text-gray-400 leading-relaxed">
            We build you a branded website at{" "}
            <span className="text-blue-300 font-mono">lbchub.ink/{shopSlug || "yourshop"}</span>.
            Customers can book appointments 24/7, chat with your AI, and get instant quotes — all without calling.
          </p>
          <ul className="text-xs text-gray-400 space-y-1 mt-1">
            <li className="flex items-center gap-2"><span className="text-emerald-400">✓</span> AI-powered booking widget</li>
            <li className="flex items-center gap-2"><span className="text-emerald-400">✓</span> Auto-synced with your dashboard</li>
            <li className="flex items-center gap-2"><span className="text-emerald-400">✓</span> Your logo, your branding</li>
            <li className="flex items-center gap-2"><span className="text-emerald-400">✓</span> Included with Pro plan</li>
          </ul>
        </div>

        {/* CTA */}
        <a
          href="mailto:tarek-samara@lbc-hub.com?subject=Website Request — LBC Auto&body=Hi, I'd like to get my shop website set up on lbc-hub.com"
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 transition-colors text-white text-sm font-semibold"
        >
          <ExternalLink className="w-4 h-4" />
          Request Your Website
        </a>
      </div>
    );
  }

  // ── HAS WEBSITE — show web bookings ────────────────────────────────────────
  const webBookings = (appointments || []).filter(a => a.source === "web_booking");

  const now = new Date();
  const monthWebBookings = webBookings.filter(a => {
    if (!a.date) return false;
    const d = new Date(a.date + "T12:00:00");
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const recentWebBookings = [...webBookings]
    .sort((a, b) => (b.created_date || b.date || "").localeCompare(a.created_date || a.date || ""))
    .slice(0, 3);

  // Build their slug from business_name
  const shopSlug = (user?.business_name || "shop")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

  return (
    <div className="rounded-xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-gray-900/50 p-6">
      {/* Connected indicator */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          <span className="text-emerald-400 text-xs font-bold tracking-wide">
            🌐 Connected: lbchub.ink/{shopSlug}
          </span>
        </div>
        <button
          onClick={() => navigate("/Appointments")}
          className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
        >
          View all →
        </button>
      </div>

      {/* Count this month */}
      <div className="flex items-center gap-3 mb-4">
        <div className="p-3 rounded-xl bg-emerald-500/20">
          <Globe className="w-7 h-7 text-emerald-400" />
        </div>
        <div>
          <p className="text-base text-gray-300 font-semibold">Web Bookings</p>
          <p className="text-4xl font-bold text-white leading-none mt-1">
            {monthWebBookings.length}
            <span className="text-sm font-normal text-gray-400 ml-2">this month</span>
          </p>
        </div>
      </div>

      {/* 3 most recent */}
      <div className="space-y-2">
        {recentWebBookings.length === 0 && (
          <p className="text-gray-500 text-sm text-center py-4">No web bookings yet</p>
        )}
        {recentWebBookings.map((appt) => {
          const apptDate = appt.date
            ? new Date(appt.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })
            : "—";
          return (
            <button
              key={appt.id}
              onClick={() => navigate("/Appointments")}
              className="w-full flex items-center justify-between p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20 hover:bg-emerald-500/10 transition-colors text-left gap-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm text-blue-400 font-medium truncate capitalize">
                    {appt.customer_name || "—"}
                  </p>
                  <span className="text-[9px] font-bold tracking-wide px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex-shrink-0">
                    🌐 WEB
                  </span>
                </div>
                <p className="text-sm text-gray-400 truncate capitalize mt-0.5">
                  {appt.service_type || "—"}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs text-gray-400">{apptDate}</span>
                <ChevronRight className="w-4 h-4 text-gray-600" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
