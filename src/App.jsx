import { useEffect } from 'react';
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { base44 } from '@/api/base44Client'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
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

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

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
      <Route path="/PaymentWall" element={<PaymentWall />} />
      <Route path="/landing" element={<Landing />} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
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