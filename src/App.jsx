import { useEffect, useState } from 'react';
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { base44 } from '@/api/base44Client'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes, useNavigate } from 'react-router-dom';
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
import Billing from './pages/Billing';
import PartsLookup from './pages/PartsLookup';
import ImportCustomers from './pages/ImportCustomers';
import CustomerDetails from './pages/CustomerDetails';
import MissingPhones from './pages/MissingPhones';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

// ── One-time "New Update" banner ────────────────────────────────────────────
const UPDATE_KEY = "lbc_auto_update_v20260626_labor_rate";

const UpdateBanner = ({ user }) => {
  const [visible, setVisible] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    const key = `${UPDATE_KEY}_${user.id || user.email}`;
    const dismissed = localStorage.getItem(key);
    // Show only if: not dismissed AND labor_rate is not set
    if (!dismissed) {
      setVisible(true);
    }
  }, [user]);

  const dismiss = () => {
    const key = `${UPDATE_KEY}_${user?.id || user?.email}`;
    localStorage.setItem(key, "1");
    setVisible(false);
  };

  const goToSettings = () => {
    dismiss();
    navigate("/Settings");
  };

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.65)",
        backdropFilter: "blur(4px)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
    >
      <div
        style={{
          background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
          border: "1px solid rgba(99,179,237,0.3)",
          borderRadius: "16px",
          padding: "28px 28px 24px",
          maxWidth: "420px",
          width: "100%",
          boxShadow: "0 25px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(99,179,237,0.1)",
          position: "relative",
        }}
      >
        {/* Close X */}
        <button
          onClick={dismiss}
          style={{
            position: "absolute", top: "14px", right: "16px",
            background: "none", border: "none", cursor: "pointer",
            color: "#64748b", fontSize: "20px", lineHeight: 1,
          }}
        >×</button>

        {/* Icon */}
        <div style={{
          width: "48px", height: "48px", borderRadius: "12px",
          background: "linear-gradient(135deg, #3b82f6, #06b6d4)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "22px", marginBottom: "16px",
        }}>⚡</div>

        {/* Title */}
        <h2 style={{
          color: "#f1f5f9", fontSize: "18px", fontWeight: 700,
          marginBottom: "6px", lineHeight: 1.3,
        }}>New Update — June 2026</h2>

        {/* Subtitle */}
        <p style={{
          color: "#94a3b8", fontSize: "13px", marginBottom: "16px", lineHeight: 1.6,
        }}>
          We added a <strong style={{ color: "#38bdf8" }}>Default Labor Rate</strong> to your shop settings.
          Set it once and it auto-fills on every new job — no more typing your hourly rate every time.
        </p>

        {/* What's new list */}
        <div style={{
          background: "rgba(255,255,255,0.04)", borderRadius: "10px",
          padding: "12px 14px", marginBottom: "20px",
          border: "1px solid rgba(255,255,255,0.07)",
        }}>
          <p style={{ color: "#64748b", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "8px", fontWeight: 600 }}>
            Also in this update
          </p>
          {[
            "🎨 Sidebar — each item now has its own unique color",
            "💲 Discount — choose $ fixed or % percentage",
            "📄 Discount always shown on print & estimates",
            "🎯 Cashout button right below invoice preview",
          ].map((item, idx) => (
            <p key={idx} style={{ color: "#cbd5e1", fontSize: "12.5px", marginBottom: "5px", lineHeight: 1.5 }}>
              {item}
            </p>
          ))}
        </div>

        {/* CTA buttons */}
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={goToSettings}
            style={{
              flex: 1, padding: "11px 0",
              background: "linear-gradient(135deg, #3b82f6, #06b6d4)",
              color: "#fff", fontWeight: 700, fontSize: "14px",
              border: "none", borderRadius: "10px", cursor: "pointer",
              boxShadow: "0 4px 15px rgba(59,130,246,0.4)",
            }}
          >
            Set My Labor Rate →
          </button>
          <button
            onClick={dismiss}
            style={{
              padding: "11px 18px",
              background: "rgba(255,255,255,0.06)", color: "#94a3b8",
              fontWeight: 600, fontSize: "13px",
              border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px",
              cursor: "pointer",
            }}
          >
            Later
          </button>
        </div>

        {/* Fine print */}
        <p style={{ color: "#475569", fontSize: "11px", textAlign: "center", marginTop: "12px" }}>
          This message appears only once.
        </p>
      </div>
    </div>
  );
};

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const AuthenticatedApp = () => {
  const { user, isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

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
