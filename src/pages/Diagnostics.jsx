import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Microscope, Search, BarChart3, Settings, AlertTriangle, FileText } from "lucide-react";
import { ELM327Client } from "@/lib/obd/elm327";
import ScannerHeader from "@/components/scanner/ScannerHeader";
import VehicleConnectionBanner from "@/components/scanner/VehicleConnectionBanner";
import ScanMode from "@/components/scanner/ScanMode";
import LiveDataMode from "@/components/scanner/LiveDataMode";
import TechMode from "@/components/scanner/TechMode";
import StatusBar from "@/components/scanner/StatusBar";
import QuickAddCustomerDialog from "@/components/diagnostics/QuickAddCustomerDialog";
import QuickAddVehicleDialog from "@/components/diagnostics/QuickAddVehicleDialog";
import VehiclePanel from "@/components/scanner/VehiclePanel";
import VehicleIdentifiedBanner from "@/components/scanner/VehicleIdentifiedBanner";
import ScanProgressBar from "@/components/scanner/ScanProgressBar";
import ScanReportCard from "@/components/scanner/ScanReportCard";
import { useAutoConnectScan } from "@/hooks/useAutoConnectScan";
import { useToast } from "@/components/ui/use-toast";

const TABS = [
  { key: "scan", label: "SCAN", icon: Search },
  { key: "live", label: "LIVE DATA", icon: BarChart3 },
  { key: "tech", label: "TECH MODE", icon: Settings },
];

