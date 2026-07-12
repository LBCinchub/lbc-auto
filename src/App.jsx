import { useEffect, useState } from 'react';
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { base44 } from '@/api/base44Client'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes, useNavigate, useLocation } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { ThemeProvider } from '@/lib/ThemeContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import InvoiceSign from './pages/InvoiceSign';
import Estimates from './pages/Estimates';
import EstimateDetail from './pages/EstimateDetail';
import TimeTracking from './pages/TimeTracking';
import Payroll from './pages/Payroll';
import VehicleTimeline from './pages/VehicleTimeline';
import RepairOrderDetail from './pages/RepairOrderDetail';
import InvoiceDetail from './pages/InvoiceDetail';
import Settings from './pages/Settings';
import PaymentWall from './pages/PaymentWall';
import Landing from './pages/Landing';
import TechPortal from './pages/TechPortal';
import CustomerProfile from './pages/CustomerProfile';
import CustomerPortal from './pages/CustomerPortal';
import CustomerDashboard from './pages/CustomerDashboard';
import CustomerHub from './pages/CustomerHub';
import TechDashboard from './pages/TechDashboard';
import TechJobView from './pages/TechJobView';
import OfficeAssistant from './pages/OfficeAssistant';
import Billing from './pages/Billing';
import PartsLookup from './pages/PartsLookup';
import ImportCustomers from './pages/ImportCustomers';
import CustomerDetails from './pages/CustomerDetails';
import MissingPhones from './pages/MissingPhones';
import Diagnostics from './pages/Diagnostics';
import ChatInbox from './pages/ChatInbox';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

// ── One-time "New Update" banner ────────────────────────────────────────────
const UPDATE_KEY = "lbc_banner_dismissed_v20260711";

