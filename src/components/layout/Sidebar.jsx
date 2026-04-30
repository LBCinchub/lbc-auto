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
  Moon
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/ThemeContext";
import GlobalSearch from "@/components/shared/GlobalSearch";

const navItems = [
  { name: "Dashboard", icon: LayoutDashboard, page: "Dashboard" },
  { name: "Customers", icon: Users, page: "Customers" },
  { name: "Vehicles", icon: Car, page: "Vehicles" },
  { name: "Estimates", icon: ClipboardList, page: "Estimates" },
  { name: "Repair Orders", icon: Wrench, page: "RepairOrders" },
  { name: "Invoices", icon: FileText, page: "Invoices" },
  { name: "Parts", icon: Package, page: "Parts" },
  { name: "Appointments", icon: Calendar, page: "Appointments" },
  { name: "Mechanics", icon: HardHat, page: "Mechanics" },
  { name: "Time Tracking", icon: Clock, page: "TimeTracking" },
  { name: "Payroll", icon: Banknote, page: "Payroll" },
  { name: "Analytics", icon: BarChart3, page: "Analytics" },
  { name: "Billing", icon: CreditCard, page: "Billing" },
];

export default function Sidebar({ currentPage }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState(null);
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === "light";

  useEffect(() => {
    const loadUser = async () => {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    };
    loadUser();
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
        <div
          className="lg:hidden fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 h-full z-50 flex flex-col transition-all duration-300",
          isLight ? "bg-white border-r border-gray-200" : "bg-gray-950 border-r border-gray-800/50",
          collapsed ? "w-[72px]" : "w-64",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Logo */}
        <div className={cn("h-16 flex items-center px-4 border-b", isLight ? "border-gray-200" : "border-gray-800/50")}>
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
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden ml-auto text-gray-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Global Search */}
        {!collapsed && (
          <div className="px-3 py-2 border-b border-gray-800/50">
            <GlobalSearch />
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = currentPage === item.page;
            return (
              <Link
                key={item.page}
                to={createPageUrl(item.page)}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-sky-500/10 text-sky-500 shadow-sm"
                    : isLight
                      ? "text-gray-500 hover:text-gray-900 hover:bg-gray-100"
                      : "text-gray-400 hover:text-white hover:bg-gray-800/50"
                )}
              >
                <item.icon className={cn("w-5 h-5 flex-shrink-0", isActive && "text-sky-400")} />
                {!collapsed && <span className="truncate">{item.name}</span>}
                {isActive && !collapsed && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-sky-400" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Settings & Footer */}
        <div className={cn("p-3 border-t space-y-2", isLight ? "border-gray-200" : "border-gray-800/50")}>
          <Link
            to="/Billing"
            onClick={() => setMobileOpen(false)}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
              currentPage === "Billing"
                ? "bg-sky-500/10 text-sky-500 shadow-sm"
                : isLight ? "text-gray-500 hover:text-gray-900 hover:bg-gray-100" : "text-gray-400 hover:text-white hover:bg-gray-800/50"
            )}
          >
            <CreditCard className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span>Billing</span>}
          </Link>
          <Link
            to="/Settings"
            onClick={() => setMobileOpen(false)}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
              currentPage === "Settings"
                ? "bg-sky-500/10 text-sky-500 shadow-sm"
                : isLight ? "text-gray-500 hover:text-gray-900 hover:bg-gray-100" : "text-gray-400 hover:text-white hover:bg-gray-800/50"
            )}
          >
            <SettingsIcon className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span>Settings</span>}
          </Link>
          <a
            href="https://lbchub.support"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setMobileOpen(false)}
            className={cn("w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all", isLight ? "text-gray-500 hover:text-gray-900 hover:bg-gray-100" : "text-gray-400 hover:text-white hover:bg-gray-800/50")}
          >
            <HelpCircle className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span>Support</span>}
          </a>
          <button
            onClick={() => {
              base44.auth.logout();
              setMobileOpen(false);
            }}
            className={cn("w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all", isLight ? "text-gray-500 hover:text-gray-900 hover:bg-gray-100" : "text-gray-400 hover:text-white hover:bg-gray-800/50")}
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span>Logout</span>}
          </button>
          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className={cn("w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all", isLight ? "text-gray-500 hover:text-gray-900 hover:bg-gray-100" : "text-gray-400 hover:text-white hover:bg-gray-800/50")}
          >
            {isLight ? <Moon className="w-5 h-5 flex-shrink-0" /> : <Sun className="w-5 h-5 flex-shrink-0" />}
            {!collapsed && <span>{isLight ? "Dark Mode" : "Light Mode"}</span>}
          </button>
          {!collapsed && (
            <div className="hidden lg:block pt-2">
              <button
                onClick={() => setCollapsed(!collapsed)}
                className={cn("w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg transition-colors text-xs", isLight ? "text-gray-400 hover:text-gray-700 hover:bg-gray-100" : "text-gray-500 hover:text-gray-300 hover:bg-gray-800/50")}
              >
                {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                <span>Collapse</span>
              </button>
            </div>
          )}
        </div>

        {/* Powered By */}
        {!collapsed && (
          <div className="px-4 pb-2 text-center">
            <p className={cn("text-[10px]", isLight ? "text-gray-400" : "text-gray-600")}>Powered by <a href="https://lbc.network" target="_blank" rel="noopener noreferrer" className="hover:text-sky-400 transition-colors">{isLight ? "lbc.network" : "lbc.network"}</a></p>
          </div>
        )}

        {/* Business Name */}
        {!collapsed && user?.business_name && (
          <div className="px-4 pb-4">
            <div className={cn("px-3 py-2 rounded-lg border", isLight ? "bg-gray-50 border-gray-200" : "bg-gray-900/50 border-gray-800/50")}>
              <p className={cn("text-[10px] tracking-wider", isLight ? "text-gray-400" : "text-gray-500")}>YOUR SHOP</p>
              <p className={cn("text-xs font-medium truncate", isLight ? "text-gray-700" : "text-gray-300")}>{user.business_name}</p>
            </div>
          </div>
        )}
        {!collapsed && !user?.business_name && (
          <div className="px-4 pb-4">
            <div className="px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30">
              <p className="text-[10px] text-amber-600 tracking-wider">SETUP REQUIRED</p>
              <p className="text-xs text-amber-500 font-medium">Add your business name</p>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}