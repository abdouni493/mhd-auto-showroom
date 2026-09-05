import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, animate, useReducedMotion } from "framer-motion";
import { create } from "zustand";
import { useTranslation } from "react-i18next";
import { X, AlertTriangle, Inbox, Check, CheckCircle2, XCircle, Info } from "lucide-react";

// Hex map for inline glow / accents that Tailwind classes can't express dynamically
export const COLOR_HEX = {
  success: "#10b981",
  accent: "#dc2626",
  warning: "#f59e0b",
  info: "#3b82f6",
  supplier: "#7c3aed",
  debt: "#fb7185",
  muted: "#f87171",
};

const spring = { type: "spring", stiffness: 320, damping: 28 };

// ---------- Badge ----------
const BADGE_STYLES = {
  success: { classes: "bg-emerald-500/12 text-emerald-400 border-emerald-500/30", glow: "0 0 10px rgba(16,185,129,0.2)" },
  accent: { classes: "bg-red-600/15 text-red-400 border-red-600/30", glow: "0 0 10px rgba(220,38,38,0.2)" },
  warning: { classes: "bg-amber-500/12 text-amber-400 border-amber-500/30", glow: "0 0 10px rgba(245,158,11,0.15)" },
  info: { classes: "bg-blue-500/15 text-blue-400 border-blue-500/30", glow: null },
  supplier: { classes: "bg-violet-600/12 text-violet-400 border-violet-600/30", glow: "0 0 10px rgba(124,58,237,0.2)" },
  debt: { classes: "bg-rose-400/12 text-rose-300 border-rose-400/30", glow: "0 0 10px rgba(251,113,133,0.2)" },
  muted: { classes: "bg-white/5 text-text-muted border-white/10", glow: null },
};