export default function Diagnostics() {
  const [user, setUser] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [customerId, setCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [vehicles, setVehicles] = useState([]);
  const [vehicleId, setVehicleId] = useState("");
  const [activeTab, setActiveTab] = useState("scan");
  const [showVehiclePanel, setShowVehiclePanel] = useState(false);

  const [connState, setConnState] = useState("disconnected");
  const [adapterName, setAdapterName] = useState("");
  const [protocol, setProtocol] = useState("");
  const [voltage, setVoltage] = useState("");
  const [connError, setConnError] = useState("");
  const clientRef = useRef(null);
  const [sessionStart, setSessionStart] = useState(null);
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [savingToRO, setSavingToRO] = useState(false);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
    base44.entities.Customer.list("-created_date", 500).then(setCustomers).catch(() => {});
    return () => { clientRef.current?.disconnect(); };
  }, []);

  useEffect(() => {
    if (!customerId) { setVehicles([]); setVehicleId(""); return; }
    base44.entities.Vehicle.filter({ customer_id: customerId }).then(setVehicles).catch(() => setVehicles([]));
  }, [customerId]);

  const selectedVehicle = vehicles.find(v => v.id === vehicleId);
  const bleSupported = ELM327Client.isSupported();
  const laborRate = parseFloat(user?.labor_rate) || 120;
  const isPro = user?.plan_tier === "pro" || user?.plan_tier === "legacy";

  const { toast } = useToast();
  const {
    autoVehicle, scanning, scanProgress, scanLabel, scanResults,
    reportReady, reportOpen, dismissReport, reopenReport, aiSummary,
  } = useAutoConnectScan({ clientRef, connState });

  // "Save to Repair Order" — pre-fills a new RO with vehicle info + codes + AI summary.
  // Creates a walk-in customer + vehicle from the decoded VIN if none is selected.
  const handleSaveToRepairOrder = async () => {
    if (!user) return;
    setSavingToRO(true);
    try {
      const codes = [
        ...(scanResults?.storedCodes || []),
        ...(scanResults?.pendingCodes || []),
        ...(scanResults?.permanentCodes || []),
      ];
      const codeText = codes.length ? codes.map((c) => c.code).join(", ") : "No codes";
      const desc = `Auto-scan diagnostics${autoVehicle ? ` — ${autoVehicle.year || ""} ${autoVehicle.make || ""} ${autoVehicle.model || ""}`.trim() : ""}\nCodes: ${codeText}\nAI Summary: ${aiSummary || "N/A"}`;

      let custId = customerId;
      let custName = customerName;
      let vehId = vehicleId;
      let vehInfo = vehicleInfoStr;

      if (!vehId && autoVehicle) {
        const newCust = await base44.entities.Customer.create({
          full_name: `Walk-in (VIN ${autoVehicle.vin?.slice(-6) || "scan"})`,
          phone: "000-000-0000",
          shop_owner_email: user.email,
        });
        custId = newCust.id;
        custName = newCust.full_name;
        const fuel = (autoVehicle.engine_type || "").toLowerCase();
        const newVeh = await base44.entities.Vehicle.create({
          customer_id: custId,
          customer_name: custName,
          shop_owner_email: user.email,
          vin: autoVehicle.vin || undefined,
          make: autoVehicle.make || undefined,
          model: autoVehicle.model || undefined,
          year: autoVehicle.year ? parseInt(autoVehicle.year) : undefined,
          engine_type: autoVehicle.engine_type || undefined,
          mileage: autoVehicle.mileage || undefined,
          fuel_type: fuel.includes("electric") ? "Electric" : fuel.includes("hybrid") ? "Hybrid" : undefined,
        });
        vehId = newVeh.id;
        vehInfo = `${autoVehicle.year || ""} ${autoVehicle.make || ""} ${autoVehicle.model || ""}`.trim();
        setCustomers((prev) => [newCust, ...prev]);
        setCustomerId(custId);
        setCustomerName(custName);
        setVehicles((prev) => [newVeh, ...prev]);
        setVehicleId(vehId);
      }

      if (!vehId) {
        toast({ title: "Select a vehicle first", description: "Choose a customer & vehicle before saving.", variant: "destructive" });
        setSavingToRO(false);
        return;
      }

      const ro = await base44.entities.RepairOrder.create({
        customer_id: custId,
        customer_name: custName,
        vehicle_id: vehId,
        vehicle_info: vehInfo,
        description: desc,
        status: "waiting",
      });
      toast({ title: "Repair order created", description: "Pre-filled with scan results." });
      dismissReport();
      window.location.href = `/RepairOrderDetail/${ro.id}`;
    } catch (e) {
      toast({ title: "Failed to create RO", description: e?.message || "Try again.", variant: "destructive" });
    } finally {
      setSavingToRO(false);
    }
  };

  // ── BLE handlers ──────────────────────────────────────────────────────
  const handleConnect = async () => {
    setConnError("");
    setConnState("connecting");
    try {
      const client = new ELM327Client(() => {
        // Adapter dropped unexpectedly — reset UI so user can reconnect without refreshing
        setConnState("disconnected");
        setConnError("Adapter disconnected. Tap CONNECT to reconnect.");
        setAdapterName("");
        setProtocol("");
        setVoltage("");
        clientRef.current = null;
        setTimeout(() => setConnError(""), 5000);
      });
      const info = await client.connect();
      clientRef.current = client;
      setAdapterName(info.name);
      setProtocol(info.protocol || "");
      setVoltage(info.voltage || "");
      setConnState("connected");
      setSessionStart(Date.now());
    } catch (err) {
      setConnState("error");
      setConnError(err?.message || "Couldn't connect to the adapter.");
      // Auto-reset to disconnected after 6s so user can retry without refreshing
      setTimeout(() => {
        setConnState("disconnected");
        setConnError("");
      }, 6000);
    }
  };

  const handleDisconnect = async () => {
    await clientRef.current?.disconnect();
    clientRef.current = null;
    setConnState("disconnected");
    setAdapterName("");
    setProtocol("");
    setVoltage("");
    setSessionStart(null);
  };

  const handleSaveScan = async (scanData) => {
    const created = await base44.entities.DiagnosticScan.create({
      ...scanData,
      shop_owner_email: user?.email,
      adapter_name: adapterName || undefined,
      mileage: selectedVehicle?.mileage || undefined,
    });
    return created;
  };

  const handlePhotoUpload = async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.capture = "environment";
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        if (vehicleId && customerId) {
          await base44.entities.VehiclePhoto.create({
            customer_id: customerId,
            customer_name: customerName,
            vehicle_id: vehicleId,
            vehicle_info: selectedVehicle ? `${selectedVehicle.year} ${selectedVehicle.make} ${selectedVehicle.model}` : "",
            photo_url: file_url,
            shop_email: user?.email,
            source: "scanner",
            taken_date: new Date().toISOString().slice(0, 10),
          });
        }
      } catch (err) {
        setConnError("Photo upload failed: " + (err?.message || ""));
      }
    };
    input.click();
  };

  const handleCustomerCreated = (newCustomer) => {
    setCustomers(prev => [newCustomer, ...prev]);
    setCustomerId(newCustomer.id);
    setCustomerName(newCustomer.full_name);
  };

  const handleVehicleCreated = (newVehicle) => {
    setVehicles(prev => [newVehicle, ...prev]);
    setVehicleId(newVehicle.id);
  };

  const vehicleInfoStr = selectedVehicle
    ? `${selectedVehicle.year || ""} ${selectedVehicle.make || ""} ${selectedVehicle.model || ""}`.trim()
    : "—";

  // ── Pro gate ───────────────────────────────────────────────────────────
  if (user && !isPro) {
    return (
      <div className="max-w-lg mx-auto mt-16 text-center space-y-4 bg-gray-900 border border-gray-800 rounded-xl p-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-500/5 to-transparent pointer-events-none" />
        <Microscope className="w-10 h-10 text-fuchsia-400 mx-auto relative" />
        <h2 className="text-xl font-bold text-white relative">LBC AUTO AI SCANNER</h2>
        <p className="text-fuchsia-400 text-sm font-semibold relative">Pro Feature</p>
        <p className="text-gray-400 text-sm relative">
          Live Bluetooth OBD2 scanning, AI-powered diagnosis, live data streaming, and bidirectional ECU commands are included on the Pro plan ($299/mo). You're currently on Basic.
        </p>
        <button onClick={() => (window.location.href = "/Billing")} className="bg-fuchsia-600 hover:bg-fuchsia-700 text-white px-6 py-2 rounded-lg font-semibold relative">
          Upgrade to Pro
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-20">
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .no-print { display: none !important; }
        }
      `}</style>

      {/* Header */}
      <ScannerHeader isPro={isPro} onHelp={() => setShowVehiclePanel(true)} />

      {!bleSupported && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-200">
            Your browser doesn't support Web Bluetooth. Use Chrome or Edge on Android or desktop — not supported on iOS Safari.
          </div>
        </div>
      )}

      {/* Vehicle + Connection Banner */}
      <VehicleConnectionBanner
        selectedVehicle={selectedVehicle}
        connState={connState}
        adapterName={adapterName}
        protocol={protocol}
        voltage={voltage}
        connError={connError}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
        onVehicleChange={() => setShowVehiclePanel(!showVehiclePanel)}
      />

      {/* Auto-detected vehicle banner + background scan progress (persist across tabs) */}
      <VehicleIdentifiedBanner vehicle={autoVehicle} />
      <ScanProgressBar scanning={scanning} progress={scanProgress} label={scanLabel} />
      {reportReady && !reportOpen && (
        <button
          onClick={reopenReport}
          className="w-full bg-fuchsia-600/20 border border-fuchsia-500/40 text-fuchsia-300 rounded-xl py-2.5 text-sm font-bold flex items-center justify-center gap-2 hover:bg-fuchsia-600/30 transition-colors"
        >
          <FileText className="w-4 h-4" /> View Diagnostic Report
        </button>
      )}

      {/* Collapsible vehicle selector */}
      {showVehiclePanel && (
        <VehiclePanel
          customers={customers}
          customerId={customerId}
          customerName={customerName}
          vehicles={vehicles}
          vehicleId={vehicleId}
          selectedVehicle={selectedVehicle}
          onCustomerChange={(id, name) => { setCustomerId(id); setCustomerName(name); }}
          onVehicleChange={setVehicleId}
          onAddCustomer={() => setShowAddCustomer(true)}
          onAddVehicle={() => setShowAddVehicle(true)}
        />
      )}

      {/* Tab switcher */}
      <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all ${
                active
                  ? "bg-fuchsia-500 text-white shadow-lg shadow-fuchsia-500/20"
                  : "text-gray-400 hover:text-white hover:bg-gray-800"
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              {tab.key === "tech" && !isPro && (
                <span className="text-[9px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded">PRO</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Active mode */}
      {activeTab === "scan" && (
        <ScanMode
          clientRef={clientRef}
          connState={connState}
          selectedVehicle={selectedVehicle}
          customerId={customerId}
          customerName={customerName}
          vehicleId={vehicleId}
          user={user}
          laborRate={laborRate}
          onSave={handleSaveScan}
          onPhotoUpload={handlePhotoUpload}
        />
      )}

      {activeTab === "live" && (
        <LiveDataMode
          clientRef={clientRef}
          connState={connState}
          selectedVehicle={selectedVehicle}
        />
      )}

      {activeTab === "tech" && (
        <TechMode
          clientRef={clientRef}
          connState={connState}
          selectedVehicle={selectedVehicle}
          isPro={isPro}
        />
      )}

      {/* Scan complete report card (full-screen overlay) */}
      {reportOpen && (
        <ScanReportCard
          autoVehicle={autoVehicle}
          scanResults={scanResults}
          aiSummary={aiSummary}
          saving={savingToRO}
          onDismiss={dismissReport}
          onSaveToRepairOrder={handleSaveToRepairOrder}
        />
      )}

      {/* Quick-add dialogs */}
      <QuickAddCustomerDialog open={showAddCustomer} onClose={() => setShowAddCustomer(false)} onSaved={handleCustomerCreated} />
      <QuickAddVehicleDialog
        open={showAddVehicle}
        onClose={() => setShowAddVehicle(false)}
        onSaved={handleVehicleCreated}
        customer={customerId ? { id: customerId, full_name: customerName } : null}
      />

      {/* Bottom status bar */}
      <div className="fixed bottom-0 left-0 right-0 lg:pl-64 pr-20 z-30">
        <StatusBar
          adapterName={adapterName}
          protocol={protocol}
          vehicleInfo={vehicleInfoStr}
          sessionStart={sessionStart}
        />
      </div>
    </div>
  );
}