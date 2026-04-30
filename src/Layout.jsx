import React from "react";
import Sidebar from "./components/layout/Sidebar";
import FloatingNote from "./components/shared/FloatingNote";
import { useTheme } from "./lib/ThemeContext";

export default function Layout({ children, currentPageName }) {
  const { theme } = useTheme();
  return (
    <div className={`min-h-screen ${theme === "light" ? "bg-gray-100" : "bg-gray-950"}`}>
      <style>{`
        :root {
          --sidebar-width: 256px;
        }
      `}</style>
      <Sidebar currentPage={currentPageName} />
      <main className="lg:pl-64 min-h-screen transition-all duration-300">
        <div className="p-4 md:p-6 lg:p-8 pt-16 lg:pt-8 max-w-[1400px]">
          {children}
        </div>
      </main>
      <FloatingNote />
    </div>
  );
}