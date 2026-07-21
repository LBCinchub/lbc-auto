import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Microscope, Search, BarChart3, Settings, AlertTriangle } from "lucide-react";
import { ELM327Client } from "@/lib/obd/elm327";
import ScannerHeader from "@/components/scanner/ScannerHeader";
import VehicleConnectionBanner from "@/components/scanner/VehicleConnectionBanner";
import LiveDataMode from "@/components/scanner/LiveDataMode";
import TechMode from "@/components/scanner/TechMode";
import StatusBar from "@/components/scanner/StatusBar";
import QuickAddCustomerDialog from "@/components/diagnostics/QuickAddCustomerDialog";
import QuickAddVehicleDialog from "@/components/diagnostics/QuickAddVehicleDialog";
import VehiclePanel from "@/components/scanner/VehiclePanel";
import ScanProgressBar from "@/components/scanner/ScanProgressBar";
import ScanReportCard from "@/components/scanner/ScanReportCard";
import ScanSessionFlow from "@/components/scanner/ScanSessionFlow";
import VehicleIdentifiedBanner from "@/components/scanner/VehicleIdentifiedBanner";
import ManualVehicleIdentification from "@/components/scanner/ManualVehicleIdentification";
import { useAutoConnectScan } from "@/hooks/useAutoConnectScan";
import { lookupDtc } from "@/lib/dtcDatabase";
import { useToast } from "@/components/ui/use-toast";
import { validateRecord } from "@/utils/syncCustomerActivity";

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
  const [savingScan, setSavingScan] = useState(false);
  const [savingEstimate, setSavingEstimate] = useState(false);
  const [manualVehicleOpen, setManualVehicleOpen] = useState(false);
  const [analysisByCode, setAnalysisByCode] = useState({});
  const [analyzingCodes, setAnalyzingCodes] = useState({});

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
    reportReady, reportOpen, dismissReport, reopenReport, aiSummary, setAiSummary, restartScan, setManualVehicle,
  } = useAutoConnectScan({ clientRef, connState });

  const allScanCodes = () => [...(scanResults?.storedCodes || []), ...(scanResults?.pendingCodes || []), ...(scanResults?.permanentCodes || [])];

  const handleStartNewScan = () => {
    dismissReport();
    setAnalysisByCode({});
    setAnalyzingCodes({});
    restartScan();
  };

  const analyzeCodes = async (codes) => {
    if (!codes.length) return;
    const keys = codes.map(c => c.code);
    setAnalyzingCodes(prev => ({ ...prev, ...Object.fromEntries(keys.map(k => [k, true])), all: codes.length > 1 }));
    try {
      const response = await base44.functions.invoke("lbcDiagAI", {
        mode: "analyze", codes, shop_email: user?.email, labor_rate: laborRate,
        vehicle_details: { ...autoVehicle, vehicle_id: vehicleId || undefined },
        freeze_frame: scanResults?.freezeFrame || null, live_data: scanResults?.liveSnapshot || null,
      });
      const analysis = response.data?.analysis || {};
      setAnalysisByCode(prev => ({ ...prev, ...Object.fromEntries((analysis.findings || []).map(f => [f.code, f])) }));
      setAiSummary(analysis.summary || analysis.root_cause_analysis || "");
    } catch (error) {
      toast({ title: "AI analysis failed", description: error?.message || "Try again.", variant: "destructive" });
    } finally {
      setAnalyzingCodes(prev => ({ ...prev, ...Object.fromEntries(keys.map(k => [k, false])), all: false }));
    }
  };

  // Opens a clean printable report in a new window (avoids dark-theme CSS conflicts).
  const handlePrintReport = () => {
    const v = autoVehicle || {};
    const r = scanResults || {};
    const codes = [...(r.storedCodes || []), ...(r.pendingCodes || []), ...(r.permanentCodes || [])];
    const snap = r.liveSnapshot || {};
    const monitors = r.emissions?.monitors || [];
    const codeRows = codes.map((c) => {
      const info = lookupDtc(c.code) || {}, ai = analysisByCode[c.code];
      const labor = ai ? `${ai.estimated_labor_hours_low || 0}–${ai.estimated_labor_hours_high || 0} hrs × $${laborRate}/hr` : "Run AI analysis";
      const parts = ai?.recommended_parts?.map(p => `${p.name} (${p.status})`).join(", ") || "—";
      return `<tr><td style="font-weight:700">${c.code}</td><td>${ai?.plain_english || info.name || "Definition pending"}</td><td>${ai?.urgency || info.severity || "Info"}</td><td>${labor}<br><span class="muted">Parts: ${parts}</span></td></tr>`;
    }).join("");
    const monRows = monitors.map((m) => `<tr><td>${m.name}</td><td>${m.status === "pass" ? "PASS" : "NOT READY"}</td></tr>`).join("");
    const html = `<!DOCTYPE html><html><head><title>Diagnostic Report</title><style>body{font-family:Arial,Helvetica,sans-serif;padding:28px;color:#111}h1{font-size:20px;margin:0 0 2px}h2{font-size:14px;border-bottom:1px solid #ccc;padding-bottom:4px;margin:18px 0 8px}table{width:100%;font-size:12px;border-collapse:collapse}td{padding:3px 6px;border-bottom:1px solid #eee;vertical-align:top}.muted{color:#666;font-size:11px}</style></head><body>
<h1>LBC AUTO AI SCANNER — Diagnostic Report</h1>
<p class="muted">Generated ${new Date().toLocaleString()}</p>
<h2>Vehicle Confirmed</h2>
<table>
<tr><td style="font-weight:700;width:110px">Vehicle</td><td>${v.year || ""} ${v.make || ""} ${v.model || ""}</td></tr>
  <tr><td style="font-weight:700">Trim / Engine</td><td>${[v.trim, v.engine || v.engine_type].filter(Boolean).join(" · ") || "—"}</td></tr>
  <tr><td style="font-weight:700">VIN</td><td>${v.vin || "Manually identified"}</td></tr>
  <tr><td style="font-weight:700">Mileage</td><td>${(v.mileage_km ?? v.mileage) != null ? Number(v.mileage_km ?? v.mileage).toLocaleString() + " km" : "Not reported by ECU"}</td></tr>
</table>
<h2>Diagnostic Trouble Codes (${codes.length})</h2>
${codes.length ? `<table><tr><td style="font-weight:700">Code</td><td style="font-weight:700">Description</td><td style="font-weight:700">Severity</td><td style="font-weight:700">Labor / Parts</td></tr>${codeRows}</table>` : "<p class='muted'>No trouble codes found — all clear.</p>"}
<h2>Emissions Readiness</h2>
${monitors.length ? `<table>${monRows}</table>` : "<p class='muted'>Not available.</p>"}
<h2>Live Data Snapshot</h2>
<table>
<tr><td style="font-weight:700;width:110px">Engine RPM</td><td>${snap.rpm ?? "—"}</td></tr>
<tr><td style="font-weight:700">Coolant Temp</td><td>${snap.coolant ?? "—"} °C</td></tr>
<tr><td style="font-weight:700">Battery Voltage</td><td>${snap.battery ?? "—"} V</td></tr>
<tr><td style="font-weight:700">Throttle Position</td><td>${snap.throttle ?? "—"} %</td></tr>
</table>
<h2>AI Health Summary</h2>
<p>${aiSummary || "Run AI analysis from the scanner report to add vehicle-specific labor and parts guidance."}</p>
<p class="muted" style="margin-top:28px;text-align:center;border-top:1px solid #ccc;padding-top:10px">LBC Auto · AI Vehicle Diagnostic Scan</p>
</body></html>`;
    const w = window.open("", "_blank");
    if (!w) { toast({ title: "Allow popups to print", variant: "destructive" }); return; }
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  };

  const ensureScannerVehicle = async () => {
    if (vehicleId && selectedVehicle) return { custId: customerId, custName: customerName || selectedVehicle.customer_name, vehId: vehicleId, vehInfo: vehicleInfoStr };
    if (!autoVehicle) throw new Error("Enter the vehicle details first.");
    const newCust = await base44.entities.Customer.create({ full_name: `Walk-in (${autoVehicle.vin ? `VIN ${autoVehicle.vin.slice(-6)}` : `${autoVehicle.year} ${autoVehicle.make}`})`, phone: "000-000-0000", shop_owner_email: user.email });
    const newVeh = await base44.entities.Vehicle.create({ customer_id:newCust.id, customer_name:newCust.full_name, shop_owner_email:user.email, vin:autoVehicle.vin || "", year:Number(autoVehicle.year), make:autoVehicle.make, model:autoVehicle.model, trim:autoVehicle.trim || "", engine_type:autoVehicle.engine || autoVehicle.engine_type || "", mileage:autoVehicle.mileage_km ?? autoVehicle.mileage ?? undefined });
    const vehInfo = `${autoVehicle.year} ${autoVehicle.make} ${autoVehicle.model}`.trim();
    setCustomers(prev => [newCust, ...prev]); setCustomerId(newCust.id); setCustomerName(newCust.full_name); setVehicles(prev => [newVeh, ...prev]); setVehicleId(newVeh.id);
    return { custId:newCust.id, custName:newCust.full_name, vehId:newVeh.id, vehInfo };
  };

  const repairRows = (codes) => {
    const findings = codes.map(c => analysisByCode[c.code]).filter(Boolean);
    const labor_items = findings.map(f => { const hours=Number(f.estimated_labor_hours_high || f.estimated_labor_hours_low || 0); return { description:`${f.code} diagnosis and repair`, hours, rate:laborRate, total:hours*laborRate }; });
    const parts = findings.flatMap(f => (f.recommended_parts || []).map(p => ({ name:p.name || p, quantity:p.status === "Required" ? 1 : 0, unit_price:0, total:0 })));
    return { findings, labor_items, parts };
  };

  const handleSaveToRepairOrder = async (selectedCodes = null) => {
    if (!user || !autoVehicle) { setManualVehicleOpen(true); return; }
    setSavingToRO(true);
    try {
      const codes = selectedCodes || allScanCodes();
      const context = await ensureScannerVehicle();
      const validation = await validateRecord({ customerId:context.custId, vehicleId:context.vehId, entityType:"RepairOrder" });
      if (!validation.ok) throw new Error(validation.errors.join(" "));
      const { findings, labor_items, parts } = repairRows(codes);
      const description = `Scanner diagnosis — ${codes.map(c=>c.code).join(", ")}\n${findings.map(f=>f.customer_friendly_explanation).filter(Boolean).join(" ") || aiSummary || "AI analysis pending"}`;
      const laborCost = labor_items.reduce((s,i)=>s+i.total,0);
      let ro;
      if (selectedCodes?.length === 1) {
        const existing = (await base44.entities.RepairOrder.filter({ vehicle_id:context.vehId }, "-created_date", 20)).find(r => ["waiting","in_progress","waiting_for_parts"].includes(r.status));
        if (existing) {
          const mergedLabor = [...(existing.labor_items || []), ...labor_items], mergedParts = [...(existing.parts_used || []), ...parts];
          ro = await base44.entities.RepairOrder.update(existing.id, { description:`${existing.description || ""}\n\n${description}`.trim(), notes:`${existing.notes || ""}\n${findings.map(f=>`${f.code}: ${f.mechanic_notes || f.likely_cause}`).join("\n")}`.trim(), labor_items:mergedLabor, parts_used:mergedParts, labor_hours:mergedLabor.reduce((s,i)=>s+(Number(i.hours)||0),0), labor_cost:mergedLabor.reduce((s,i)=>s+(Number(i.total)||0),0), total_cost:mergedLabor.reduce((s,i)=>s+(Number(i.total)||0),0)+(existing.parts_cost||0) });
        }
      }
      if (!ro) ro = await base44.entities.RepairOrder.create({ customer_id:context.custId, customer_name:context.custName, vehicle_id:context.vehId, vehicle_info:context.vehInfo, description, notes:findings.map(f=>`${f.code}: ${f.mechanic_notes || f.likely_cause}`).join("\n"), status:"waiting", labor_items, parts_used:parts, labor_hours:labor_items.reduce((s,i)=>s+i.hours,0), labor_cost:laborCost, parts_cost:0, total_cost:laborCost });
      toast({ title: selectedCodes ? "Added to repair order" : "Repair order created", description:"Vehicle, codes, labor, parts, and customer explanation were included." });
      dismissReport(); window.location.href=`/RepairOrderDetail/${ro.id}`;
    } catch (error) { toast({ title:"Repair order failed", description:error?.message || "Try again.", variant:"destructive" }); }
    finally { setSavingToRO(false); }
  };

  const handleCreateEstimate = async () => {
    if (!autoVehicle) { setManualVehicleOpen(true); return; }
    setSavingEstimate(true);
    try {
      const context = await ensureScannerVehicle();
      const validation = await validateRecord({ customerId:context.custId, vehicleId:context.vehId, entityType:"Estimate" });
      if (!validation.ok) throw new Error(validation.errors.join(" "));
      const { labor_items, parts } = repairRows(allScanCodes());
      const labor_total=labor_items.reduce((s,i)=>s+i.total,0);
      const estimate=await base44.entities.Estimate.create({ estimate_number:`EST-${Date.now().toString().slice(-6)}`, customer_id:context.custId, customer_name:context.custName, vehicle_id:context.vehId, vehicle_info:context.vehInfo, status:"draft", service_reason:`Diagnostic codes: ${allScanCodes().map(c=>c.code).join(", ")}`, notes:aiSummary || "AI analysis pending", labor_items, parts_items:parts, labor_total, parts_total:0, tax_rate:0, tax_amount:0, grand_total:labor_total });
      toast({ title:"Estimate created", description:"Scanner findings were pre-filled." }); dismissReport(); window.location.href=`/EstimateDetail/${estimate.id}`;
    } catch (error) { toast({ title:"Estimate failed", description:error?.message || "Try again.", variant:"destructive" }); }
    finally { setSavingEstimate(false); }
  };

  const handleSaveReport = async () => {
    if (!autoVehicle) { setManualVehicleOpen(true); return; }
    setSavingScan(true);
    try {
      const context=await ensureScannerVehicle();
      await base44.entities.DiagnosticScan.create({ customer_id:context.custId, customer_name:context.custName, vehicle_id:context.vehId, vehicle_info:context.vehInfo, shop_owner_email:user.email, adapter_name:adapterName, mileage:autoVehicle.mileage_km ?? autoVehicle.mileage ?? undefined, dtc_codes:allScanCodes(), live_data_snapshot:scanResults?.liveSnapshot || {}, ai_analysis:{ summary:aiSummary, findings:Object.values(analysisByCode) }, status:"Completed" });
      toast({ title:"Scan report saved" });
    } catch (error) { toast({ title:"Save failed", description:error?.message || "Try again.", variant:"destructive" }); }
    finally { setSavingScan(false); }
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
    : autoVehicle ? `${autoVehicle.year || ""} ${autoVehicle.make || ""} ${autoVehicle.model || ""}`.trim() : "—";

  // ── Pro gate ───────────────────────────────────────────────────────────
  if (user && !isPro) {
    return (
      <div className="max-w-lg mx-auto mt-16 text-center space-y-4 bg-gray-900 border border-gray-800 rounded-xl p-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-sky-500/5 to-transparent pointer-events-none" />
        <Microscope className="w-10 h-10 text-sky-400 mx-auto relative" />
        <h2 className="text-xl font-bold text-white relative">LBC AUTO AI SCANNER</h2>
        <p className="text-sky-400 text-sm font-semibold relative">Pro Feature</p>
        <p className="text-gray-400 text-sm relative">
          Live Bluetooth OBD2 scanning, AI-powered diagnosis, live data streaming, and bidirectional ECU commands are included on the Pro plan ($299/mo). You're currently on Basic.
        </p>
        <button onClick={() => (window.location.href = "/Billing")} className="bg-sky-600 hover:bg-sky-700 text-white px-6 py-2 rounded-lg font-semibold relative">
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

      {/* Persistent vehicle identity */}
      {autoVehicle && <VehicleIdentifiedBanner vehicle={autoVehicle} />}
      {connState === "connected" && reportReady && !autoVehicle && <ManualVehicleIdentification open={manualVehicleOpen} onOpenChange={setManualVehicleOpen} onSave={(vehicle) => { setManualVehicle(vehicle); setManualVehicleOpen(false); }} />}

      {/* Background scan progress — visible across all tabs */}
      <ScanProgressBar scanning={scanning} progress={scanProgress} label={scanLabel} />

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
                  ? "bg-sky-600 text-white"
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
        <ScanSessionFlow
          connState={connState}
          connError={connError}
          autoVehicle={autoVehicle}
          scanning={scanning}
          scanProgress={scanProgress}
          scanLabel={scanLabel}
          reportReady={reportReady}
          onConnect={handleConnect}
          onOpenVehiclePanel={() => setShowVehiclePanel(!showVehiclePanel)}
          onEnterVehicleManually={() => setManualVehicleOpen(true)}
          onReopenReport={reopenReport}
          onStartNewScan={handleStartNewScan}
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
          savingScan={savingScan}
          savingEstimate={savingEstimate}
          laborRate={laborRate}
          analysisByCode={analysisByCode}
          analyzingCodes={analyzingCodes}
          onDismiss={dismissReport}
          onAnalyzeCode={(code) => analyzeCodes([code])}
          onAnalyzeAll={() => analyzeCodes(allScanCodes())}
          onAddCodeToRepairOrder={(code) => handleSaveToRepairOrder([code])}
          onSaveToRepairOrder={() => handleSaveToRepairOrder()}
          onCreateEstimate={handleCreateEstimate}
          onSaveReport={handleSaveReport}
          onEnterVehicleManually={() => setManualVehicleOpen(true)}
          onPrint={handlePrintReport}
          onStartNewScan={handleStartNewScan}
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