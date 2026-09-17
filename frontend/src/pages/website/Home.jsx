import { useState, useEffect, useRef } from "react";
import {
  AnimatePresence, motion, useScroll, useMotionValueEvent, useMotionValue,
  useSpring, useTransform, useReducedMotion,
} from "framer-motion";
import { Fuel, Cog, Gauge, ArrowRight, Tag, ChevronDown } from "lucide-react";
import { websiteApi } from "../../lib/api.js";
import { useStore } from "../../store/useStore.js";
import { CarImage } from "../../components/CarCard.jsx";
import AnimatedLogo from "../../components/AnimatedLogo.jsx";
import { Badge, Modal, Field } from "../../components/ui.jsx";
import { formatAmount, countdown, ENERGY_LABELS, GEARBOX_LABELS } from "../../utils/format.js";
import WebsiteNav from "./WebsiteNav.jsx";

// Live CSS media-query match — lets us keep the heavy effects (blur, 3D tilt)
// for pointer devices and give phones a lighter, smoother animation.
function useMediaQuery(query) {
  const [matches, setMatches] = useState(
    () => typeof window !== "undefined" && window.matchMedia(query).matches
  );
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

function GlowBg() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-red-600/25 blur-[120px] animate-float1" />
      <div className="absolute top-1/4 -right-40 w-[450px] h-[450px] rounded-full bg-red-900/20 blur-[120px] animate-float2" />
      <div className="absolute inset-0" style={{ backgroundImage: "linear-gradient(rgba(220,38,38,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(220,38,38,0.04) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
    </div>
  );
}

function ReservationModal({ car, onClose }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [done, setDone] = useState(false);
  const submit = async () => {
    if (!name || !phone) return;
    await websiteApi.createReservation({ carId: car.id, clientName: name, clientPhone: phone });
    setDone(true);
  };
  return (
    <Modal open onClose={onClose} title={done ? "Demande envoyée ✓" : "Réserver ce véhicule"} size="sm"
      footer={done ? <button className="btn-primary" onClick={onClose}>Fermer</button> :
        <><button className="btn-ghost" onClick={onClose}>Annuler</button><button className="btn-primary" onClick={submit} disabled={!name || !phone}>Envoyer la demande</button></>}>
      {done ? (
        <p className="text-text-muted">Merci ! Nous vous contacterons bientôt au sujet de la {car.brand} {car.model}.</p>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-text-muted">Véhicule : <span className="text-text-primary font-bold">{car.brand} {car.model}</span></p>
          <Field label="Nom complet" required><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Téléphone" required><input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
        </div>
      )}
    </Modal>
  );
}

// Scroll-linked reveal: instead of firing a one-shot fade when a card crosses
// the viewport, every transform is *driven by* the scroll position, so cards
// lift, un-blur and straighten progressively as the visitor scrolls — and fold
// back gently when scrolling up. Odd/even cards swing in from opposite sides,
// which makes the grid cascade diagonally.
//
// The motion finishes well before the scroll range ends (at 0.62 of progress)
// so the last row is fully revealed even when the page cannot scroll further.
function ScrollReveal({ children, index = 0, className = "" }) {
  const ref = useRef(null);
  const reduce = useReducedMotion();
  const rich = useMediaQuery("(min-width: 640px) and (hover: hover)");
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.92", "start 0.42"] });
  const p = useSpring(scrollYProgress, { stiffness: 150, damping: 28, mass: 0.35 });

  const side = index % 2 === 0 ? -1 : 1;
  const opacity = useTransform(p, [0, 0.45], [0, 1]);
  const y = useTransform(p, [0, 0.62], [70, 0]);
  const x = useTransform(p, [0, 0.62], [26 * side, 0]);
  const scale = useTransform(p, [0, 0.62], [0.9, 1]);
  const rotateX = useTransform(p, [0, 0.62], [16, 0]);
  const rotateY = useTransform(p, [0, 0.62], [-9 * side, 0]);
  const blurPx = useTransform(p, [0, 0.5], [8, 0]);
  // "none" once settled so a finished card stops costing a filter layer.
  const filter = useTransform(blurPx, (v) => (v < 0.05 ? "none" : `blur(${v}px)`));

  if (reduce) return <div ref={ref} className={className}>{children}</div>;

  return (
    <motion.div
      ref={ref}
      className={className}
      style={rich
        ? { opacity, y, x, scale, rotateX, rotateY, filter, transformPerspective: 1000 }
        : { opacity, y, x, scale }}
    >
      {children}
    </motion.div>
  );
}

// Section heading that slides in and draws its own underline.
function SectionTitle({ icon: Icon, children }) {
  return (
    <motion.div
      className="mb-5 sm:mb-6"
      initial={{ opacity: 0, x: -24 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, amount: 0.6 }}
      transition={{ type: "spring", stiffness: 260, damping: 26 }}
    >
      <div className="flex items-center gap-2.5">
        {Icon && <Icon className="text-red-500" size={22} />}
        <h2 className="heading text-xl sm:text-2xl text-text-primary">{children}</h2>
      </div>
      <motion.div
        className="mt-2 h-[2px] w-24 origin-left rounded-full bg-gradient-to-r from-red-600 via-red-400 to-transparent"
        initial={{ scaleX: 0 }}
        whileInView={{ scaleX: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7, ease: "easeOut", delay: 0.1 }}
      />
    </motion.div>
  );
}

// Compact card — two per row on phones (so four vehicles fit on one screen),
// then progressively roomier from `sm` upwards.
function OfferCard({ car, price, oldPrice, onReserve, onOpen }) {
  const tiltable = useMediaQuery("(hover: hover) and (min-width: 1024px)");
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rx = useSpring(useTransform(my, [-0.5, 0.5], [9, -9]), { stiffness: 200, damping: 18 });
  const ry = useSpring(useTransform(mx, [-0.5, 0.5], [-9, 9]), { stiffness: 200, damping: 18 });
  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width - 0.5);
    my.set((e.clientY - r.top) / r.height - 0.5);
  };
  const reset = () => { mx.set(0); my.set(0); };

  const open = () => onOpen({ car, price, oldPrice });
  const discount = oldPrice != null && oldPrice > price
    ? Math.round(((oldPrice - price) / oldPrice) * 100)
    : null;
  const meta = [car.year, car.mileage != null ? formatAmount(car.mileage, "km") : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <motion.article
      className="glass-card !rounded-2xl sm:!rounded-3xl overflow-hidden flex flex-col flex-1 cursor-pointer group"
      onClick={open}
      style={tiltable ? { rotateX: rx, rotateY: ry, transformPerspective: 900, transformStyle: "preserve-3d" } : undefined}
      onMouseMove={tiltable ? onMove : undefined}
      onMouseLeave={tiltable ? reset : undefined}
      whileHover={{ scale: 1.02, boxShadow: "0 30px 70px rgba(220,38,38,0.28), 0 0 0 1px rgba(220,38,38,0.45)" }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 350, damping: 24 }}
    >
      <div className="relative" style={tiltable ? { transform: "translateZ(35px)" } : undefined}>
        <CarImage images={car.images} heightClass="h-24 sm:h-44 lg:h-48" fit="cover" />
        {discount != null && (
          <span className="absolute top-1 left-1 sm:top-2 sm:left-2 z-10 rounded-full bg-red-600 px-1.5 py-px sm:py-0.5 text-[9px] sm:text-[11px] font-black text-white shadow-lg">
            -{discount}%
          </span>
        )}
        {/* Phones: specs ride on the photo so they cost no card height. */}
        <div className="absolute bottom-1 left-1 right-1 flex gap-1 sm:hidden pointer-events-none">
          {car.energy && (
            <span className="min-w-0 truncate rounded-full bg-black/70 px-1.5 py-px text-[8px] font-bold uppercase tracking-wide text-red-100/90">
              {ENERGY_LABELS[car.energy]}
            </span>
          )}
          {car.gearbox && (
            <span className="min-w-0 truncate rounded-full bg-black/70 px-1.5 py-px text-[8px] font-bold uppercase tracking-wide text-red-100/90">
              {GEARBOX_LABELS[car.gearbox]}
            </span>
          )}
        </div>
      </div>

      <div className="p-2 sm:p-4 flex-1 flex flex-col" style={tiltable ? { transform: "translateZ(20px)" } : undefined}>
        <h3 className="heading text-[11px] sm:text-base text-text-primary truncate leading-tight">
          {car.brand} {car.model}
        </h3>
        <p className="text-[9px] sm:text-xs text-text-muted mt-0.5 truncate leading-tight">
          <span className="sm:hidden">{meta || " "}</span>
          <span className="hidden sm:inline">{car.year || " "}</span>
        </p>

        {/* Tablets and up get the roomier badge row. */}
        <div className="hidden sm:flex flex-wrap gap-1.5 mt-2 mb-3">
          <Badge color="muted"><Fuel size={11} /> {ENERGY_LABELS[car.energy]}</Badge>
          <Badge color="muted"><Cog size={11} /> {GEARBOX_LABELS[car.gearbox]}</Badge>
          {car.mileage != null && <Badge color="muted"><Gauge size={11} /> {formatAmount(car.mileage, "km")}</Badge>}
        </div>

        <div className="mt-auto pt-1.5 sm:pt-0">
          <div className="mb-1.5 sm:mb-3 leading-none">
            {oldPrice != null && oldPrice > price && (
              <span className="text-[9px] sm:text-sm text-text-muted line-through mr-1 sm:mr-2">{formatAmount(oldPrice)}</span>
            )}
            <span className="text-[13px] sm:text-xl font-black text-emerald-400">{formatAmount(price)}</span>
          </div>
          <div className="flex gap-2">
            <button
              className="btn-ghost text-xs flex-1 hidden sm:inline-flex"
              onClick={(e) => { e.stopPropagation(); open(); }}
            >
              Voir détails
            </button>
            <button
              className="btn-primary flex-1 whitespace-nowrap !px-2 !py-1 !text-[9px] !leading-4 sm:!px-4 sm:!py-2.5 sm:!text-xs"
              onClick={(e) => { e.stopPropagation(); onReserve(car); }}
            >
              Réserver
            </button>
          </div>
        </div>
      </div>
    </motion.article>
  );
}

