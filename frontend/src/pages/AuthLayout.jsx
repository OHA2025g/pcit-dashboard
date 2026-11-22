import { motion } from "framer-motion";
import { Scale, Timer, Lock } from "lucide-react";
import { softScale, staggerContainer, fadeUp } from "@/lib/motion";

export default function AuthLayout({ children }) {
  return (
    <div className="min-h-screen flex bg-background">
      <aside className="hidden lg:flex relative w-[46%] bg-brand-chrome text-white overflow-hidden" data-testid="auth-side-panel">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0B1220] via-[#0E1A2B] to-[#0F3D5E]" />
        <div className="absolute inset-0 grid-texture grid-texture-animated opacity-70" />
        <div className="absolute -top-24 -right-24 h-80 w-80 rounded-full bg-teal-500/10 blur-3xl" />
        <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-brand-chrome to-transparent" />
        <div className="relative z-10 flex flex-col justify-between p-14 w-full">
          <div className="flex items-center gap-3">
            <img
              src="/maharashtra-police-logo.png"
              alt="Maharashtra Police"
              className="h-10 w-10 rounded-full object-cover shrink-0"
              data-testid="auth-logo"
            />
            <div className="text-xs uppercase tracking-[0.25em] text-teal-400 font-semibold">Performance Directorate</div>
          </div>
          <motion.div variants={staggerContainer} initial="hidden" animate="show" className="space-y-6">
            <motion.h1 variants={fadeUp} className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.05] tracking-tight">
              Police Unit<br />Performance<br /><span className="text-teal-400">Dashboard</span>
            </motion.h1>
            <motion.p variants={fadeUp} className="max-w-md text-slate-300 text-base leading-relaxed">
              One consistent, explainable view of conviction performance and charge-sheet timeliness across every unit and range.
            </motion.p>
            <motion.div variants={staggerContainer} className="grid grid-cols-2 gap-4 max-w-md">
              <motion.div variants={softScale} className="border border-white/10 bg-white/5 backdrop-blur-md p-4 rounded-sm hover:border-teal-400/35 transition-colors">
                <Scale className="h-5 w-5 text-teal-400" />
                <div className="mt-3 text-sm font-semibold">Conviction</div>
                <div className="text-xs text-slate-400">JMFC · Session</div>
              </motion.div>
              <motion.div variants={softScale} className="border border-white/10 bg-white/5 backdrop-blur-md p-4 rounded-sm hover:border-teal-400/35 transition-colors">
                <Timer className="h-5 w-5 text-teal-400" />
                <div className="mt-3 text-sm font-semibold">Timeliness</div>
                <div className="text-xs text-slate-400">60 Day · 90 Day</div>
              </motion.div>
            </motion.div>
          </motion.div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Lock className="h-3.5 w-3.5" /> Authorised personnel only. All access is logged.
          </div>
        </div>
      </aside>
      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 md:p-8 min-w-0" data-testid="auth-form-area">
        <div className="lg:hidden flex items-center gap-2.5 mb-6 w-full max-w-sm" data-testid="auth-mobile-brand">
          <img src="/maharashtra-police-logo.png" alt="Maharashtra Police" className="h-9 w-9 rounded-full object-cover shrink-0" />
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-teal-700 font-semibold">Performance Directorate</div>
            <div className="font-display text-sm font-semibold text-slate-900 leading-tight">Police Unit Performance Dashboard</div>
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}
