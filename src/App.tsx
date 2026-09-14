import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "./components/layout/ProtectedRoute";
import OwnerRoute from "./components/layout/OwnerRoute";
import CompanyFeatureRoute from "./components/layout/CompanyFeatureRoute";
import AppLayout from "./components/layout/AppLayout";
import ErrorBoundary from "./components/layout/ErrorBoundary";
import Index from "./pages/Index";
import Cameras from "./pages/Cameras";
import Clients from "./pages/Clients";
import Guards from "./pages/Guards";
import Financial from "./pages/Financial";
import Alarms from "./pages/Alarms";
import AlarmPanels from "./pages/AlarmPanels";
import Settings from "./pages/Settings";
import Installers from "./pages/Installers";
import ServiceOrders from "./pages/ServiceOrders";
import Support from "./pages/Support";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import Analytics from "./pages/Analytics";
import Recordings from "./pages/Recordings";
import SystemHealth from "./pages/SystemHealth";
import CameraMap from "./pages/CameraMap";
import Timeline from "./pages/Timeline";
import LiveGrid from "./pages/LiveGrid";
import Stock from "./pages/Stock";
import Quotes from "./pages/Quotes";
import Sales from "./pages/Sales";
import NotFound from "./pages/NotFound";
import Install from "./pages/Install";
import OwnerDashboard from "./pages/OwnerDashboard";
import CloudAnalyticsRunner from "./components/analytics/CloudAnalyticsRunner";
import BrowserTitle from "./components/layout/BrowserTitle";

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserTitle />
        <CloudAnalyticsRunner />
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/install" element={<Install />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
                <Route path="/" element={<CompanyFeatureRoute module="dashboard"><Index /></CompanyFeatureRoute>} />
                <Route path="/cameras" element={<CompanyFeatureRoute module="cameras_view"><Cameras /></CompanyFeatureRoute>} />
                <Route path="/recordings" element={<CompanyFeatureRoute module="cameras_view"><Recordings /></CompanyFeatureRoute>} />
                <Route path="/clients" element={<CompanyFeatureRoute module="clients_view"><Clients /></CompanyFeatureRoute>} />
                <Route path="/guards" element={<CompanyFeatureRoute module="guards"><Guards /></CompanyFeatureRoute>} />
                <Route path="/financial" element={<CompanyFeatureRoute module="financial"><Financial /></CompanyFeatureRoute>} />
                <Route path="/alarms" element={<CompanyFeatureRoute module="alarms"><Alarms /></CompanyFeatureRoute>} />
                <Route path="/alarm-panels" element={<CompanyFeatureRoute module="alarms"><AlarmPanels /></CompanyFeatureRoute>} />
                <Route path="/installers" element={<CompanyFeatureRoute module="installers"><Installers /></CompanyFeatureRoute>} />
                <Route path="/service-orders" element={<CompanyFeatureRoute module="service_orders"><ServiceOrders /></CompanyFeatureRoute>} />
                <Route path="/support" element={<CompanyFeatureRoute module="support"><Support /></CompanyFeatureRoute>} />
                <Route path="/analytics" element={<CompanyFeatureRoute module="analytics"><Analytics /></CompanyFeatureRoute>} />
                <Route path="/system-health" element={<CompanyFeatureRoute module="settings"><SystemHealth /></CompanyFeatureRoute>} />
                <Route path="/camera-map" element={<CompanyFeatureRoute module="cameras_view"><CameraMap /></CompanyFeatureRoute>} />
                <Route path="/timeline" element={<CompanyFeatureRoute module="cameras_view"><Timeline /></CompanyFeatureRoute>} />
                <Route path="/live" element={<CompanyFeatureRoute module="cameras_view"><LiveGrid /></CompanyFeatureRoute>} />
                <Route path="/stock" element={<CompanyFeatureRoute module="financial"><Stock /></CompanyFeatureRoute>} />
                <Route path="/quotes" element={<CompanyFeatureRoute module="financial"><Quotes /></CompanyFeatureRoute>} />
                <Route path="/sales" element={<CompanyFeatureRoute module="financial"><Sales /></CompanyFeatureRoute>} />
                <Route path="/settings" element={<CompanyFeatureRoute module="settings"><Settings /></CompanyFeatureRoute>} />
                <Route path="/owner" element={<OwnerRoute><OwnerDashboard /></OwnerRoute>} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