const UpdateBanner = ({ user }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (!localStorage.getItem(UPDATE_KEY)) {
      setVisible(true);
    }
  }, [user]);

  // Prevent Escape key from closing
  useEffect(() => {
    if (!visible) return;
    const handler = (e) => {
      if (e.key === "Escape") e.preventDefault();
    };
    window.addEventListener("keydown", handler, { capture: true });
    return () => window.removeEventListener("keydown", handler, { capture: true });
  }, [visible]);

  const dismiss = () => {
    localStorage.setItem(UPDATE_KEY, "true");
    setVisible(false);
  };

  if (!visible) return null;

  const fixes = [
    { title: "INVOICE FIX", desc: "All service descriptions, parts & labor notes now carry over perfectly when converting an Estimate to Invoice or using Cash Out." },
    { title: "INVOICE NUMBERS", desc: "Every invoice now gets a unique number automatically — no more missing IDs." },
    { title: "ESTIMATE STATUS", desc: 'Estimates now correctly update to "Invoiced" after you cash out or convert them.' },
    { title: "ROUNDING FIXED", desc: "Balance due amounts now show clean numbers (no more $0.0025 rounding errors)." },
  ];

  const features = [
    { title: "LBC AUTO AI SCANNER", desc: "Diagnostics fully rebuilt. 3 modes: Scan Mode (full system DTC scan with AI holistic diagnosis), Live Data (16 sensors streaming real-time), Tech Mode (type commands like \"o2 reading\" or \"caliper test\"). Now supports EV/Hybrid vehicles.", badge: "PRO" },
    { title: "PHOTO & CAMERA IN AI CHAT", desc: "Take a photo or upload one directly in the AI assistant. AI analyzes damage, wear, parts, or DTC codes on your scanner screen." },
    { title: "CUSTOMER VEHICLE PHOTOS", desc: "Save any AI photo to a customer's profile. Full history — photos, AI notes, linked to estimates and repair orders." },
    { title: "PRINTABLE VEHICLE HISTORY REPORT", desc: "One click → clean printed report with full service history, photos, open balances. Email it directly to your customer." },
  ];

  return (
    <div style={{
      position:"fixed", inset:0,
      background:"rgba(0,0,0,0.85)",
      zIndex:9999,
      display:"flex", alignItems:"center", justifyContent:"center",
      padding:"16px",
    }}>
      <div style={{
        background:"linear-gradient(160deg,#0a0f1e 0%,#111827 50%,#0a0f1e 100%)",
        border:"1px solid rgba(255,255,255,0.08)",
        borderRadius:"16px",
        maxWidth:"560px",
        width:"100%",
        maxHeight:"90vh",
        overflowY:"auto",
        boxShadow:"0 30px 80px rgba(0,0,0,0.6)",
        position:"relative",
      }}>

        {/* ── Header ── */}
        <div style={{
          padding:"28px 28px 20px",
          textAlign:"center",
          borderBottom:"1px solid rgba(255,255,255,0.06)",
        }}>
          <div style={{ fontSize:32, marginBottom:8 }}>⚡</div>
          <h1 style={{ color:"#f1f5f9", fontSize:20, fontWeight:800, margin:0, letterSpacing:"-0.02em" }}>
            LBC AUTO — PLATFORM UPDATE
          </h1>
          <p style={{ color:"#64748b", fontSize:13, margin:"6px 0 0" }}>July 11, 2026</p>
          <p style={{ color:"#94a3b8", fontSize:13, lineHeight:1.6, margin:"14px 0 0" }}>
            We've been working hard behind the scenes. Here's what's new for your shop:
          </p>
        </div>

        {/* ── Body ── */}
        <div style={{ padding:"20px 28px" }}>

          {/* Fixes */}
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
            <span style={{ color:"#10b981", fontSize:16 }}>✅</span>
            <span style={{ color:"#10b981", fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.06em" }}>Fixes & Improvements</span>
          </div>
          <div style={{ space:"8px" }}>
            {fixes.map((f, i) => (
              <div key={i} style={{
                marginBottom:10, paddingLeft:28, position:"relative",
              }}>
                <span style={{ position:"absolute", left:0, top:0, color:"#10b981", fontSize:14, fontWeight:700 }}>✓</span>
                <div style={{ color:"#e2e8f0", fontSize:12, fontWeight:700, marginBottom:2 }}>{f.title}</div>
                <div style={{ color:"#94a3b8", fontSize:12, lineHeight:1.5 }}>{f.desc}</div>
              </div>
            ))}
          </div>

          {/* Divider */}
          <div style={{ height:1, background:"rgba(255,255,255,0.06)", margin:"16px 0" }} />

          {/* New features */}
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
            <span style={{ color:"#60a5fa", fontSize:16 }}>✨</span>
            <span style={{ color:"#60a5fa", fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.06em" }}>New Features</span>
          </div>
          {features.map((feat, i) => (
            <div key={i} style={{
              marginBottom:12, paddingLeft:28, position:"relative",
            }}>
              <span style={{ position:"absolute", left:0, top:0, color:"#60a5fa", fontSize:14, fontWeight:700 }}>🆕</span>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:2 }}>
                <span style={{ color:"#e2e8f0", fontSize:12, fontWeight:700 }}>{feat.title}</span>
                {feat.badge && (
                  <span style={{
                    background:"rgba(217,70,239,0.15)", color:"#e879f9",
                    border:"1px solid rgba(217,70,239,0.3)",
                    borderRadius:4, padding:"1px 6px", fontSize:9, fontWeight:700,
                  }}>{feat.badge}</span>
                )}
              </div>
              <div style={{ color:"#94a3b8", fontSize:12, lineHeight:1.5 }}>{feat.desc}</div>
            </div>
          ))}

          {/* Divider */}
          <div style={{ height:1, background:"rgba(255,255,255,0.06)", margin:"16px 0" }} />

          {/* Contact */}
          <p style={{ color:"#64748b", fontSize:12, textAlign:"center", marginBottom:18 }}>
            Questions? Contact LBC Support: <strong style={{ color:"#94a3b8" }}>613-314-1994</strong>
          </p>

          {/* GOT IT button */}
          <button onClick={dismiss} style={{
            width:"100%", padding:"13px 0",
            background:"#10b981",
            color:"#fff", fontWeight:700, fontSize:14,
            border:"none", borderRadius:10, cursor:"pointer",
            boxShadow:"0 4px 15px rgba(16,185,129,0.3)",
          }}>
            ✓ GOT IT — LET'S GO
          </button>
        </div>
      </div>
    </div>
  );
};

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const AuthenticatedApp = () => {
  const { user, isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();
  const location = useLocation();

  useEffect(() => {
    if (user && !user.trial_started_date) {
      base44.functions.invoke('initializeUserTrial', {});
    }
  }, [user]);

  // PUBLIC ROUTES — bypass all auth, render immediately, no login required
  const PUBLIC_PATHS = ['/CustomerPortal', '/lbc-customer', '/CustomerDashboard', '/TechPortal', '/lbc-team', '/TechDashboard', '/TechJobView', '/OfficeAssistant', '/landing'];
  if (PUBLIC_PATHS.some(p => location.pathname.startsWith(p))) {
    return (
      <Routes>
        <Route path="/CustomerPortal" element={<CustomerPortal />} />
        <Route path="/lbc-customer" element={<CustomerPortal />} />
        <Route path="/CustomerDashboard" element={<CustomerDashboard />} />
        <Route path="/TechPortal" element={<TechPortal />} />
        <Route path="/lbc-team" element={<TechPortal />} />
        <Route path="/TechDashboard" element={<TechDashboard />} />
        <Route path="/TechJobView" element={<TechJobView />} />
        <Route path="/OfficeAssistant" element={<OfficeAssistant />} />
        <Route path="/landing" element={<Landing />} />
      </Routes>
    );
  }

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Check trial and subscription status
  if (user) {
    const trialStarted = user.trial_started_date ? new Date(user.trial_started_date) : new Date(user.created_date);
    const trialEndDate = new Date(trialStarted);
    trialEndDate.setDate(trialEndDate.getDate() + 7);
    const now = new Date();

    if (now > trialEndDate && user.subscription_status !== 'active') {
      return <Routes><Route path="*" element={<PaymentWall />} /></Routes>;
    }

    // Monthly billing check — active users get gated back to the payment wall
    // once their 30-day period lapses without a renewal payment.
    if (user.subscription_status === 'active' && user.setup_fee_paid && user.next_billing_date) {
      const nextBillingDate = new Date(user.next_billing_date);
      if (now > nextBillingDate) {
        return <Routes><Route path="*" element={<PaymentWall />} /></Routes>;
      }
    }
  }

  // Render the main app
  return (
    <>
      {/* One-time update notification */}
      {user && <UpdateBanner user={user} />}

      <Routes>
        <Route path="/" element={
          <LayoutWrapper currentPageName={mainPageKey}>
            <MainPage />
          </LayoutWrapper>
        } />
        {Object.entries(Pages).map(([path, Page]) => (
          <Route
            key={path}
            path={`/${path}`}
            element={
              <LayoutWrapper currentPageName={path}>
                <Page />
              </LayoutWrapper>
            }
          />
        ))}
        <Route path="/InvoiceSign" element={<InvoiceSign />} />
        <Route path="/Estimates" element={<LayoutWrapper currentPageName="Estimates"><Estimates /></LayoutWrapper>} />
        <Route path="/EstimateDetail/:estimateId" element={<LayoutWrapper currentPageName="Estimates"><EstimateDetail /></LayoutWrapper>} />
        <Route path="/TimeTracking" element={<LayoutWrapper currentPageName="TimeTracking"><TimeTracking /></LayoutWrapper>} />
        <Route path="/Payroll" element={<LayoutWrapper currentPageName="Payroll"><Payroll /></LayoutWrapper>} />
        <Route path="/VehicleTimeline/:vehicleId" element={<LayoutWrapper currentPageName="Vehicles"><VehicleTimeline /></LayoutWrapper>} />
        <Route path="/RepairOrderDetail/:orderId" element={<LayoutWrapper currentPageName="Repair Orders"><RepairOrderDetail /></LayoutWrapper>} />
        <Route path="/InvoiceDetail/:invoiceId" element={<LayoutWrapper currentPageName="Invoices"><InvoiceDetail /></LayoutWrapper>} />
        <Route path="/Settings" element={<LayoutWrapper currentPageName="Settings"><Settings /></LayoutWrapper>} />
        <Route path="/Billing" element={<LayoutWrapper currentPageName="Billing"><Billing /></LayoutWrapper>} />
        <Route path="/PartsLookup" element={<LayoutWrapper currentPageName="PartsLookup"><PartsLookup /></LayoutWrapper>} />
        <Route path="/ImportCustomers" element={<LayoutWrapper currentPageName="ImportCustomers"><ImportCustomers /></LayoutWrapper>} />
        <Route path="/CustomerDetails" element={<LayoutWrapper currentPageName="Customers"><CustomerDetails /></LayoutWrapper>} />
        <Route path="/MissingPhones" element={<LayoutWrapper currentPageName="MissingPhones"><MissingPhones /></LayoutWrapper>} />
        <Route path="/Diagnostics" element={<LayoutWrapper currentPageName="Diagnostics"><Diagnostics /></LayoutWrapper>} />
        <Route path="/ChatInbox" element={<LayoutWrapper currentPageName="ChatInbox"><ChatInbox /></LayoutWrapper>} />
        <Route path="/PaymentWall" element={<PaymentWall />} />
        <Route path="/landing" element={<Landing />} />
        <Route path="/TechPortal" element={<TechPortal />} />
        <Route path="/lbc-team" element={<TechPortal />} />
        <Route path="/CustomerProfile/:id" element={<CustomerProfile />} />
        <Route path="/CustomerPortal" element={<CustomerPortal />} />
        <Route path="/lbc-customer" element={<CustomerPortal />} />
        <Route path="/CustomerDashboard" element={<CustomerDashboard />} />
        <Route path="/CustomerHub" element={<LayoutWrapper currentPageName="CustomerHub"><CustomerHub /></LayoutWrapper>} />
        <Route path="/TechDashboard" element={<TechDashboard />} />
        <Route path="/TechJobView" element={<TechJobView />} />
        <Route path="/OfficeAssistant" element={<OfficeAssistant />} />
        <Route path="*" element={<PageNotFound />} />
      </Routes>
    </>
  );
};


function App() {

  return (
    <ThemeProvider>
      <AuthProvider>
        <QueryClientProvider client={queryClientInstance}>
          <Router>
            <AuthenticatedApp />
          </Router>
          <Toaster />
        </QueryClientProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App