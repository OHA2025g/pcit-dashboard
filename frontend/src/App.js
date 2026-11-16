import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { MotionConfig } from "framer-motion";
import { Show, SignIn, SignUp } from "@clerk/react";
import ClerkAuthProvider, { useLocalAuth } from "@/components/auth/ClerkAuthProvider";
import { MeProvider } from "@/lib/api";
import { Toaster } from "@/components/ui/sonner";
import AppShell from "@/components/AppShell";
import AuthLayout from "@/pages/AuthLayout";
import Overview from "@/pages/Overview";
import DomainDashboard from "@/pages/DomainDashboard";
import AdminPage from "@/pages/admin/AdminPage";
import TrendsPage from "@/pages/TrendsPage";
import ReportsPage from "@/pages/ReportsPage";
import ApprovalsPage from "@/pages/ApprovalsPage";

const Protected = () => {
  const { localMode } = useLocalAuth();
  if (localMode) {
    return <MeProvider><AppShell /></MeProvider>;
  }
  return (
    <>
      <Show when="signed-in">
        <MeProvider><AppShell /></MeProvider>
      </Show>
      <Show when="signed-out"><Navigate to="/sign-in" replace /></Show>
    </>
  );
};

const AuthRoute = ({ children }) => {
  const { localMode } = useLocalAuth();
  if (localMode) return <Navigate to="/" replace />;
  return children;
};

function App() {
  return (
    <MotionConfig reducedMotion="user">
      <div className="App page-grain">
        <BrowserRouter>
          <ClerkAuthProvider>
            <Routes>
              <Route path="/sign-in/*" element={<AuthRoute><AuthLayout><SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" withSignUp /></AuthLayout></AuthRoute>} />
              <Route path="/sign-up/*" element={<AuthRoute><AuthLayout><SignUp routing="path" path="/sign-up" signInUrl="/sign-in" /></AuthLayout></AuthRoute>} />
              <Route path="/" element={<Protected />}>
                <Route index element={<Overview />} />
                <Route path="conviction" element={<DomainDashboard key="conviction" domain="conviction" />} />
                <Route path="timeliness" element={<DomainDashboard key="timeliness" domain="timeliness" />} />
                <Route path="112" element={<DomainDashboard key="emergency112" domain="emergency112" />} />
                <Route path="training" element={<DomainDashboard key="training" domain="training" />} />
                <Route path="admin" element={<AdminPage />} />
                <Route path="trends" element={<TrendsPage />} />
                <Route path="reports" element={<ReportsPage />} />
                <Route path="approvals" element={<ApprovalsPage />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            <Toaster position="top-right" />
          </ClerkAuthProvider>
        </BrowserRouter>
      </div>
    </MotionConfig>
  );
}

export default App;
