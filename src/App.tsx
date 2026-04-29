import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Layout from "@/components/Layout";
import LandingPage from "@/pages/LandingPage";
import LoginPage from "@/pages/LoginPage";
import LoginVerification from "@/pages/Login-verification";
import RegisterPage from "@/pages/RegisterPage";
import Verification from "@/pages/Verification";
import DashboardPage from "@/pages/DashboardPage";
import CommunityPage from "@/pages/CommunityPage";
import ThreatMapPage from "@/pages/ThreatMapPage";
import ReportPage from "@/pages/ReportPage";
import ProfilePage from "@/pages/ProfilePage";
import AdminPage from "@/pages/AdminPage";
import NotFound from "@/pages/NotFound";
import Zone from "./pages/Zone";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import { useAuthStore } from "@/stores/authStore";


const queryClient = new QueryClient();

function ProtectedRoute({ children, adminOnly = false }: { children: React.ReactNode; adminOnly?: boolean }) {
  const { isAuthenticated, user, isCheckingSession } = useAuthStore();
  if (isCheckingSession) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (adminOnly && user?.role !== 'admin') return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

const App = () => {
  const { checkSession } = useAuthStore();

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/login-verification" element={<LoginVerification />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/verification" element={<Verification />} />
              <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
              <Route path="/community" element={<CommunityPage />} />
              <Route path="/forgot-password" element={<ForgotPassword/>}/>
              <Route path="/reset-password" element={<ResetPassword/>}/>
              <Route path="/threats" element={<ThreatMapPage />} />
              <Route path="/report" element={<ProtectedRoute><ReportPage /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
              <Route path="/zone" element={<ProtectedRoute > <Zone /> </ProtectedRoute>} />
              <Route path="/admin" element={<ProtectedRoute adminOnly><AdminPage /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
