import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ShieldCheck, LayoutGrid, Scale, Timer, PhoneCall, GraduationCap, Users, Settings2, Loader2, Clock, LineChart, Stamp, Mail, LogOut } from "lucide-react";
import { useMe } from "@/lib/api";
import { useAuth } from "@/components/auth/AuthProvider";
import { ROLE_LABELS } from "@/lib/format";
import { LOGOUT } from "@/constants/testIds/auth";
import { Button } from "@/components/ui/button";

const NAV = [
  { to: "/", label: "Overview", icon: LayoutGrid, end: true, id: "nav-overview" },
  { to: "/conviction", label: "Conviction", icon: Scale, id: "nav-conviction" },
  { to: "/timeliness", label: "60-90 Days Charge Sheet", title: "60-90 Days Charge Sheet", icon: Timer, id: "nav-timeliness" },
  { to: "/112", label: "112", title: "112 Performance", icon: PhoneCall, id: "nav-112" },
  { to: "/training", label: "Training", title: "Training Performance", icon: GraduationCap, id: "nav-training" },
  { to: "/antf", label: "ANTF", title: "ANTF Meetings", icon: Users, id: "nav-antf" },
  { to: "/trends", label: "Trends", icon: LineChart, id: "nav-trends" },
  { to: "/reports", label: "Reports", icon: Mail, id: "nav-reports", roles: ["admin", "approver", "state_viewer"] },
  { to: "/approvals", label: "Approvals", icon: Stamp, id: "nav-approvals", roles: ["admin", "approver"] },
  { to: "/admin", label: "Admin", icon: Settings2, id: "nav-admin", roles: ["admin"] },
];

const PendingScreen = ({ me }) => (
  <div className="max-w-xl mx-auto mt-24 surface-panel p-10 rounded-sm rise" data-testid="pending-approval-screen">
    <Clock className="h-8 w-8 text-teal-700" />
    <h2 className="font-display text-2xl font-semibold mt-4">Awaiting access approval</h2>
    <p className="text-sm text-slate-600 mt-3">You are signed in as <b>{me.email}</b>. An administrator must assign you a State viewer or Range viewer role before you can see performance data.</p>
  </div>
);

export default function AppShell() {
  const { me, error } = useMe();
  const { logout } = useAuth();
  const navigate = useNavigate();

  const onLogout = async () => {
    await logout();
    navigate("/sign-in", { replace: true });
  };

  return (
    <div className="min-h-screen">
      <header className="bg-brand-chrome text-white sticky top-0 z-50 border-b border-slate-800 relative overflow-hidden" data-testid="app-header">
        <div className="absolute inset-0 grid-texture opacity-40 pointer-events-none" />
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-teal-500/45 to-transparent" />
        <div className="relative px-3 md:px-5 h-16 flex items-center gap-3">
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="h-9 w-9 rounded-sm bg-teal-600 flex items-center justify-center brand-tick">
              <ShieldCheck className="h-5 w-5 text-white" />
            </div>
            <div className="leading-tight hidden xl:block">
              <div className="font-display font-bold text-[15px] tracking-tight">Police Performance</div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-teal-400">Dashboard</div>
            </div>
          </div>
          {me && me.role !== "pending" && (
            <nav className="flex flex-1 items-center justify-start gap-0.5 min-w-0 overflow-hidden" data-testid="app-nav">
              {NAV.filter((n) => !n.roles || n.roles.includes(me.role)).map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  end={n.end}
                  title={n.title || n.label}
                  data-testid={n.id}
                  className={({ isActive }) => `relative flex items-center gap-1.5 px-2 lg:px-2.5 h-9 rounded-sm text-[13px] whitespace-nowrap transition-colors shrink-0 ${isActive ? "text-white" : "text-slate-400 hover:text-white hover:bg-white/5"}`}
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <motion.span
                          layoutId="nav-active"
                          className="absolute inset-0 rounded-sm bg-white/10 border border-white/5"
                          transition={{ type: "spring", stiffness: 380, damping: 32 }}
                        />
                      )}
                      <span className="relative flex items-center gap-1.5">
                        <n.icon className="h-4 w-4 shrink-0" />
                        <span className="hidden md:inline">{n.label}</span>
                      </span>
                      {isActive && <span className="absolute left-1.5 right-1.5 -bottom-0.5 h-0.5 rounded-full bg-teal-400" />}
                    </>
                  )}
                </NavLink>
              ))}
            </nav>
          )}
          <div className="ml-auto flex items-center gap-2 shrink-0">
            {me && (
              <span className="hidden xl:inline-flex items-center gap-2 text-xs border border-teal-500/40 text-teal-300 px-2.5 py-1 rounded-sm bg-teal-500/5" data-testid="role-badge">
                {ROLE_LABELS[me.role]}{me.range ? ` · ${me.range}` : ""}
              </span>
            )}
            {me && (
              <span className="hidden 2xl:inline text-xs text-slate-400 max-w-[140px] truncate" data-testid="user-email" title={me.email}>
                {me.email}
              </span>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onLogout}
              className="h-8 px-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-sm"
              data-testid={LOGOUT.button}
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
              <span className="ml-1.5 hidden xl:inline">Sign out</span>
            </Button>
          </div>
        </div>
      </header>
      <div className="h-3 bg-gradient-to-b from-brand-chrome/10 to-transparent pointer-events-none" />
      <main className="px-4 md:px-8 pb-8 md:pb-10 max-w-[1600px] mx-auto">
        {error && <div className="text-rose-700 text-sm" data-testid="me-error">{error}</div>}
        {!me && !error && <div className="flex items-center gap-2 text-slate-500 mt-20 justify-center"><Loader2 className="h-5 w-5 animate-spin" /> Loading your access…</div>}
        {me && (me.role === "pending" ? <PendingScreen me={me} /> : <Outlet />)}
      </main>
    </div>
  );
}
