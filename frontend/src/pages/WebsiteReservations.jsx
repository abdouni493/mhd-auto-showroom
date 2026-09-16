import { useState } from "react";
import { Check, X, Phone, CalendarCheck, Search } from "lucide-react";
import { websiteApi } from "../lib/api.js";
import { useFetch } from "../hooks/useApi.js";
import { useCan } from "../lib/permissions.js";
import { Card, Badge, EmptyState, SkeletonGrid, AnimatedGrid } from "../components/ui.jsx";
import PageHeader from "../components/PageHeader.jsx";
import { CarImage } from "../components/CarCard.jsx";
import { formatDate } from "../utils/format.js";

const STATUS = {
  PENDING: { label: "En attente", color: "warning" },
  ACCEPTED: { label: "Acceptée", color: "success" },
  CANCELLED: { label: "Annulée", color: "debt" },
};

const FILTERS = [
  { key: "", label: "Toutes" },
  { key: "PENDING", label: "En attente" },
  { key: "ACCEPTED", label: "Acceptées" },
  { key: "CANCELLED", label: "Annulées" },
];

export default function WebsiteReservations() {
  const can = useCan();
  const { data: reservations, loading, refetch } = useFetch(() => websiteApi.reservations(), []);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");

  const setStatus = async (id, status) => {
    await websiteApi.updateReservationStatus(id, status);
    refetch();
  };

  const filtered = (reservations || []).filter((r) =>
    (!statusFilter || r.status === statusFilter) &&
    (r.clientName?.toLowerCase().includes(search.toLowerCase()) || r.clientPhone?.includes(search))
  );

  return (
    <div>
      <PageHeader title="Réservations Site" />

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => <button key={f.key} className={`chip ${statusFilter === f.key ? "chip-active" : ""}`} onClick={() => setStatusFilter(f.key)}>{f.label}</button>)}
        </div>
        <div className="relative flex-1 sm:max-w-xs sm:ml-auto rtl:sm:ml-0 rtl:sm:mr-auto">
          <Search className="absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
          <input className="input pl-9 rtl:pl-3 rtl:pr-9" placeholder="Rechercher par nom..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {loading ? <SkeletonGrid /> : filtered.length === 0 ? (
        <EmptyState icon={CalendarCheck} message="Aucune réservation" />
      ) : (
        <AnimatedGrid className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((r) => (
            <Card key={r.id} className="p-4 flex gap-4">
              <div className="w-28 h-20 rounded-lg overflow-hidden shrink-0"><CarImage images={r.car?.images} heightClass="h-20" fit="cover" /></div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="heading text-sm text-text-primary">{r.clientName}</p>
                    <p className="text-xs text-text-muted flex items-center gap-1"><Phone size={11} /> {r.clientPhone}</p>
                  </div>
                  <Badge color={STATUS[r.status].color}>{STATUS[r.status].label}</Badge>
                </div>
                <p className="text-xs text-text-muted my-2">{r.car?.brand} {r.car?.model} · {r.car?.plate}</p>
                <p className="text-xs text-text-muted">{formatDate(r.createdAt)}</p>
                {r.status === "PENDING" && can("websiteReservations", "edit") && (
                  <div className="flex gap-2 mt-3">
                    <button className="btn-primary text-xs py-1.5 flex-1" onClick={() => setStatus(r.id, "ACCEPTED")}><Check size={13} /> Accepter</button>
                    <button className="btn-ghost text-xs py-1.5 flex-1" onClick={() => setStatus(r.id, "CANCELLED")}><X size={13} /> Annuler</button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </AnimatedGrid>
      )}
    </div>
  );
}
