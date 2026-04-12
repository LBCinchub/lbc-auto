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
  CreditCard
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { name: "Dashboard", icon: LayoutDashboard, page: "Dashboard" },
  { name: "Customers", icon: Users, page: "Customers" },
  { name: "Vehicles", icon: Car, page: "Vehicles" },
  { name: "Repair Orders", icon: Wrench, page: "RepairOrders" },
  { name: "Parts", icon: Package, page: "Parts" },
  { name: "Invoices", icon: FileText, page: "Invoices" },
  { name: "Appointments", icon: Calendar, page: "Appointments" },
  { name: "Mechanics", icon: HardHat, page: "Mechanics" },
  { name: "Estimates", icon: ClipboardList, page: "Estimates" },
  { name: "Time Tracking", icon: Clock, page: "TimeTracking" },
  { name: "Payroll", icon: Banknote, page: "Payroll" },
  { name: "Analytics", icon: BarChart3, page: "Analytics" },
  { name: "Billing", icon: CreditCard, page: "Billing" },
];

export default function Sidebar({ currentPage }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState(null);

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
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-gray-900 text-white shadow-lg"
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
          "fixed top-0 left-0 h-full bg-gray-950 border-r border-gray-800/50 z-50 flex flex-col transition-all duration-300",
          collapsed ? "w-[72px]" : "w-64",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Logo */}
        <div className="h-16 flex items-center px-4 border-b border-gray-800/50">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center flex-shrink-0">
              <Zap className="w-5 h-5 text-white" />
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <h1 className="text-white font-bold text-lg leading-tight tracking-tight">LBC Auto</h1>
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
                    ? "bg-sky-500/10 text-sky-400 shadow-sm"
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
        <div className="p-3 border-t border-gray-800/50 space-y-2">
          <Link
            to="/Billing"
            onClick={() => setMobileOpen(false)}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
              currentPage === "Billing"
                ? "bg-sky-500/10 text-sky-400 shadow-sm"
                : "text-gray-400 hover:text-white hover:bg-gray-800/50"
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
                ? "bg-sky-500/10 text-sky-400 shadow-sm"
                : "text-gray-400 hover:text-white hover:bg-gray-800/50"
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
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800/50 transition-all"
          >
            <HelpCircle className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span>Support</span>}
          </a>
          <button
            onClick={() => {
              base44.auth.logout();
              setMobileOpen(false);
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800/50 transition-all"
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span>Logout</span>}
          </button>
          {!collapsed && (
            <div className="hidden lg:block pt-2">
              <button
                onClick={() => setCollapsed(!collapsed)}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-800/50 transition-colors text-xs"
              >
                {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                <span>Collapse</span>
              </button>
            </div>
          )}
        </div>

        {/* Business Name */}
        {!collapsed && user?.business_name && (
          <div className="px-4 pb-4">
            <div className="px-3 py-2 rounded-lg bg-gray-900/50 border border-gray-800/50">
              <p className="text-[10px] text-gray-500 tracking-wider">YOUR SHOP</p>
              <p className="text-xs text-gray-300 font-medium truncate">{user.business_name}</p>
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