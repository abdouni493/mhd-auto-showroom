import { Link } from "react-router-dom";
import { motion, useScroll, useTransform } from "framer-motion";
import { LogIn } from "lucide-react";
import { useStore } from "../../store/useStore.js";
import AnimatedLogo from "../../components/AnimatedLogo.jsx";

export default function WebsiteNav() {
  const { settings } = useStore();
  const { scrollY } = useScroll();
  const navBg = useTransform(scrollY, [0, 80], ["rgba(0,0,0,0)", "rgba(0,0,0,0.95)"]);
  const navBorder = useTransform(scrollY, [0, 80], ["rgba(220,38,38,0)", "rgba(220,38,38,0.2)"]);

  return (
    <motion.nav
      className="sticky top-0 z-40 border-b"
      style={{ background: navBg, borderBottomColor: navBorder, backdropFilter: "blur(12px)" }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link to="/website" className="flex items-center gap-3">
          <AnimatedLogo src={settings?.logo} size={38} rounded="rounded-lg" />
          <span className="heading text-sm text-text-primary">{settings?.name || "Altech Showroom"}</span>
        </Link>
        <div className="flex items-center gap-4 sm:gap-6 text-xs font-bold uppercase tracking-wider">
          <Link to="/website" className="text-text-muted hover:text-text-primary transition hidden sm:block">Accueil</Link>
          <a href="/website#offers" className="text-text-muted hover:text-text-primary transition hidden sm:block">Véhicules</a>
          <a href="/website#special" className="text-text-muted hover:text-text-primary transition hidden sm:block">Offres</a>
          <Link to="/website/contacts" className="text-text-muted hover:text-text-primary transition hidden sm:block">Contacts</Link>
          <Link to="/login" className="btn-primary text-xs py-1.5"><LogIn size={14} /> Connexion</Link>
        </div>
      </div>
    </motion.nav>
  );
}
