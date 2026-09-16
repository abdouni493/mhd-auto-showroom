import { NavLink, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import { useStore } from "../store/useStore.js";
import { can } from "../lib/permissions.js";
import AnimatedLogo from "./AnimatedLogo.jsx";
import { initials } from "../utils/format.js";
import {
  Gauge, CarFront, ShoppingBag, Calculator, Tag, Banknote, Vault,
  MonitorSmartphone, CalendarClock, Contact, Briefcase, CircleDollarSign,
  PieChart, SlidersHorizontal, LogOut, Languages, X, Handshake,
} from "lucide-react";

// The navigation is grouped by activity instead of being one long flat list.
// A group disappears entirely when the user may not see any of its entries.
const NAV_GROUPS = [
  {
    key: "pilotage",
    items: [
      { to: "/app/dashboard", key: "dashboard", icon: Gauge },
      { to: "/app/reports", key: "reports", icon: PieChart },
    ],
  },
  {
    key: "stock",
    items: [
      { to: "/app/showroom", key: "showroom", icon: CarFront },
      { to: "/app/purchase", key: "purchase", icon: ShoppingBag },
      { to: "/app/suppliers", key: "suppliers", icon: Handshake, badge: "settlements" },
    ],
  },
  {
    key: "commerce",
    items: [
      { to: "/app/pos", key: "pos", icon: Calculator },
      { to: "/app/sales", key: "sales", icon: Tag },
      { to: "/app/clients", key: "clients", icon: Contact },
      { to: "/app/payments", key: "payments", icon: Banknote },
    ],
  },
  {
    key: "finance",
    items: [
      { to: "/app/caisse", key: "caisse", icon: Vault },
      { to: "/app/expenses", key: "expenses", icon: CircleDollarSign },
      { to: "/app/workers", key: "workers", icon: Briefcase },
    ],
  },
  {
    key: "web",
    items: [
      { to: "/app/website-settings", key: "websiteSettings", icon: MonitorSmartphone },
      { to: "/app/website-reservations", key: "websiteReservations", icon: CalendarClock },
    ],
  },
  {
    key: "system",
    items: [{ to: "/app/settings", key: "settings", icon: SlidersHorizontal }],
  },
];

const navContainer = { hidden: {}, show: { transition: { staggerChildren: 0.03, delayChildren: 0.08 } } };
const navItem = { hidden: { opacity: 0, x: -20 }, show: { opacity: 1, x: 0 } };

function NavEntry({ to, label, icon: Icon, badge, onNavigate }) {
  return (
    <motion.div variants={navItem} whileHover={{ x: 3 }} whileTap={{ scale: 0.97 }}>
      <NavLink to={to} onClick={onNavigate}>
        {({ isActive }) => (
          <div className="relative flex items-center gap-3 px-3 py-2.5 rounded-xl">
            {isActive && (
              <motion.div
                layoutId="sidebar-active"
                className="absolute inset-0"
                style={{
                  background: "linear-gradient(90deg,#dc2626,#7f1d1d)",
                  borderLeft: "4px solid #ef4444",
                  borderRadius: "0 1rem 1rem 0",
                }}
                transition={{ type: "spring", stiffness: 350, damping: 30 }}
              />
            )}
            <motion.div whileHover={{ scale: 1.2 }} className="relative z-10 shrink-0">
              <Icon size={18} className={isActive ? "text-white" : "text-text-muted"} />
            </motion.div>
            <span
              className={`relative z-10 flex-1 truncate text-[0.78rem] uppercase tracking-wide ${
                isActive ? "text-white font-black" : "text-text-muted font-bold"
              }`}
            >
              {label}
            </span>
            {badge > 0 && (
              <motion.span
                className="relative z-10 shrink-0 min-w-[1.25rem] h-5 px-1.5 rounded-full bg-amber-500 text-black text-[0.62rem] font-black flex items-center justify-center"
                animate={{ scale: [1, 1.12, 1] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
              >
                {badge}
              </motion.span>
            )}
          </div>
        )}
      </NavLink>
    </motion.div>
  );
}

export default function Sidebar({ onNavigate }) {
  const { t, i18n } = useTranslation();
  const { user, settings, language, setLanguage, logout, pendingSettlements } = useStore();
  const navigate = useNavigate();

  const toggleLang = () => {
    const next = language === "fr" ? "ar" : "fr";
    setLanguage(next);
    i18n.changeLanguage(next);
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const groups = NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter(({ key }) => can(user, key, "view")),
  })).filter((g) => g.items.length > 0);

  return (
    <aside className="sidebar w-[260px] h-full bg-black border-r border-red-600/20 flex flex-col">
      {/* Header */}
      <div className="p-5 border-b border-red-600/20 flex items-center gap-3">
        <motion.div whileHover={{ scale: 1.1 }} transition={{ type: "spring", stiffness: 400, damping: 20 }}>
          <AnimatedLogo src={settings?.logo} size={44} rounded="rounded-xl" />
        </motion.div>
        <div className="min-w-0 flex-1">
          <p className="heading text-sm text-text-primary truncate">{settings?.name || "Showroom"}</p>
          <p className="text-[0.6rem] text-text-muted uppercase tracking-wider">{t("nav.management")}</p>
        </div>
        {onNavigate && (
          <button className="lg:hidden text-text-muted" onClick={onNavigate}>
            <X size={20} />
          </button>
        )}
      </div>

      {/* Nav */}
      <motion.nav
        className="flex-1 overflow-y-auto py-3 px-2"
        variants={navContainer}
        initial="hidden"
        animate="show"
      >
        {groups.map((group, gi) => (
          <div key={group.key} className={gi > 0 ? "mt-4" : ""}>
            <motion.p
              variants={navItem}
              className="px-3 mb-1.5 text-[0.55rem] font-black uppercase tracking-[0.18em] text-text-muted/70"
            >
              {t(`navGroup.${group.key}`)}
            </motion.p>
            <div className="space-y-0.5">
              {group.items.map(({ to, key, icon, badge }) => (
                <NavEntry
                  key={to}
                  to={to}
                  label={t(`nav.${key}`)}
                  icon={icon}
                  badge={badge === "settlements" ? pendingSettlements : 0}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          </div>
        ))}
      </motion.nav>

      {/* Footer */}
      <div className="border-t border-red-600/20 p-3 space-y-2">
        <motion.button
          onClick={handleLogout}
          whileHover={{ x: 3 }}
          whileTap={{ scale: 0.97 }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold uppercase tracking-wide text-text-muted hover:bg-red-600/8 hover:text-text-primary transition-colors"
        >
          <LogOut size={18} />
          <span className="text-[0.78rem]">{t("nav.logout")}</span>
        </motion.button>

        <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-red-600/8">
          <motion.div
            className="w-9 h-9 rounded-full bg-gradient-to-br from-red-600 to-red-900 flex items-center justify-center text-white font-black text-xs"
            animate={{ boxShadow: ["0 0 0px rgba(220,38,38,0)", "0 0 20px rgba(220,38,38,0.3)", "0 0 0px rgba(220,38,38,0)"] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          >
            {initials(user?.fullName || "U")}
          </motion.div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-text-primary truncate">{user?.fullName}</p>
            <p className="text-[0.6rem] text-text-muted uppercase">{user?.role}</p>
          </div>
        </div>

        <motion.button
          onClick={toggleLang}
          whileHover={{ scale: 1.03, borderColor: "#dc2626" }}
          whileTap={{ scale: 0.95 }}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-red-600/30 text-text-muted hover:text-text-primary transition-colors text-xs font-bold uppercase tracking-wider overflow-hidden"
        >
          <Languages size={16} />
          <AnimatePresence mode="wait">
            <motion.span
              key={language}
              initial={{ y: 12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -12, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {language === "fr" ? "العربية" : "Français"}
            </motion.span>
          </AnimatePresence>
        </motion.button>
      </div>
    </aside>
  );
}
