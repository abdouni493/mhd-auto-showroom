import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion, useScroll, useMotionValueEvent, useMotionValue, useSpring, useTransform } from "framer-motion";
import { Car, Fuel, Cog, Gauge, ArrowRight, Tag, ChevronDown } from "lucide-react";
import { websiteApi } from "../../lib/api.js";
import { useStore } from "../../store/useStore.js";
import { CarImage } from "../../components/CarCard.jsx";
import AnimatedLogo from "../../components/AnimatedLogo.jsx";
import { Badge, Modal, Field } from "../../components/ui.jsx";
import { formatAmount, countdown, ENERGY_LABELS, GEARBOX_LABELS } from "../../utils/format.js";
import WebsiteNav from "./WebsiteNav.jsx";

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

// 3D mouse-tilt wrapper
function Tilt3D({ children, className, index = 0, onClick }) {
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rx = useSpring(useTransform(my, [-0.5, 0.5], [10, -10]), { stiffness: 200, damping: 18 });
  const ry = useSpring(useTransform(mx, [-0.5, 0.5], [-10, 10]), { stiffness: 200, damping: 18 });
  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width - 0.5);
    my.set((e.clientY - r.top) / r.height - 0.5);
  };
  const reset = () => { mx.set(0); my.set(0); };
  return (
    <motion.div
      className={className}
      onClick={onClick}
      style={{ rotateX: rx, rotateY: ry, transformStyle: "preserve-3d", perspective: 900, cursor: onClick ? "pointer" : undefined }}
      onMouseMove={onMove}
      onMouseLeave={reset}
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.4, ease: "easeOut", delay: index * 0.06 }}
      whileHover={{ scale: 1.02, boxShadow: "0 30px 70px rgba(220,38,38,0.28), 0 0 0 1px rgba(220,38,38,0.45)" }}
    >
      {children}
    </motion.div>
  );
}

function OfferCard({ car, price, oldPrice, onReserve, onOpen, index = 0 }) {
  return (
    <Tilt3D className="glass-card overflow-hidden flex flex-col group" index={index} onClick={() => onOpen({ car, price, oldPrice })}>
      <div style={{ transform: "translateZ(40px)" }}><CarImage images={car.images} heightClass="h-48" fit="cover" /></div>
      <div className="p-4 flex-1 flex flex-col" style={{ transform: "translateZ(25px)" }}>
        <h3 className="heading text-base text-text-primary">{car.brand} {car.model}</h3>
        <p className="text-xs text-text-muted mb-2">{car.year}</p>
        <div className="flex flex-wrap gap-1.5 mb-3">
          <Badge color="muted"><Fuel size={11} /> {ENERGY_LABELS[car.energy]}</Badge>
          <Badge color="muted"><Cog size={11} /> {GEARBOX_LABELS[car.gearbox]}</Badge>
          {car.mileage != null && <Badge color="muted"><Gauge size={11} /> {formatAmount(car.mileage, "km")}</Badge>}
        </div>
        <div className="mt-auto">
          <div className="mb-3">
            {oldPrice != null && oldPrice > price && <span className="text-sm text-text-muted line-through mr-2">{formatAmount(oldPrice)}</span>}
            <span className="text-xl font-black text-emerald-400">{formatAmount(price)}</span>
          </div>
          <div className="flex gap-2">
            <button className="btn-ghost text-xs flex-1" onClick={(e) => { e.stopPropagation(); onOpen({ car, price, oldPrice }); }}>Voir détails</button>
            <button className="btn-primary text-xs flex-1" onClick={(e) => { e.stopPropagation(); onReserve(car); }}>Réserver</button>
          </div>
        </div>
      </div>
    </Tilt3D>
  );
}

const HEADING_WORD = {
  hidden: { opacity: 0, y: 40, rotateX: 90 },
  show: (i) => ({ opacity: 1, y: 0, rotateX: 0, transition: { delay: 0.5 + i * 0.1, type: "spring", stiffness: 200, damping: 18 } }),
};

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
          {ch === " " ? " " : ch}
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

export default function Home() {
  const { settings, loadSettings } = useStore();
  const [offers, setOffers] = useState([]);
  const [specials, setSpecials] = useState([]);
  const [reserve, setReserve] = useState(null);
  const [detailCar, setDetailCar] = useState(null);
  const [showIndicator, setShowIndicator] = useState(true);
  const { scrollY } = useScroll();
  useMotionValueEvent(scrollY, "change", (v) => setShowIndicator(v < 100));

  useEffect(() => {
    loadSettings();
    websiteApi.offers().then((data) => setOffers(data)).catch(() => setOffers([]));
    websiteApi.publicSpecialOffers().then((data) => setSpecials(data)).catch(() => setSpecials([]));
  }, []);

  const name = settings?.name || "Altech Showroom";
  const words = name.split(" ");

  return (
    <div className="min-h-screen bg-black">
      <WebsiteNav />

      {/* Hero */}
      <section className="relative min-h-[70vh] flex items-center justify-center text-center px-4 overflow-hidden">
        <GlowBg />
        <div className="relative z-10 max-w-3xl">
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
        </div>
      </section>

      {/* Special offers */}
      {specials.length > 0 && (
        <section id="special" className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
          <motion.div className="flex items-center gap-3 mb-6" initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.4 }}>
            <Tag className="text-red-500" size={24} />
            <h2 className="heading text-2xl text-text-primary">Offres Spéciales</h2>
          </motion.div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {specials.map((o, i) => {
              const cd = countdown(o.endDate);
              return (
                <div key={o.id}>
                  <OfferCard car={o.car} price={o.specialPrice} oldPrice={o.oldPrice} onReserve={setReserve} onOpen={setDetailCar} index={i} />
                  {cd && !cd.expired && (
                    <div className="mt-2 flex justify-center">
                      <motion.span
                        className="px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-xs font-bold"
                        animate={{ scale: [1, 1.04, 1], color: ["#f59e0b", "#fbbf24", "#f59e0b"] }}
                        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                      >
                        ⏱ {cd.days}j {cd.hours}h {cd.minutes}m
                      </motion.span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Offers */}
      <section id="offers" className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <motion.h2 className="heading text-2xl text-text-primary mb-6" initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.4 }}>
          Nos Véhicules
        </motion.h2>
        {offers.length === 0 ? (
          <p className="text-text-muted text-center py-12">Aucun véhicule disponible pour le moment.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {offers.map((car, i) => <OfferCard key={car.id} car={car} price={car.price} onReserve={setReserve} onOpen={setDetailCar} index={i} />)}
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
