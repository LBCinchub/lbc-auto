import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import {
  LayoutDashboard,
  Users,
  Car,
  Wrench,
  Package,
  FileText,
  Calendar,
  HardHat,
  BarChart3,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Zap,
  Clock,
  Banknote,
  Settings as SettingsIcon,
  LogOut,
  HelpCircle,
  CreditCard,
  Sun,
  Moon,
  FileUp,
  Search,
  Tablet,
  Store,
  Gauge,
  MessageSquare
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/ThemeContext";
import GlobalSearch from "@/components/shared/GlobalSearch";

const navItems = [
  { name: "Dashboard",     icon: LayoutDashboard, page: "Dashboard",       color: "from-sky-500 to-blue-600",      light: "bg-sky-50 text-sky-700 border-sky-200",           dark: "bg-sky-500/15 text-sky-400 border-sky-500/30",       label: "text-sky-400" },
  { name: "Customers",     icon: Users,           page: "Customers",        color: "from-violet-500 to-purple-600", light: "bg-violet-50 text-violet-700 border-violet-200",  dark: "bg-violet-500/15 text-violet-400 border-violet-500/30", label: "text-violet-400" },
  { name: "Vehicles",      icon: Car,             page: "Vehicles",         color: "from-blue-500 to-cyan-600",     light: "bg-blue-50 text-blue-700 border-blue-200",        dark: "bg-blue-500/15 text-blue-400 border-blue-500/30",    label: "text-blue-400" },
  { name: "Appointments",  icon: Calendar,        page: "Appointments",     color: "from-amber-500 to-orange-500",  light: "bg-amber-50 text-amber-700 border-amber-200",     dark: "bg-amber-500/15 text-amber-400 border-amber-500/30", label: "text-amber-400" },
  { name: "Estimates",     icon: ClipboardList,   page: "Estimates",        color: "from-teal-500 to-emerald-600",  light: "bg-teal-50 text-teal-700 border-teal-200",        dark: "bg-teal-500/15 text-teal-400 border-teal-500/30",    label: "text-teal-400" },
  { name: "Repair Orders", icon: Wrench,          page: "RepairOrders",     color: "from-orange-500 to-red-500",    light: "bg-orange-50 text-orange-700 border-orange-200",  dark: "bg-orange-500/15 text-orange-400 border-orange-500/30", label: "text-orange-400" },
  { name: "Invoices",      icon: FileText,        page: "Invoices",         color: "from-emerald-500 to-green-600", light: "bg-emerald-50 text-emerald-700 border-emerald-200", dark: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", label: "text-emerald-400" },
  { name: "Parts",         icon: Package,         page: "Parts",            color: "from-indigo-500 to-blue-600",   light: "bg-indigo-50 text-indigo-700 border-indigo-200",  dark: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30", label: "text-indigo-400" },
  { name: "Parts Lookup",  icon: Search,          page: "PartsLookup",      color: "from-cyan-500 to-sky-600",      light: "bg-cyan-50 text-cyan-700 border-cyan-200",        dark: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",    label: "text-cyan-400" },
  { name: "AI Scanner",    icon: Gauge,           page: "Diagnostics",      color: "from-fuchsia-500 to-pink-600",   light: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200", dark: "bg-fuchsia-500/15 text-fuchsia-400 border-fuchsia-500/30", label: "text-fuchsia-400", proOnly: true },
  { name: "Team",          icon: HardHat,         page: "Mechanics",        color: "from-rose-500 to-pink-600",     light: "bg-rose-50 text-rose-700 border-rose-200",        dark: "bg-rose-500/15 text-rose-400 border-rose-500/30",    label: "text-rose-400" },
  { name: "Time Tracking", icon: Clock,           page: "TimeTracking",     color: "from-yellow-500 to-amber-500",  light: "bg-yellow-50 text-yellow-700 border-yellow-200",  dark: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30", label: "text-yellow-500" },
  { name: "Payroll",       icon: Banknote,        page: "Payroll",          color: "from-green-500 to-teal-500",    light: "bg-green-50 text-green-700 border-green-200",     dark: "bg-green-500/15 text-green-400 border-green-500/30", label: "text-green-400" },
  { name: "Analytics",     icon: BarChart3,       page: "Analytics",        color: "from-purple-500 to-violet-600", light: "bg-purple-50 text-purple-700 border-purple-200",  dark: "bg-purple-500/15 text-purple-400 border-purple-500/30", label: "text-purple-400" },
  { name: "Import",        icon: FileUp,          page: "ImportCustomers",  color: "from-gray-500 to-slate-600",    light: "bg-gray-50 text-gray-700 border-gray-200",        dark: "bg-gray-500/15 text-gray-400 border-gray-500/30",    label: "text-slate-400", path: "/ImportCustomers" },
  { name: "Customer Hub",  icon: Store,           page: "CustomerHub",      color: "from-sky-400 to-cyan-500",      light: "bg-sky-500/20",   text: "text-sky-400" },
  { name: "Chat Inbox",   icon: MessageSquare,   page: "ChatInbox",        color: "from-cyan-500 to-blue-500",     light: "bg-cyan-50 text-cyan-700 border-cyan-200",   dark: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30", label: "text-cyan-400", path: "/ChatInbox" },
];

export default function Sidebar({ currentPage }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === "light";

  useEffect(() => {
    const loadUser = async () => {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    };
    loadUser();
    window.addEventListener("lbc:settings-saved", loadUser);
    return () => window.removeEventListener("lbc:settings-saved", loadUser);
  }, []);

  // Poll unread chat messages every 30s
  useEffect(() => {
    const loadUnread = async () => {
      try {
        const unread = await base44.entities.ChatMessage.filter({ is_read: false }, null, 100);
        setUnreadCount(unread.length);
      } catch {}
    };
    loadUnread();
    const interval = setInterval(loadUnread, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className={cn("lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg shadow-lg", isLight ? "bg-white text-gray-800 border border-gray-200" : "bg-gray-900 text-white")}
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 bg-black/60 z-40 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-50 flex flex-col transition-all duration-300",
          "h-screen overflow-hidden",
          isLight ? "bg-white border-r border-gray-200" : "bg-gray-950 border-r border-gray-800/50",
          collapsed ? "w-[72px]" : "w-64",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Logo — fixed, never scrolls */}
        <div className={cn("flex-shrink-0 h-16 flex items-center px-4 border-b", isLight ? "border-gray-200" : "border-gray-800/50")}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center flex-shrink-0">
              <Zap className="w-5 h-5 text-white" />
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <h1 className={cn("font-bold text-lg leading-tight tracking-tight", isLight ? "text-gray-900" : "text-white")}>LBC Auto</h1>
                <p className="text-[10px] text-sky-400 tracking-wider uppercase">Smart Management</p>
              </div>
            )}
          </div>
          <button onClick={() => setMobileOpen(false)} className="lg:hidden ml-auto text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search — fixed, never scrolls */}
        {!collapsed && (
          <div className={cn("flex-shrink-0 px-3 py-2 border-b", isLight ? "border-gray-200" : "border-gray-800/50")}>
            <GlobalSearch />
          </div>
        )}

        {/* Nav — ONLY this section scrolls */}
        <nav className="flex-1 py-3 px-2 overflow-y-auto overflow-x-hidden">
          <div className="space-y-1">
            {navItems.map((item) => {
              const isActive = currentPage === item.page;
              return (
                <Link
                  key={item.page}
                  to={item.path || createPageUrl(item.page)}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "relative flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm font-medium transition-all duration-150 border",
                    isActive
                      ? isLight ? item.light : item.dark
                      : isLight
                        ? "border-transparent text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                        : "border-transparent text-gray-400 hover:bg-gray-800/50 hover:text-white"
                  )}
                >
                  {/* Color icon box */}
                  <div className={cn(
                    "flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center",
                    isActive
                      ? `bg-gradient-to-br ${item.color}`
                      : isLight ? "bg-gray-100" : "bg-gray-800"
                  )}>
                    <item.icon className={cn(
                      "w-4 h-4",
                      isActive ? "text-white" : isLight ? "text-gray-500" : item.label
                    )} />
                  </div>
                  {!collapsed && (
                    <span className={cn(
                      "truncate font-medium",
                      isActive
                        ? "text-white"
                        : isLight
                          ? "text-gray-600 hover:text-gray-900"
                          : item.label
                    )}>{item.name}</span>
                  )}
                  {item.proOnly && user?.plan_tier !== "pro" && user?.plan_tier !== "legacy" && !collapsed && (
                    <span className="ml-auto text-[9px] font-bold tracking-wide px-1.5 py-0.5 rounded bg-fuchsia-500/20 text-fuchsia-400 border border-fuchsia-500/30 flex-shrink-0">
                      PRO
                    </span>
                  )}
                  {item.name === "Chat Inbox" && unreadCount > 0 ? (
                    <>
                      {!collapsed && (
                        <span className="ml-auto bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 flex-shrink-0">
                          {unreadCount > 99 ? "99+" : unreadCount}
                        </span>
                      )}
                      {collapsed && (
                        <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full flex-shrink-0 border border-gray-950" />
                      )}
                    </>
                  ) : isActive && !collapsed && !(item.proOnly && user?.plan_tier !== "pro" && user?.plan_tier !== "legacy") && (
                    <div className={cn("ml-auto w-1.5 h-1.5 rounded-full bg-gradient-to-br flex-shrink-0", item.color.replace("from-", "bg-").split(" ")[0])} />
                  )}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Footer — fixed at bottom, never scrolls */}
        <div className={cn("flex-shrink-0 p-2 border-t space-y-0.5", isLight ? "border-gray-200" : "border-gray-800/50")}>
          <Link
            to="/TechPortal"
            onClick={() => setMobileOpen(false)}
            className={cn(
              "flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm font-medium transition-all border",
              currentPage === "TechPortal"
                ? isLight ? "bg-indigo-50 text-indigo-700 border-indigo-200" : "bg-indigo-900/30 text-indigo-400 border-indigo-700/40"
                : "border-transparent " + (isLight ? "text-gray-500 hover:bg-gray-100 hover:text-gray-800" : "text-gray-400 hover:bg-gray-800 hover:text-white")
            )}
          >
            <div className={cn("flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center", isLight ? "bg-indigo-50" : "bg-indigo-900/30")}>
              <Tablet className="w-4 h-4 text-indigo-400" />
            </div>
            {!collapsed && <span>Tech Portal</span>}
          </Link>

          <Link
            to="/Settings"
            onClick={() => setMobileOpen(false)}
            className={cn(
              "flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm font-medium transition-all border",
              currentPage === "Settings"
                ? isLight ? "bg-gray-100 text-gray-800 border-gray-300" : "bg-gray-800 text-white border-gray-700"
                : "border-transparent " + (isLight ? "text-gray-500 hover:bg-gray-100 hover:text-gray-800" : "text-gray-400 hover:bg-gray-800/50 hover:text-white")
            )}
          >
            <div className={cn("flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center", isLight ? "bg-gray-100" : "bg-gray-800")}>
              <SettingsIcon className="w-4 h-4 text-gray-400" />
            </div>
            {!collapsed && <span>Settings</span>}
          </Link>

          <button
            onClick={toggleTheme}
            className={cn("w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm font-medium transition-all border border-transparent", isLight ? "text-gray-500 hover:bg-gray-100 hover:text-gray-800" : "text-gray-400 hover:bg-gray-800/50 hover:text-white")}
          >
            <div className={cn("flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center", isLight ? "bg-gray-100" : "bg-gray-800")}>
              {isLight ? <Moon className="w-4 h-4 text-gray-500" /> : <Sun className="w-4 h-4 text-yellow-400" />}
            </div>
            {!collapsed && <span>{isLight ? "Dark Mode" : "Light Mode"}</span>}
          </button>

          <button
            onClick={() => { base44.auth.logout(); setMobileOpen(false); }}
            className={cn("w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm font-medium transition-all border border-transparent", isLight ? "text-gray-500 hover:bg-red-50 hover:text-red-600" : "text-gray-400 hover:bg-red-500/10 hover:text-red-400")}
          >
            <div className={cn("flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center", isLight ? "bg-gray-100" : "bg-gray-800")}>
              <LogOut className="w-4 h-4 text-gray-400" />
            </div>
            {!collapsed && <span>Logout</span>}
          </button>

          {!collapsed && (
            <button
              onClick={() => setCollapsed(!collapsed)}
              className={cn("w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg transition-colors text-xs border border-transparent", isLight ? "text-gray-400 hover:text-gray-700 hover:bg-gray-100" : "text-gray-500 hover:text-gray-300 hover:bg-gray-800/50")}
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Collapse</span>
            </button>
          )}

          {collapsed && (
            <button
              onClick={() => setCollapsed(false)}
              className={cn("w-full flex items-center justify-center py-2 rounded-lg transition-colors border border-transparent", isLight ? "text-gray-400 hover:bg-gray-100" : "text-gray-500 hover:bg-gray-800/50")}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Business name tag */}
        {!collapsed && user?.business_name && (
          <div className={cn("flex-shrink-0 px-3 pb-3")}>
            <div className={cn("px-3 py-2 rounded-lg border", isLight ? "bg-gray-50 border-gray-200" : "bg-gray-900/50 border-gray-800/50")}>
              <p className={cn("text-[10px] tracking-wider", isLight ? "text-gray-400" : "text-gray-500")}>YOUR SHOP</p>
              <p className={cn("text-xs font-semibold truncate mt-0.5", isLight ? "text-gray-800" : "text-gray-200")}>{user.business_name}</p>
            </div>
          </div>
        )}

        {!collapsed && (
          <div className="flex-shrink-0 px-4 pb-3 text-center">
            <p className={cn("text-[10px]", isLight ? "text-gray-400" : "text-gray-600")}>
              Powered by <a href="https://lbc.network" target="_blank" rel="noopener noreferrer" className={cn("font-semibold hover:text-sky-400 transition-colors", isLight ? "text-gray-500" : "text-gray-500")}>LBC.NETWORK</a>
            </p>
          </div>
        )}
      </aside>
    </>
  );
}