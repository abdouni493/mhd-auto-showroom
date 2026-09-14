import { useState } from "react";
import { useLocation, useOutlet } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ShieldAlert } from "lucide-react";
import Sidebar from "./Sidebar.jsx";
import Topbar from "./Topbar.jsx";
import { ToastContainer } from "./ui.jsx";
import { PrintChooser } from "./PrintChooser.jsx";
import { useStore } from "../store/useStore.js";
import { can, ROUTE_SECTION } from "../lib/permissions.js";

function AccessDenied() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <ShieldAlert size={48} className="text-red-500 mb-4" />
      <h2 className="heading text-xl text-text-primary mb-1">Accès refusé</h2>
      <p className="text-text-muted text-sm">Vous n'avez pas la permission de voir cette page.</p>
    </div>
  );
}

function AnimatedOutlet() {
  const location = useLocation();
  const outlet = useOutlet();
  const user = useStore((s) => s.user);
  // Gate by the current route's permission section (workers can't URL-hop into
  // pages they aren't allowed to view).
  const seg = location.pathname.split("/")[2] || "dashboard";
  const section = ROUTE_SECTION[seg] || seg;
  const allowed = can(user, section, "view");
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, x: 18 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -18 }}
        transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
      >
        {allowed ? outlet : <AccessDenied />}
      </motion.div>
    </AnimatePresence>
  );
}

export default function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-black">
      {/* Desktop sidebar */}
      <div className="hidden lg:block shrink-0">
        <Sidebar />
      </div>

      {/* Mobile sidebar drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <motion.div
              className="absolute inset-0 bg-black/70"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              className="absolute inset-y-0 left-0 rtl:left-auto rtl:right-0"
              initial={{ x: -260 }}
              animate={{ x: 0 }}
              exit={{ x: -260 }}
              transition={{ type: "spring", stiffness: 350, damping: 35 }}
            >
              <Sidebar onNavigate={() => setMobileOpen(false)} />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar onMenu={() => setMobileOpen(true)} />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <AnimatedOutlet />
        </main>
      </div>

      <ToastContainer />
      <PrintChooser />
    </div>
  );
}