// Per-letter wave + flowing red gradient
function WaveText({ text, className = "" }) {
  return (
    <span className={`inline-flex flex-wrap justify-center ${className}`}>
      {text.split("").map((ch, i) => (
        <motion.span
          key={i}
          className="gradient-text inline-block"
          style={{ whiteSpace: "pre" }}
          animate={{ y: [0, -12, 0] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut", delay: i * 0.07 }}
        >
          {ch === " " ? " " : ch}
        </motion.span>
      ))}
    </span>
  );
}

// Car details modal content for the public site
function CarDetailContent({ data, onReserve }) {
  const { car, price, oldPrice } = data;
  const specs = [
    ["Année", car.year],
    ["Couleur", car.color],
    ["Énergie", ENERGY_LABELS[car.energy]],
    ["Boîte", GEARBOX_LABELS[car.gearbox]],
    ["Kilométrage", car.mileage != null ? formatAmount(car.mileage, "km") : null],
    ["Places", car.seats],
    ["VIN", car.vin],
    ["Nombre de clés", car.keysCount],
  ].filter(([, v]) => v != null && v !== "");
  return (
    <div className="space-y-4">
      <div className="rounded-xl overflow-hidden"><CarImage images={car.images} heightClass="h-64" zoomable /></div>
      <div className="flex items-end justify-between">
        <h3 className="heading text-xl text-text-primary">{car.brand} {car.model}</h3>
        <div className="text-right">
          {oldPrice != null && oldPrice > price && <span className="text-sm text-text-muted line-through mr-2">{formatAmount(oldPrice)}</span>}
          <span className="text-2xl font-black text-emerald-400">{formatAmount(price)}</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-6">
        {specs.map(([k, v]) => (
          <div key={k} className="flex justify-between text-sm border-b border-red-600/10 py-1.5"><span className="text-text-muted">{k}</span><span className="text-text-primary">{v}</span></div>
        ))}
      </div>
      {car.fiche && <p className="text-sm text-text-muted">{car.fiche}</p>}
      {(car.documents || []).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {car.documents.map((d, i) => <span key={i} className="text-xs text-text-muted glass-card !rounded-lg px-2.5 py-1.5">{d.type}</span>)}
        </div>
      )}
      <button className="btn-primary w-full" onClick={() => onReserve(car)}>Réserver ce véhicule</button>
    </div>
  );
}

// Two cards per row on phones, up to four on large screens.
const GRID = "grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4";

export default function Home() {
  const { settings, loadSettings } = useStore();
  const [offers, setOffers] = useState([]);
  const [specials, setSpecials] = useState([]);
  const [reserve, setReserve] = useState(null);
  const [detailCar, setDetailCar] = useState(null);
  const [showIndicator, setShowIndicator] = useState(true);
  const reduce = useReducedMotion();
  const { scrollY, scrollYProgress } = useScroll();
  useMotionValueEvent(scrollY, "change", (v) => setShowIndicator(v < 100));

  // Thin reading-progress bar that fills as the visitor scrolls the catalogue.
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.3 });

  // The hero drifts away (parallax) instead of simply scrolling out of frame.
  const heroY = useTransform(scrollY, [0, 500], [0, 130]);
  const heroScale = useTransform(scrollY, [0, 500], [1, 0.92]);
  const heroOpacity = useTransform(scrollY, [0, 380], [1, 0]);

  useEffect(() => {
    loadSettings();
    websiteApi.offers().then((data) => setOffers(data)).catch(() => setOffers([]));
    websiteApi.publicSpecialOffers().then((data) => setSpecials(data)).catch(() => setSpecials([]));
  }, []);

  const name = settings?.name || "Altech Showroom";

  return (
    <div className="min-h-screen bg-black">
      <motion.div
        className="fixed top-0 left-0 right-0 h-[3px] z-50 origin-left bg-gradient-to-r from-red-700 via-red-500 to-red-300"
        style={{ scaleX: progress }}
      />
      <WebsiteNav />

      {/* Hero */}
      <section className="relative min-h-[70vh] flex items-center justify-center text-center px-4 overflow-hidden">
        <GlowBg />
        <motion.div
          className="relative z-10 max-w-3xl"
          style={reduce ? undefined : { y: heroY, scale: heroScale, opacity: heroOpacity }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.6, rotate: -15 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 22, delay: 0.3 }}
            className="inline-block mb-5"
            style={{ perspective: 800 }}
          >
            <motion.div
              animate={{ rotateY: [0, 18, 0, -18, 0], y: [0, -8, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
              style={{ transformStyle: "preserve-3d" }}
              className="inline-block"
            >
              <AnimatedLogo src={settings?.logo} size={104} rounded="rounded-2xl" className="mx-auto" />
            </motion.div>
          </motion.div>
          <h1 className="heading text-5xl sm:text-6xl mb-4">
            <WaveText text={name} />
          </h1>
          <motion.p
            className="text-lg mb-8 max-w-xl mx-auto font-medium"
            animate={{ color: ["#fca5a5", "#fee2e2", "#f87171", "#fee2e2", "#fca5a5"] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          >
            {settings?.description || "Véhicules d'exception, service premium."}
          </motion.p>
          <motion.a href="#offers" className="btn-primary text-sm inline-flex" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 20, delay: 1.0 }}>
            Découvrir nos véhicules <ArrowRight size={16} />
          </motion.a>

          <AnimatePresence>
            {showIndicator && (
              <motion.div
                className="mt-12 flex justify-center text-red-500/60"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              >
                <motion.div animate={{ y: [0, 8, 0] }} transition={{ duration: 1.5, repeat: Infinity }}>
                  <ChevronDown size={28} />
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </section>

      {/* Special offers */}
      {specials.length > 0 && (
        <section id="special" className="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-12 scroll-mt-20 overflow-x-clip">
          <SectionTitle icon={Tag}>Offres Spéciales</SectionTitle>
          <div className={GRID}>
            {specials.map((o, i) => {
              const cd = countdown(o.endDate);
              return (
                <ScrollReveal key={o.id} index={i} className="flex flex-col h-full">
                  <OfferCard car={o.car} price={o.specialPrice} oldPrice={o.oldPrice} onReserve={setReserve} onOpen={setDetailCar} />
                  {cd && !cd.expired && (
                    <div className="mt-1.5 sm:mt-2 flex justify-center">
                      <motion.span
                        className="px-2 sm:px-3 py-0.5 sm:py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-[9px] sm:text-xs font-bold whitespace-nowrap"
                        animate={{ scale: [1, 1.04, 1], color: ["#f59e0b", "#fbbf24", "#f59e0b"] }}
                        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                      >
                        ⏱ {cd.days}j {cd.hours}h {cd.minutes}m
                      </motion.span>
                    </div>
                  )}
                </ScrollReveal>
              );
            })}
          </div>
        </section>
      )}

      {/* Offers */}
      <section id="offers" className="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-12 scroll-mt-20 overflow-x-clip">
        <SectionTitle>Nos Véhicules</SectionTitle>
        {offers.length === 0 ? (
          <p className="text-text-muted text-center py-12">Aucun véhicule disponible pour le moment.</p>
        ) : (
          <div className={GRID}>
            {offers.map((car, i) => (
              <ScrollReveal key={car.id} index={i} className="flex flex-col h-full">
                <OfferCard car={car} price={car.price} onReserve={setReserve} onOpen={setDetailCar} />
              </ScrollReveal>
            ))}
          </div>
        )}
      </section>

      <footer className="border-t border-red-600/20 py-8 text-center text-text-muted text-sm">
        <p>© {new Date().getFullYear()} {name}</p>
        <p className="mt-1">{settings?.phone} {settings?.email && `· ${settings.email}`}</p>
      </footer>

      {/* Car details modal — closes on outside click (backdrop) */}
      <Modal open={!!detailCar} onClose={() => setDetailCar(null)} title={detailCar ? `${detailCar.car.brand} ${detailCar.car.model}` : ""} size="lg">
        {detailCar && <CarDetailContent data={detailCar} onReserve={(car) => { setDetailCar(null); setReserve(car); }} />}
      </Modal>

      {reserve && <ReservationModal car={reserve} onClose={() => setReserve(null)} />}
    </div>
  );
}
