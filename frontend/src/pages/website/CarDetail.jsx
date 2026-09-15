import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Fuel, Cog, Gauge, Calendar, Palette, Hash } from "lucide-react";
import { websiteApi } from "../../lib/api.js";
import { useStore } from "../../store/useStore.js";
import { CarImage } from "../../components/CarCard.jsx";
import { Badge, Modal, Field } from "../../components/ui.jsx";
import { formatAmount, ENERGY_LABELS, GEARBOX_LABELS } from "../../utils/format.js";
import WebsiteNav from "./WebsiteNav.jsx";

export default function CarDetail() {
  const { id } = useParams();
  const { loadSettings } = useStore();
  const [car, setCar] = useState(null);
  const [reserve, setReserve] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    loadSettings();
    websiteApi.offers().then((data) => {
      setCar(data.find((c) => c.id === Number(id)) || null);
    });
  }, [id]);

  const submit = async () => {
    if (!name || !phone) return;
    await websiteApi.createReservation({ carId: car.id, clientName: name, clientPhone: phone });
    setDone(true);
  };

  if (!car) {
    return (
      <div className="min-h-screen bg-black">
        <WebsiteNav />
        <p className="text-text-muted text-center py-20">Véhicule introuvable. <Link to="/website" className="text-red-400">Retour</Link></p>
      </div>
    );
  }

  const specs = [
    [Calendar, "Année", car.year],
    [Palette, "Couleur", car.color],
    [Fuel, "Énergie", ENERGY_LABELS[car.energy]],
    [Cog, "Boîte", GEARBOX_LABELS[car.gearbox]],
    [Gauge, "Kilométrage", car.mileage != null ? formatAmount(car.mileage, "km") : null],
    [Hash, "VIN", car.vin],
  ];

  return (
    <div className="min-h-screen bg-black">
      <WebsiteNav />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <Link to="/website" className="btn-ghost text-xs mb-5"><ArrowLeft size={14} /> Retour</Link>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="glass-card overflow-hidden">
            <CarImage images={car.images} heightClass="h-72" zoomable />
          </div>
          <div>
            <h1 className="heading text-3xl text-text-primary">{car.brand} {car.model}</h1>
            <p className="text-3xl font-black text-emerald-400 my-4">{formatAmount(car.price)}</p>
            <div className="grid grid-cols-2 gap-3 mb-6">
              {specs.filter(([, , v]) => v).map(([Icon, label, value]) => (
                <div key={label} className="glass-card p-3 flex items-center gap-3">
                  <Icon className="text-red-500" size={18} />
                  <div><p className="label-caps">{label}</p><p className="text-sm text-text-primary">{value}</p></div>
                </div>
              ))}
            </div>
            {car.fiche && <p className="text-text-muted text-sm mb-6">{car.fiche}</p>}
            <button className="btn-primary w-full" onClick={() => setReserve(true)}>Réserver ce véhicule</button>
          </div>
        </div>
      </div>

      {reserve && (
        <Modal open onClose={() => setReserve(false)} title={done ? "Demande envoyée ✓" : "Réserver"} size="sm"
          footer={done ? <button className="btn-primary" onClick={() => setReserve(false)}>Fermer</button> :
            <><button className="btn-ghost" onClick={() => setReserve(false)}>Annuler</button><button className="btn-primary" onClick={submit} disabled={!name || !phone}>Envoyer</button></>}>
          {done ? <p className="text-text-muted">Merci ! Nous vous contacterons bientôt.</p> : (
            <div className="space-y-4">
              <Field label="Nom complet" required><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
              <Field label="Téléphone" required><input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
