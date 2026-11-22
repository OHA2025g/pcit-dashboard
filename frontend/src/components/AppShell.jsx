import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { LayoutGrid, Scale, Timer, PhoneCall, GraduationCap, Users, CarFront, Settings2, Loader2, Clock, Stamp, Mail, LogOut, X } from "lucide-react";
import { useMe } from "@/lib/api";
import { useAuth } from "@/components/auth/AuthProvider";
import { ROLE_LABELS } from "@/lib/format";
import { LOGOUT } from "@/constants/testIds/auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Training & ANTF kept in NAV_ALL; temporarily omitted from the sidebar only (routes/pages stay).
const NAV_HIDDEN = new Set(["/training", "/antf"]);
const NAV_ALL = [
  { to: "/", label: "Overview", icon: LayoutGrid, end: true, id: "nav-overview" },
  { to: "/conviction", label: "Conviction", icon: Scale, id: "nav-conviction" },
  { to: "/timeliness", label: "60-90 Days Charge Sheet", title: "60-90 Days Charge Sheet", icon: Timer, id: "nav-timeliness" },
  { to: "/112", label: "112", title: "112 Performance", icon: PhoneCall, id: "nav-112" },
  { to: "/hsp", label: "HSP", title: "HSP Performance", icon: CarFront, id: "nav-hsp" },
  { to: "/training", label: "Training", title: "Training Performance", icon: GraduationCap, id: "nav-training" },
  { to: "/antf", label: "ANTF", title: "ANTF Meetings", icon: Users, id: "nav-antf" },
  { to: "/reports", label: "Reports", icon: Mail, id: "nav-reports", roles: ["admin", "approver", "state_viewer"] },
  { to: "/approvals", label: "Approvals", icon: Stamp, id: "nav-approvals", roles: ["admin", "approver"] },
  { to: "/admin", label: "Admin", icon: Settings2, id: "nav-admin", roles: ["admin"] },
];
const NAV = NAV_ALL.filter((item) => !NAV_HIDDEN.has(item.to));

const SIDEBAR_EXPANDED = 208;
const SIDEBAR_COLLAPSED = 64;
const MOBILE_BP = 768;

