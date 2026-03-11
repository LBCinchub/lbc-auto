import React from "react";
import Sidebar from "./components/layout/Sidebar";

export default function Layout({ children, currentPageName }) {
  return (
    <div className="min-h-screen bg-gray-950">
      <Sidebar currentPage={currentPageName} />
      <main className="lg:pl-64 min-h-screen">
        <div className="p-4 md:p-6 lg:p-8 pt-16 lg:pt-8">
          {children}
        </div>
      </main>
    </div>
  );
}