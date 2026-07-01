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
import Billing from './pages/Billing';
import PartsLookup from './pages/PartsLookup';
import ImportCustomers from './pages/ImportCustomers';
import CustomerDetails from './pages/CustomerDetails';
import MissingPhones from './pages/MissingPhones';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

// ── One-time "New Update" banner ────────────────────────────────────────────
const UPDATE_KEY = "lbc_auto_update_v20260628_payment_history";

const UpdateBanner = ({ user }) => {
  const [visible, setVisible] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    const key = `${UPDATE_KEY}_${user.id || user.email || "guest"}`;
    if (!localStorage.getItem(key)) {
      const t = setTimeout(() => setVisible(true), 700);
      return () => clearTimeout(t);
    }
  }, [user?.id, user?.email]);

  const dismiss = () => {
    const key = `${UPDATE_KEY}_${user?.id || user?.email}`;
    localStorage.setItem(key, "1");
    setVisible(false);
  };

  const goToSettings = () => { dismiss(); navigate("/Settings"); };

  if (!visible) return null;

  return (
    <div style={{
      position:"fixed", inset:0,
      background:"rgba(0,0,0,0.72)",
      backdropFilter:"blur(6px)",
      zIndex:99999,
      display:"flex", alignItems:"center", justifyContent:"center",
      padding:"16px",
    }}>
      <div style={{
        background:"linear-gradient(160deg,#0a0f1e 0%,#0f1e35 60%,#0a1628 100%)",
        border:"1px solid rgba(0,170,255,0.25)",
        borderRadius:"20px",
        padding:"0",
        maxWidth:"460px",
        width:"100%",
        boxShadow:"0 30px 80px rgba(0,0,0,0.6), 0 0 40px rgba(0,170,255,0.08)",
        overflow:"hidden",
        position:"relative",
      }}>

        {/* ── AI Hero Header ── */}
        <div style={{
          background:"linear-gradient(135deg,#001f3f 0%,#002b55 50%,#001a33 100%)",
          borderBottom:"1px solid rgba(0,170,255,0.2)",
          padding:"24px 24px 20px",
          position:"relative",
          overflow:"hidden",
        }}>
          {/* Glow orb */}
          <div style={{
            position:"absolute", top:-40, right:-40,
            width:160, height:160, borderRadius:"50%",
            background:"radial-gradient(circle,rgba(0,170,255,0.18) 0%,transparent 70%)",
            pointerEvents:"none",
          }}/>

          {/* Close */}
          <button onClick={dismiss} style={{
            position:"absolute", top:14, right:16,
            background:"rgba(255,255,255,0.08)", border:"1px solid rgba(255,255,255,0.12)",
            borderRadius:"50%", width:28, height:28,
            cursor:"pointer", color:"#94a3b8", fontSize:16, lineHeight:"28px",
            textAlign:"center", padding:0,
          }}>×</button>

          {/* AI Icon + badge */}
          <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:14 }}>
            <div style={{
              width:52, height:52, borderRadius:14,
              background:"linear-gradient(135deg,#0066cc,#00aaff)",
              boxShadow:"0 0 20px rgba(0,170,255,0.5)",
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:26, flexShrink:0,
            }}>🤖</div>
            <div>
              <div style={{
                display:"inline-flex", alignItems:"center", gap:6,
                background:"rgba(0,170,255,0.15)",
                border:"1px solid rgba(0,170,255,0.3)",
                borderRadius:20, padding:"3px 10px",
                marginBottom:4,
              }}>
                <div style={{ width:6, height:6, borderRadius:"50%", background:"#00ff88", boxShadow:"0 0 6px #00ff88" }}/>
                <span style={{ color:"#00aaff", fontSize:11, fontWeight:700, letterSpacing:"0.06em" }}>NOW LIVE</span>
              </div>
              <h2 style={{ color:"#f1f5f9", fontSize:17, fontWeight:800, margin:0, lineHeight:1.2 }}>
                LBC Auto — New Updates
              </h2>
            </div>
          </div>

          <p style={{ color:"#94a3b8", fontSize:13, lineHeight:1.65, margin:0 }}>
            <strong style={{ color:"#38bdf8" }}>Payment History Manager</strong> is live — edit or delete individual payments directly on any invoice. Plus <strong style={{ color:"#e2e8f0" }}>Send to Repair Order</strong>, AI assistant upgrades, and Center Control v2 syncing.
          </p>

          {/* Feature chips */}
          <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginTop:14 }}>
            {["🔧 Repair Diagnostics","📋 Labor Hours","🦀 Rust Multipliers","⚡ OBD-II Codes","🚗 Vehicle History","💡 Fix Recommendations"].map(chip => (
              <span key={chip} style={{
                background:"rgba(0,170,255,0.1)", border:"1px solid rgba(0,170,255,0.2)",
                borderRadius:20, padding:"4px 10px", fontSize:11, color:"#93c5fd", fontWeight:600,
              }}>{chip}</span>
            ))}
          </div>

          {/* How to use */}
          <div style={{
            marginTop:14, padding:"10px 12px",
            background:"rgba(0,255,136,0.06)", borderRadius:10,
            border:"1px solid rgba(0,255,136,0.15)",
            display:"flex", alignItems:"center", gap:10,
          }}>
            <span style={{ fontSize:18 }}>💬</span>
            <span style={{ color:"#6ee7b7", fontSize:12, lineHeight:1.5 }}>
              Open any invoice → tap <strong>Edit Payments</strong> to fix, adjust, or remove payment entries. All totals recalculate automatically.
            </span>
          </div>
        </div>

        {/* ── Platform Updates ── */}
        <div style={{ padding:"18px 24px 22px" }}>
          <p style={{ color:"#475569", fontSize:11, textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:700, marginBottom:12 }}>
            Also in this update
          </p>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:18 }}>
            {[
              ["📜","Payment History","Edit or delete individual payments on any invoice"],
              ["🔁","Send to Repair Order","Convert any invoice to a repair order in one click"],
              ["🤖","LBC Auto AI","Floating AI assistant on every page — ask it anything"],
              ["💲","Discount: $ or %","Fixed dollar or percentage discount on every job"],
              ["⚙️","Default Labor Rate","Set once, auto-fills every new labor row"],
              ["👤","Center Control v2","All record changes sync back to the customer profile"],
            ].map(([icon, title, desc]) => (
              <div key={title} style={{
                background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)",
                borderRadius:10, padding:"10px 12px",
              }}>
                <div style={{ fontSize:16, marginBottom:4 }}>{icon}</div>
                <div style={{ color:"#e2e8f0", fontSize:12, fontWeight:700, marginBottom:2 }}>{title}</div>
                <div style={{ color:"#64748b", fontSize:11, lineHeight:1.4 }}>{desc}</div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div style={{ display:"flex", gap:10 }}>
            {!user?.labor_rate && (
              <button onClick={goToSettings} style={{
                flex:1, padding:"11px 0",
                background:"linear-gradient(135deg,#3b82f6,#06b6d4)",
                color:"#fff", fontWeight:700, fontSize:13,
                border:"none", borderRadius:10, cursor:"pointer",
                boxShadow:"0 4px 15px rgba(59,130,246,0.35)",
              }}>
                ⚙️ Set Labor Rate →
              </button>
            )}
            <button onClick={dismiss} style={{
              flex:1, padding:"11px 0",
              background: user?.labor_rate
                ? "linear-gradient(135deg,#0066cc,#00aaff)"
                : "rgba(255,255,255,0.07)",
              color: user?.labor_rate ? "#fff" : "#94a3b8",
              fontWeight:700, fontSize:13,
              border: user?.labor_rate ? "none" : "1px solid rgba(255,255,255,0.1)",
              borderRadius:10, cursor:"pointer",
              boxShadow: user?.labor_rate ? "0 4px 15px rgba(0,170,255,0.35)" : "none",
            }}>
              {user?.labor_rate ? "🚀 Let's Go!" : "Got it"}
            </button>
          </div>

          <p style={{ color:"#334155", fontSize:11, textAlign:"center", marginTop:10 }}>
            Powered by <strong style={{ color:"#0066cc" }}>Lumina</strong> · LBC Network
          </p>
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

  // PUBLIC ROUTES — bypass all auth, render immediately, no login required
  const PUBLIC_PATHS = ['/CustomerPortal', '/CustomerDashboard', '/TechPortal', '/TechDashboard', '/TechJobView', '/landing'];
  if (PUBLIC_PATHS.some(p => location.pathname.startsWith(p))) {
    return (
      <Routes>
        <Route path="/CustomerPortal" element={<CustomerPortal />} />
        <Route path="/CustomerDashboard" element={<CustomerDashboard />} />
        <Route path="/TechPortal" element={<TechPortal />} />
        <Route path="/TechDashboard" element={<TechDashboard />} />
        <Route path="/TechJobView" element={<TechJobView />} />
        <Route path="/landing" element={<Landing />} />
      </Routes>
    );
  }

  useEffect(() => {
    if (user && !user.trial_started_date) {
      base44.functions.invoke('initializeUserTrial', {});
    }
  }, [user]);

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
        <Route path="/PaymentWall" element={<PaymentWall />} />
        <Route path="/landing" element={<Landing />} />
        <Route path="/TechPortal" element={<TechPortal />} />
        <Route path="/CustomerProfile/:id" element={<CustomerProfile />} />
        <Route path="/CustomerPortal" element={<CustomerPortal />} />
        <Route path="/CustomerDashboard" element={<CustomerDashboard />} />
        <Route path="/CustomerHub" element={<LayoutWrapper currentPageName="CustomerHub"><CustomerHub /></LayoutWrapper>} />
        <Route path="/TechDashboard" element={<TechDashboard />} />
        <Route path="/TechJobView" element={<TechJobView />} />
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