function useIsMobile() {
  const [mobile, setMobile] = useState(() => (
    typeof window !== "undefined" ? window.innerWidth < MOBILE_BP : false
  ));
  useEffect(() => {
    const onResize = () => setMobile(window.innerWidth < MOBILE_BP);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return mobile;
}

const PendingScreen = ({ me }) => (
  <div className="max-w-xl mx-auto mt-10 sm:mt-24 surface-panel p-6 sm:p-10 rounded-sm rise" data-testid="pending-approval-screen">
    <Clock className="h-8 w-8 text-teal-700" />
    <h2 className="font-display text-xl sm:text-2xl font-semibold mt-4">Awaiting access approval</h2>
    <p className="text-sm text-slate-600 mt-3">You are signed in as <b>{me.email}</b>. An administrator must assign you a State viewer or Range viewer role before you can see performance data.</p>
  </div>
);

export default function AppShell() {
  const { me, error } = useMe();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [drawerOpen, setDrawerOpen] = useState(() => (
    typeof window !== "undefined" ? window.innerWidth >= MOBILE_BP : true
  ));

  useEffect(() => {
    if (isMobile) setDrawerOpen(false);
    else setDrawerOpen(true);
  }, [isMobile]);

  useEffect(() => {
    if (!isMobile || !drawerOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [isMobile, drawerOpen]);

  const onLogout = async () => {
    await logout();
    navigate("/sign-in", { replace: true });
  };

  const closeMobileNav = () => {
    if (isMobile) setDrawerOpen(false);
  };

  const navItems = me && me.role !== "pending"
    ? NAV.filter((n) => !n.roles || n.roles.includes(me.role))
    : [];

  const sidebarInner = (
    <div
      className="h-full flex flex-col relative bg-brand-chrome text-white"
      style={{ width: isMobile ? SIDEBAR_EXPANDED : (drawerOpen ? SIDEBAR_EXPANDED : SIDEBAR_COLLAPSED) }}
    >
      <div className="absolute inset-0 grid-texture opacity-40 pointer-events-none" />

      {isMobile && (
        <div className="relative flex items-center justify-between gap-2 px-3 h-14 border-b border-white/10 shrink-0">
          <div className="text-sm font-semibold truncate">Menu</div>
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            className="h-8 w-8 inline-flex items-center justify-center rounded-sm hover:bg-white/10"
            aria-label="Close navigation"
            data-testid="nav-drawer-close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {navItems.length > 0 && (
        <nav
          className={cn(
            "relative flex-1 overflow-y-auto py-3 space-y-0.5",
            (isMobile || drawerOpen) ? "px-2" : "px-1.5",
          )}
          data-testid="app-nav"
        >
          {navItems.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              title={n.title || n.label}
              data-testid={n.id}
              onClick={closeMobileNav}
              className={({ isActive }) =>
                cn(
                  "relative flex items-center h-9 rounded-sm text-[12.5px] transition-colors",
                  (isMobile || drawerOpen) ? "gap-2 px-2" : "justify-center px-0",
                  isActive ? "text-white" : "text-slate-400 hover:text-white hover:bg-white/5",
                )
              }
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
                  {isActive && (
                    <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-teal-400" />
                  )}
                  <span className={cn("relative flex items-center min-w-0", (isMobile || drawerOpen) ? "gap-2" : "justify-center")}>
                    <n.icon className="h-4 w-4 shrink-0" />
                    {(isMobile || drawerOpen) && <span className="truncate leading-tight">{n.label}</span>}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
      )}

      <div className={cn("relative shrink-0 border-t border-white/5 py-2.5 space-y-1.5", (isMobile || drawerOpen) ? "px-2" : "px-1.5")}>
        {me && (isMobile || drawerOpen) && (
          <div className="px-0.5 space-y-1">
            <div className="inline-flex items-center gap-1.5 text-[10px] border border-teal-500/40 text-teal-300 px-1.5 py-0.5 rounded-sm bg-teal-500/5">
              {ROLE_LABELS[me.role]}{me.range ? ` · ${me.range}` : ""}
            </div>
            <div className="text-[10px] text-slate-400 truncate" title={me.email}>
              {me.email}
            </div>
          </div>
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onLogout}
          className={cn(
            "h-8 text-slate-300 hover:text-white hover:bg-white/10 rounded-sm",
            (isMobile || drawerOpen) ? "w-full justify-start px-2" : "w-full justify-center px-0",
          )}
          title="Sign out"
        >
          <LogOut className="h-4 w-4" />
          {(isMobile || drawerOpen) && <span className="ml-1.5 text-[12.5px]">Sign out</span>}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col overflow-x-clip">
      <header
        className="bg-brand-chrome text-white sticky top-0 z-40 border-b border-slate-800 relative overflow-hidden"
        data-testid="app-header"
      >
        <div className="absolute inset-0 grid-texture opacity-40 pointer-events-none" />
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-teal-500/45 to-transparent" />
        <div className="relative px-3 md:px-5 h-14 flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => setDrawerOpen((open) => !open)}
            className="flex items-center gap-2 sm:gap-2.5 min-w-0 rounded-sm px-1 py-1 -ml-1 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/50 transition-colors"
            data-testid="nav-drawer-toggle"
            aria-label={drawerOpen ? "Collapse navigation menu" : "Expand navigation menu"}
            aria-expanded={drawerOpen}
            title={drawerOpen ? "Collapse menu" : "Expand menu"}
          >
            <img
              src="/maharashtra-police-logo.png"
              alt="Maharashtra Police"
              className="h-8 w-8 rounded-full object-cover shrink-0"
              data-testid="app-logo"
            />
            <div className="leading-tight min-w-0 text-left">
              <div className="font-display font-bold text-[13px] sm:text-[14px] tracking-tight truncate">Police Performance</div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-teal-400">Dashboard</div>
            </div>
          </button>

          <div className="ml-auto flex items-center gap-1.5 sm:gap-2 shrink-0">
            {me && (
              <span
                className="hidden sm:inline-flex items-center gap-2 text-xs border border-teal-500/40 text-teal-300 px-2.5 py-1 rounded-sm bg-teal-500/5"
                data-testid="role-badge"
              >
                {ROLE_LABELS[me.role]}{me.range ? ` · ${me.range}` : ""}
              </span>
            )}
            {me && (
              <span className="hidden lg:inline text-xs text-slate-400 max-w-[160px] truncate" data-testid="user-email" title={me.email}>
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
              <span className="ml-1.5 hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 min-h-0 min-w-0">
        {/* Desktop sidebar */}
        {!isMobile && (
          <motion.aside
            initial={false}
            animate={{ width: drawerOpen ? SIDEBAR_EXPANDED : SIDEBAR_COLLAPSED }}
            transition={{ type: "spring", stiffness: 380, damping: 36 }}
            className="shrink-0 overflow-hidden border-r border-slate-800 sticky top-14 h-[calc(100vh-3.5rem)]"
            data-testid="app-sidebar"
            data-collapsed={!drawerOpen || undefined}
          >
            {sidebarInner}
          </motion.aside>
        )}

        {/* Mobile overlay sidebar */}
        <AnimatePresence>
          {isMobile && drawerOpen && (
            <>
              <motion.div
                key="nav-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 top-14 z-40 bg-slate-950/50 backdrop-blur-[2px]"
                onClick={() => setDrawerOpen(false)}
                data-testid="nav-drawer-backdrop"
              />
              <motion.aside
                key="nav-drawer"
                initial={{ x: -SIDEBAR_EXPANDED }}
                animate={{ x: 0 }}
                exit={{ x: -SIDEBAR_EXPANDED }}
                transition={{ type: "spring", stiffness: 380, damping: 36 }}
                className="fixed left-0 top-14 bottom-0 z-50 w-[min(100vw-3rem,208px)] shadow-2xl border-r border-slate-800"
                data-testid="app-sidebar"
                data-mobile="true"
              >
                {sidebarInner}
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        <div className="flex-1 min-w-0 flex flex-col">
          <div className="h-2 sm:h-3 bg-gradient-to-b from-brand-chrome/10 to-transparent pointer-events-none" />
          <main className="px-3 sm:px-4 md:px-8 pb-8 md:pb-10 max-w-[1600px] w-full mx-auto flex-1 min-w-0">
            {error && <div className="text-rose-700 text-sm" data-testid="me-error">{error}</div>}
            {!me && !error && (
              <div className="flex items-center gap-2 text-slate-500 mt-20 justify-center">
                <Loader2 className="h-5 w-5 animate-spin" /> Loading your access…
              </div>
            )}
            {me && (me.role === "pending" ? <PendingScreen me={me} /> : <Outlet />)}
          </main>
        </div>
      </div>
    </div>
  );
}
