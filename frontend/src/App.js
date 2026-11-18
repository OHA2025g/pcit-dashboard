import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { MotionConfig } from "framer-motion";
import AuthProvider, { useAuth } from "@/components/auth/AuthProvider";
import { MeProvider } from "@/lib/api";
import { Toaster } from "@/components/ui/sonner";
import AppShell from "@/components/AppShell";
import AuthLayout from "@/pages/AuthLayout";
import SignInPage from "@/pages/SignInPage";
import SignUpPage from "@/pages/SignUpPage";
import Overview from "@/pages/Overview";
import DomainDashboard from "@/pages/DomainDashboard";
import AdminPage from "@/pages/admin/AdminPage";
import TrendsPage from "@/pages/TrendsPage";
import ReportsPage from "@/pages/ReportsPage";
import ApprovalsPage from "@/pages/ApprovalsPage";

const Protected = () => {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/sign-in" replace />;
  return (
    <MeProvider>
      <AppShell />
    </MeProvider>
  );
};

const AuthRoute = ({ children }) => {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) return <Navigate to="/" replace />;
  return children;
};

function App() {
  return (
    <MotionConfig reducedMotion="user">
      <div className="App page-grain">
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/sign-in" element={<AuthRoute><AuthLayout><SignInPage /></AuthLayout></AuthRoute>} />
              <Route path="/sign-up" element={<AuthRoute><AuthLayout><SignUpPage /></AuthLayout></AuthRoute>} />
              <Route path="/" element={<Protected />}>
                <Route index element={<Overview />} />
                <Route path="conviction" element={<DomainDashboard key="conviction" domain="conviction" />} />
                <Route path="timeliness" element={<DomainDashboard key="timeliness" domain="timeliness" />} />
                <Route path="112" element={<DomainDashboard key="emergency112" domain="emergency112" />} />
                <Route path="training" element={<DomainDashboard key="training" domain="training" />} />
                <Route path="antf" element={<DomainDashboard key="antf" domain="antf" />} />
                <Route path="admin" element={<AdminPage />} />
                <Route path="trends" element={<TrendsPage />} />
                <Route path="reports" element={<ReportsPage />} />
                <Route path="approvals" element={<ApprovalsPage />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            <Toaster position="top-right" />
          </AuthProvider>
        </BrowserRouter>
      </div>
    </MotionConfig>
  );
}

export default App;
