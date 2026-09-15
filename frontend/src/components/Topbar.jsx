import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, Sun, Moon, Languages, HandCoins, Globe } from "lucide-react";
import { useStore } from "../store/useStore.js";
import { useCan } from "../lib/permissions.js";

/**
 * Application top bar: mobile menu, showroom name, owner-settlement alert,
 * language switch and the light / dark mode switch.
 */
export default function Topbar({ onMenu }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const can = useCan();
  const { settings, language, setLanguage, theme, toggleTheme, pendingSettlements } = useStore();

  const toggleLang = () => {
    const next = language === "fr" ? "ar" : "fr";
    setLanguage(next);
    i18n.changeLanguage(next);
  };

  const showAlert = pendingSettlements > 0 && can("clients", "view");

  return (
    <header className="app-topbar sticky top-0 z-30 flex items-center gap-3 px-4 sm:px-6 py-3 border-b border-red-600/20 bg-black/60 backdrop-blur-md">
      <button onClick={onMenu} className="lg:hidden text-text-primary shrink-0" aria-label="Menu">
        <Menu size={22} />
      </button>

      <span className="heading text-sm text-text-primary truncate">
        {settings?.name || "Showroom"}
      </span>

      <div className="flex-1" />

      {/* Owner settlements waiting to be created */}
      <AnimatePresence>
        {showAlert && (
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => navigate("/app/clients?settle=1")}
            title={t("settlements.alertTitle")}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-amber-500/50 bg-amber-500/12 text-amber-400 text-xs font-bold uppercase tracking-wider"
          >
            <motion.span
              animate={{ rotate: [0, -12, 12, 0] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            >
              <HandCoins size={16} />
            </motion.span>
            <span className="hidden sm:inline">{t("settlements.alertShort")}</span>
            <span className="min-w-[1.2rem] h-5 px-1.5 rounded-full bg-amber-500 text-black flex items-center justify-center">
              {pendingSettlements}
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Open the public showroom website in a new browser tab */}
      <motion.a
        href="/website"
        target="_blank"
        rel="noopener noreferrer"
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
        title={t("nav.viewWebsite")}
        aria-label={t("nav.viewWebsite")}
        className="w-9 h-9 rounded-xl border border-red-600/30 flex items-center justify-center text-text-muted hover:text-text-primary hover:border-red-600 transition-colors"
      >
        <Globe size={17} />
      </motion.a>

      <motion.button
        onClick={toggleLang}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
        title={t("nav.language")}
        className="w-9 h-9 rounded-xl border border-red-600/30 flex items-center justify-center text-text-muted hover:text-text-primary hover:border-red-600 transition-colors"
      >
        <Languages size={17} />
      </motion.button>

      <motion.button
        onClick={toggleTheme}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
        title={theme === "dark" ? t("nav.lightMode") : t("nav.darkMode")}
        className="w-9 h-9 rounded-xl border border-red-600/30 flex items-center justify-center text-red-400 hover:text-text-primary hover:border-red-600 transition-colors overflow-hidden"
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={theme}
            initial={{ y: 14, opacity: 0, rotate: -40 }}
            animate={{ y: 0, opacity: 1, rotate: 0 }}
            exit={{ y: -14, opacity: 0, rotate: 40 }}
            transition={{ duration: 0.2 }}
            className="flex"
          >
            {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
          </motion.span>
        </AnimatePresence>
      </motion.button>
    </header>
  );
}
