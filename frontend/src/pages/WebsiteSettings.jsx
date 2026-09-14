import { useState, useEffect } from "react";
import { Eye, EyeOff, Trash2, Plus, Tag } from "lucide-react";
import { websiteApi, carsApi } from "../lib/api.js";
import { useStore } from "../store/useStore.js";
import { useFetch } from "../hooks/useApi.js";
import { useCan } from "../lib/permissions.js";
import { Card, Badge, Modal, Field, EmptyState, SkeletonGrid } from "../components/ui.jsx";
import PageHeader from "../components/PageHeader.jsx";
import SearchSelect from "../components/SearchSelect.jsx";
import { CarImage } from "../components/CarCard.jsx";
import AnimatedLogo from "../components/AnimatedLogo.jsx";
import { formatAmount, formatDate, toDateTimeLocal, countdown } from "../utils/format.js";
import DateInput from "../components/DateInput.jsx";

const TABS = [["offers", "Offres"], ["special", "Offres Spéciales"], ["contacts", "Contacts"], ["appearance", "Apparence"]];

function Offers() {
  const can = useCan();
  const { data: offers, loading, refetch } = useFetch(() => websiteApi.adminOffers(), []);
  const toggle = async (carId, hidden) => { await websiteApi.setVisibility(carId, !hidden); refetch(); };
  if (loading) return <SkeletonGrid />;
  if (!offers?.length) return <EmptyState message="Aucune voiture disponible" />;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {offers.map((c) => (
        <Card key={c.id} className="overflow-hidden">
          <CarImage images={c.images} heightClass="h-40" />
          <div className="p-4">
            <div className="flex justify-between items-start mb-2">
              <div><p className="heading text-sm text-text-primary">{c.brand} {c.model}</p><p className="text-xs text-text-muted">{c.year}</p></div>
              <Badge color={c.hidden ? "muted" : "success"}>{c.hidden ? "Masqué" : "Visible"}</Badge>
            </div>
            <p className="text-lg font-black text-emerald-400 mb-3">{formatAmount(c.price)}</p>
            {can("websiteSettings", "edit") && (
              <button className={c.hidden ? "btn-primary w-full text-xs" : "btn-ghost w-full text-xs"} onClick={() => toggle(c.id, c.hidden)}>
                {c.hidden ? <><Eye size={14} /> Afficher</> : <><EyeOff size={14} /> Masquer</>}
              </button>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}

function SpecialOffers() {
  const can = useCan();
  const { data: offers, loading, refetch } = useFetch(() => websiteApi.specialOffers(), []);
  const [show, setShow] = useState(false);
  const [car, setCar] = useState(null);
  const [price, setPrice] = useState("");
  const [start, setStart] = useState(toDateTimeLocal());
  const [end, setEnd] = useState(toDateTimeLocal(new Date(Date.now() + 7 * 864e5)));

  const create = async () => {
    if (!car || !price) return;
    await websiteApi.createSpecialOffer({ carId: car.id, specialPrice: Number(price), startDate: start, endDate: end });
    setShow(false); setCar(null); setPrice(""); refetch();
  };
  const remove = async (id) => { await websiteApi.deleteSpecialOffer(id); refetch(); };
  const toggleHide = async (carId, hidden) => { await websiteApi.setVisibility(carId, !hidden); refetch(); };

  return (
    <div>
      {can("websiteSettings", "create") && <button className="btn-primary mb-5" onClick={() => setShow(true)}><Plus size={14} /> Créer une offre spéciale</button>}
      {loading ? <SkeletonGrid /> : !offers?.length ? <EmptyState icon={Tag} message="Aucune offre spéciale" /> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {offers.map((o) => {
            const cd = countdown(o.endDate);
            return (
              <Card key={o.id} className="overflow-hidden">
                <CarImage images={o.car?.images} heightClass="h-40" />
                <div className="p-4">
                  <p className="heading text-sm text-text-primary">{o.car?.brand} {o.car?.model}</p>
                  <div className="my-2">
                    <span className="text-sm text-text-muted line-through mr-2">{formatAmount(o.oldPrice)}</span>
                    <span className="text-lg font-black text-red-400">{formatAmount(o.specialPrice)}</span>
                  </div>
                  {cd && !cd.expired && <p className="text-xs text-amber-400 mb-2">⏱ {cd.days}j {cd.hours}h {cd.minutes}m restantes</p>}
                  <div className="flex items-center justify-between mb-2">
                    {cd?.expired ? <Badge color="muted">Expirée</Badge> : <span />}
                    <Badge color={o.hidden ? "muted" : "success"}>{o.hidden ? "Masquée" : "Visible"}</Badge>
                  </div>
                  <div className="flex gap-2 mt-2">
                    {can("websiteSettings", "edit") && (
                      <button className={o.hidden ? "btn-primary flex-1 text-xs" : "btn-ghost flex-1 text-xs"} onClick={() => toggleHide(o.carId, o.hidden)}>
                        {o.hidden ? <><Eye size={13} /> Afficher</> : <><EyeOff size={13} /> Masquer</>}
                      </button>
                    )}
                    {can("websiteSettings", "delete") && <button className="btn-ghost text-xs px-3" onClick={() => remove(o.id)}><Trash2 size={13} /></button>}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={show} onClose={() => setShow(false)} title="Nouvelle offre spéciale" size="sm"
        footer={<><button className="btn-ghost" onClick={() => setShow(false)}>Annuler</button><button className="btn-primary" onClick={create} disabled={!car || !price}>Créer</button></>}>
        <div className="space-y-4">
          {car ? (
            <Card className="p-2 flex items-center gap-2">
              <div className="w-12 h-9 rounded overflow-hidden shrink-0"><CarImage images={car.images} heightClass="h-9" /></div>
              <div className="flex-1"><p className="text-sm text-text-primary">{car.brand} {car.model}</p></div>
              <button className="btn-ghost text-xs py-1" onClick={() => setCar(null)}>Changer</button>
            </Card>
          ) : (
            <div><p className="label-caps">Véhicule</p>
              <SearchSelect fetcher={(q) => carsApi.list({ search: q })} placeholder="Rechercher..." onSelect={setCar}
                renderItem={(c) => <div><p className="text-sm text-text-primary">{c.brand} {c.model}</p><p className="text-xs text-text-muted">{c.plate}</p></div>} />
            </div>
          )}
          <Field label="Nouveau prix"><input className="input" type="number" value={price} onChange={(e) => setPrice(e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Début"><DateInput withTime value={start} onChange={setStart} /></Field>
            <Field label="Fin"><DateInput withTime value={end} onChange={setEnd} /></Field>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function Contacts() {
  const can = useCan();
  const [c, setC] = useState({});
  const [msg, setMsg] = useState("");
  useEffect(() => { websiteApi.getContacts().then((data) => setC(data)); }, []);
  const save = async () => { await websiteApi.updateContacts(c); setMsg("Enregistré ✓"); setTimeout(() => setMsg(""), 2500); };
  return (
    <Card className="p-6 max-w-lg">
      <div className="space-y-4">
        {[["facebook", "Facebook URL"], ["instagram", "Instagram URL"], ["tiktok", "TikTok URL"], ["maps", "Google Maps URL"], ["whatsapp", "WhatsApp (numéro)"]].map(([f, l]) => (
          <Field key={f} label={l}><input className="input" value={c[f] || ""} onChange={(e) => setC({ ...c, [f]: e.target.value })} /></Field>
        ))}
      </div>
      <div className="flex items-center gap-3 mt-5">{can("websiteSettings", "edit") && <button className="btn-primary" onClick={save}>Enregistrer</button>}{msg && <span className="text-emerald-400 text-sm">{msg}</span>}</div>
    </Card>
  );
}

function Appearance() {
  const { settings } = useStore();
  return (
    <Card className="p-6 max-w-lg">
      <div className="flex items-center gap-4 mb-4">
        <AnimatedLogo src={settings?.logo} size={80} rounded="rounded-2xl" />
        <div>
          <p className="heading text-lg text-text-primary">{settings?.name}</p>
          <p className="text-text-muted text-sm">{settings?.description}</p>
        </div>
      </div>
      <p className="text-text-muted text-sm">Pour modifier le logo, le nom et la description, rendez-vous dans <b className="text-text-primary">Paramètres → Showroom</b>.</p>
    </Card>
  );
}

export default function WebsiteSettings() {
  const [tab, setTab] = useState("offers");
  return (
    <div>
      <PageHeader title="Paramètres Site" />
      <div className="flex gap-2 mb-6 flex-wrap">
        {TABS.map(([k, l]) => <button key={k} className={`chip ${tab === k ? "chip-active" : ""}`} onClick={() => setTab(k)}>{l}</button>)}
      </div>
      {tab === "offers" && <Offers />}
      {tab === "special" && <SpecialOffers />}
      {tab === "contacts" && <Contacts />}
      {tab === "appearance" && <Appearance />}
    </div>
  );
}