export function Badge({ children, color = "muted", className = "" }) {
  const s = BADGE_STYLES[color] || BADGE_STYLES.muted;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[0.62rem] font-bold uppercase tracking-wider ${s.classes} ${className}`}
      style={s.glow ? { boxShadow: s.glow } : undefined}
    >
      {children}
    </span>
  );
}

// ---------- Card ----------
export function Card({ children, className = "", large = false, ...props }) {
  return (
    <div className={`${large ? "glass-panel" : "glass-card"} ${className}`} {...props}>
      {children}
    </div>
  );
}

// ---------- Modal ----------
export function Modal({ open, onClose, title, children, footer, size = "md" }) {
  const [scrollPct, setScrollPct] = useState(0);
  const sizes = { sm: "max-w-md", md: "max-w-2xl", lg: "max-w-4xl", xl: "max-w-6xl", full: "max-w-[95vw]" };

  const onScroll = (e) => {
    const el = e.target;
    const max = el.scrollHeight - el.clientHeight;
    setScrollPct(max > 0 ? el.scrollTop / max : 0);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/80 backdrop-blur-sm p-4 no-print"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
        >
          <motion.div
            className={`glass-panel w-full ${sizes[size]} my-8 relative`}
            initial={{ opacity: 0, scale: 0.94, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={spring}
            onClick={(e) => e.stopPropagation()}
          >
            {/* scroll progress bar */}
            <motion.div
              className="absolute top-0 left-0 right-0 h-0.5 origin-left rounded-t-panel z-10"
              style={{ scaleX: scrollPct, background: "linear-gradient(90deg,#dc2626,#ef4444)" }}
            />
            <div className="flex items-center justify-between p-5 border-b border-red-600/20">
              <h3 className="heading text-lg text-text-primary">{title}</h3>
              <button onClick={onClose} className="text-text-muted hover:text-text-primary transition">
                <X size={22} />
              </button>
            </div>
            <div className="p-5 max-h-[70vh] overflow-y-auto" onScroll={onScroll}>{children}</div>
            {footer && <div className="flex justify-end gap-3 p-5 border-t border-red-600/20">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ---------- Confirm Delete ----------
export function ConfirmModal({ open, onClose, onConfirm, title, message, loading }) {
  const { t } = useTranslation();
  title = title || t("common.confirmDelete");
  message = message || t("common.confirmDeleteMsg");
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 no-print"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
          onClick={onClose}
        >
          <motion.div
            className="glass-panel w-full max-w-md"
            initial={{ opacity: 0, scale: 0.97, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={spring}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-red-600/20">
              <h3 className="heading text-lg text-text-primary">{title}</h3>
              <button onClick={onClose} className="text-text-muted hover:text-text-primary transition"><X size={22} /></button>
            </div>
            <div className="p-5">
              <div className="flex items-start gap-3 text-text-primary">
                <AlertTriangle className="text-amber-400 shrink-0" size={28} />
                <p className="text-sm text-text-muted leading-relaxed">{message}</p>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-red-600/20">
              <button className="btn-ghost" onClick={onClose}>{t("common.cancel")}</button>
              <button className="btn-danger" onClick={onConfirm} disabled={loading}>{loading ? "..." : t("common.delete")}</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ---------- Stepper ----------
// `onStepClick` (optional) makes the circles clickable — used by the edit forms
// so any section can be reached directly instead of stepping through the wizard.
export function Stepper({ steps, current, onStepClick }) {
  const clickable = typeof onStepClick === "function";
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={i} className="flex items-center">
            <div className="flex flex-col items-center gap-2">
              <motion.div
                role={clickable ? "button" : undefined}
                tabIndex={clickable ? 0 : undefined}
                onClick={clickable ? () => onStepClick(i) : undefined}
                onKeyDown={clickable ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onStepClick(i); } } : undefined}
                whileHover={clickable ? { scale: 1.1 } : undefined}
                animate={
                  active
                    ? { scale: [1, 1.25, 1], boxShadow: ["0 0 0px rgba(220,38,38,0)", "0 0 30px rgba(220,38,38,0.6)", "0 0 20px rgba(220,38,38,0.4)"] }
                    : done
                    ? { scale: [1, 0.85, 1] }
                    : { scale: 1 }
                }
                transition={{ duration: 0.5 }}
                className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm border-2 ${clickable ? "cursor-pointer" : ""} ${
                  done
                    ? "bg-emerald-500 border-emerald-500 text-white"
                    : active
                    ? "bg-gradient-to-br from-red-600 to-red-900 border-red-500 text-white"
                    : "bg-glass border-red-600/30 text-text-muted"
                }`}
              >
                {done ? <Check size={18} /> : i + 1}
              </motion.div>
              <span
                onClick={clickable ? () => onStepClick(i) : undefined}
                className={`text-[0.6rem] font-bold uppercase tracking-wider ${clickable ? "cursor-pointer" : ""} ${active ? "text-text-primary" : "text-text-muted"}`}
              >{label}</span>
            </div>
            {i < steps.length - 1 && (
              <div className="w-12 sm:w-20 h-0.5 mx-2 -mt-5 bg-red-600/20 overflow-hidden">
                <motion.div className="h-full bg-emerald-500 origin-left" initial={{ scaleX: 0 }} animate={{ scaleX: done ? 1 : 0 }} transition={spring} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------- StatCard (with counting numbers) ----------
const STAT_TEXT = {
  success: "text-emerald-400", accent: "text-red-400", warning: "text-amber-400",
  info: "text-blue-400", supplier: "text-violet-400", debt: "text-rose-300",
};

function useCountUp(value) {
  const reduce = useReducedMotion();
  const raw = String(value ?? "");
  const numeric = parseInt(raw.replace(/[^\d-]/g, ""), 10);
  const isNum = !raw.includes("e") && !isNaN(numeric) && /\d/.test(raw);
  const suffix = raw.includes("DA") ? " DA" : raw.includes("km") ? " km" : "";
  const [display, setDisplay] = useState(isNum ? "0" + suffix : raw);

  useEffect(() => {
    if (!isNum) { setDisplay(raw); return; }
    if (reduce) { setDisplay(fmtInt(numeric) + suffix); return; }
    const controls = animate(0, numeric, {
      duration: 1.2,
      ease: "easeOut",
      onUpdate: (v) => setDisplay(fmtInt(Math.round(v)) + suffix),
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raw]);

  return isNum ? display : raw;
}
const fmtInt = (n) => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");

export function StatCard({ label, value, icon: Icon, color = "info", large = false, index = 0 }) {
  const hex = COLOR_HEX[color] || COLOR_HEX.info;
  const display = useCountUp(value);
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 25, delay: index * 0.05 }}
      whileHover={{ scale: 1.02, borderColor: hex }}
      className={`glass-card p-5 relative ${large ? "lg:col-span-2" : ""}`}
      style={{ borderLeft: `3px solid ${hex}` }}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="label-caps">{label}</p>
          <p className={`font-black ${large ? "text-3xl" : "text-2xl"} ${STAT_TEXT[color]} mt-1`}>{display}</p>
        </div>
        <div className="relative">
          <div className="absolute inset-0 rounded-2xl" style={{ background: `radial-gradient(circle, ${hex}26 0%, transparent 70%)` }} />
          <div className={`relative p-3 rounded-2xl bg-white/5 ${STAT_TEXT[color]}`}>
            <Icon size={large ? 28 : 22} />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ---------- Empty state ----------
export function EmptyState({ icon: Icon = Inbox, message = "Aucune donnée", cta, onCta }) {
  return (
    <motion.div
      className="flex flex-col items-center justify-center py-16 text-center"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={spring}
    >
      <div className="relative mb-4">
        <motion.div
          className="absolute inset-0 rounded-full"
          animate={{ boxShadow: ["0 0 0 0 rgba(220,38,38,0.2)", "0 0 0 16px rgba(220,38,38,0)"] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
        />
        <motion.div
          className="relative p-5 rounded-full bg-red-600/10"
          animate={{ scale: [1, 1.08, 1] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
        >
          <motion.div animate={{ rotate: [0, 5, -5, 0] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}>
            <Icon size={40} className="text-red-500" />
          </motion.div>
        </motion.div>
      </div>
      <p className="text-text-muted mb-4">{message}</p>
      {cta && (
        <motion.button className="btn-primary" onClick={onCta} animate={{ scale: [1, 1.03, 1] }} transition={{ duration: 2.5, repeat: Infinity }}>
          {cta}
        </motion.button>
      )}
    </motion.div>
  );
}

// ---------- Skeleton ----------
export function SkeletonCard({ className = "", height = "h-40" }) {
  return (
    <motion.div
      className={`rounded-card ${height} relative overflow-hidden ${className}`}
      style={{ background: "rgba(220,38,38,0.04)", border: "1px solid rgba(220,38,38,0.12)" }}
      initial={{ opacity: 0.6 }}
      animate={{ opacity: [0.6, 0.9, 0.6] }}
      transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
    >
      <motion.div
        className="absolute inset-0"
        style={{ background: "linear-gradient(90deg,transparent,rgba(220,38,38,0.12),transparent)" }}
        animate={{ x: ["-100%", "200%"] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: "linear" }}
      />
    </motion.div>
  );
}

export function SkeletonGrid({ count = 6 }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {Array.from({ length: count }).map((_, i) => <SkeletonCard key={i} />)}
    </div>
  );
}

// ---------- AnimatedGrid (reusable staggered grid) ----------
const gridContainer = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const gridItem = {
  hidden: { opacity: 0, y: 24, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 280, damping: 24 } },
};
export function AnimatedGrid({ children, className = "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5", delay = 0 }) {
  return (
    <motion.div
      className={className}
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06, delayChildren: delay } } }}
      initial="hidden"
      animate="show"
    >
      {React.Children.map(children, (child) => child && <motion.div variants={gridItem}>{child}</motion.div>)}
    </motion.div>
  );
}

// ---------- Field (with focus label color) ----------
export function Field({ label, error, children, required, className = "" }) {
  const [focused, setFocused] = useState(false);
  return (
    <div className={className} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}>
      {label && (
        <motion.label
          className="label-caps"
          animate={{ color: focused ? "#dc2626" : "rgba(248,113,113,0.7)" }}
          transition={{ duration: 0.2 }}
        >
          {label} {required && <span className="text-red-500">*</span>}
        </motion.label>
      )}
      {children}
      {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
    </div>
  );
}

// ---------- Toggle (animated thumb) ----------
export function Toggle({ checked, onChange, label }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex items-center gap-2.5">
      <motion.span
        className="relative w-11 h-6 rounded-full"
        animate={{ backgroundColor: checked ? "rgba(220,38,38,0.9)" : "rgba(220,38,38,0.15)" }}
        transition={{ duration: 0.2 }}
      >
        <motion.span
          className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow"
          animate={{ x: checked ? 20 : 0 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        />
      </motion.span>
      {label && <span className="text-sm text-text-primary">{label}</span>}
    </button>
  );
}

// ---------- Toast system ----------
let toastId = 0;
const useToastStore = create((set) => ({
  toasts: [],
  show: (message, type = "success") => {
    const id = ++toastId;
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 3500);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export function useToast() {
  return useToastStore((s) => s.show);
}

const TOAST_STYLE = {
  success: { border: "border-emerald-500/40", icon: CheckCircle2, color: "text-emerald-400" },
  error: { border: "border-red-600/40", icon: XCircle, color: "text-red-400" },
  info: { border: "border-blue-500/40", icon: Info, color: "text-blue-400" },
};

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);
  return (
    <div className="fixed bottom-5 right-5 rtl:right-auto rtl:left-5 z-[60] flex flex-col gap-2 no-print">
      <AnimatePresence>
        {toasts.map((t) => {
          const s = TOAST_STYLE[t.type] || TOAST_STYLE.info;
          const Icon = s.icon;
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, x: 60, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 60, scale: 0.9 }}
              transition={spring}
              onClick={() => dismiss(t.id)}
              className={`glass-panel border ${s.border} px-4 py-3 flex items-center gap-3 cursor-pointer min-w-[260px] max-w-sm`}
            >
              <Icon size={20} className={s.color} />
              <span className="text-sm text-text-primary flex-1">{t.message}</span>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
