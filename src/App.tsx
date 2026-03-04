import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "./components/layout/ProtectedRoute";
import AppLayout from "./components/layout/AppLayout";
import Index from "./pages/Index";
import Cameras from "./pages/Cameras";
import Clients from "./pages/Clients";
import Guards from "./pages/Guards";
import Financial from "./pages/Financial";
import Alarms from "./pages/Alarms";
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
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route path="/" element={<Index />} />
              <Route path="/cameras" element={<Cameras />} />
              <Route path="/recordings" element={<Recordings />} />
              <Route path="/clients" element={<Clients />} />
              <Route path="/guards" element={<Guards />} />
              <Route path="/financial" element={<Financial />} />
              <Route path="/alarms" element={<Alarms />} />
              <Route path="/installers" element={<Installers />} />
              <Route path="/service-orders" element={<ServiceOrders />} />
              <Route path="/support" element={<Support />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/system-health" element={<SystemHealth />} />
              <Route path="/camera-map" element={<CameraMap />} />
              <Route path="/timeline" element={<Timeline />} />
              <Route path="/settings" element={<Settings />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
