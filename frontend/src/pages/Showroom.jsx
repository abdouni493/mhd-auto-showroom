import { useState } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Search, FileText } from "lucide-react";
import { useFetch } from "../hooks/useApi.js";
import { carsApi } from "../lib/api.js";
import CarCard, { CarImage } from "../components/CarCard.jsx";
import { Card, Badge, Modal, SkeletonGrid, EmptyState, AnimatedGrid } from "../components/ui.jsx";
import PageHeader from "../components/PageHeader.jsx";
import {
  formatAmount, formatDate, ENERGY_LABELS, GEARBOX_LABELS,
  STATUS_LABELS, STATUS_COLORS,
} from "../utils/format.js";

const FILTERS = [
  { key: "", tkey: "common.all" },
  { key: "AVAILABLE", tkey: "status.AVAILABLE" },
  { key: "SOLD", tkey: "status.SOLD" },
  { key: "RESERVED", tkey: "status.RESERVED" },
];

function Section({ title, tint = "", children }) {
  return (
    <div className="mb-5">
      <div className="flex items-center gap-3 mb-3">
        <h4 className={`heading text-xs ${tint}`}>{title}</h4>
        <div className="flex-1 h-px bg-red-600/20" />
      </div>
      {children}
    </div>
  );
}

function DRow({ label, value }) {
  return (
    <div className="flex justify-between py-1 text-sm">
      <span className="text-text-muted">{label}</span>
      <span className="text-text-primary font-medium text-right">{value ?? "—"}</span>
    </div>
  );
}

function CarDetail({ car }) {
  const { t } = useTranslation();
  const purchase = car.purchase;
  const sale = car.sales?.[0];
  const totalExpenses = (car.expenses || []).reduce((a, e) => a + e.amount, 0);
  const client = sale?.client || purchase?.client;

  return (
    <div>
      <div className="rounded-xl overflow-hidden mb-5">
        <CarImage images={car.images} heightClass="h-56" />
      </div>

      <Section title={t("showroom.sectionVehicle")}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
          <DRow label={t("car.brand")} value={car.brand} />
          <DRow label={t("car.model")} value={car.model} />
          <DRow label={t("car.plate")} value={car.plate} />
          <DRow label={t("car.year")} value={car.year} />
          <DRow label={t("car.color")} value={car.color} />
          <DRow label={t("car.energy")} value={ENERGY_LABELS[car.energy]} />
          <DRow label={t("car.gearbox")} value={GEARBOX_LABELS[car.gearbox]} />
          <DRow label={t("car.seats")} value={car.seats} />
          <DRow label={t("car.mileage")} value={car.mileage != null ? formatAmount(car.mileage, "km") : null} />
          <DRow label="VIN" value={car.vin} />
          <DRow label={t("car.keys")} value={car.keysCount} />
        </div>
        {car.fiche && <p className="text-sm text-text-muted mt-2">{car.fiche}</p>}
      </Section>

      {(car.documents || []).length > 0 && (
        <Section title={t("car.documentsOfVehicle")} tint="text-blue-400">
          <div className="flex flex-wrap gap-2">
            {car.documents.map((d, i) => d.url ? (
              <a key={i} href={d.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 glass-card !rounded-lg px-3 py-2 hover:border-red-600/60 transition">
                <FileText size={15} className="text-blue-400" />
                <span className="text-xs text-text-primary">{d.type}</span>
              </a>
            ) : (
              <div key={i} className="flex items-center gap-2 glass-card !rounded-lg px-3 py-2 opacity-60">
                <FileText size={15} className="text-text-muted" />
                <span className="text-xs text-text-primary">{d.type}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {client && (
        <Section title={t("showroom.sectionClient")} tint={car.status === "SOLD" ? "text-emerald-400" : "text-amber-400"}>
          <div className={`glass-card p-3 border ${car.status === "SOLD" ? "border-emerald-500/30" : "border-amber-500/30"}`}>
            <div className="flex items-center gap-3 mb-2">
              {client.photo && <img src={client.photo} className="w-12 h-12 rounded-full object-cover" alt="" />}
              <div>
                <p className="text-text-primary font-bold">{client.firstName} {client.lastName}</p>
                <p className="text-xs text-text-muted">{client.phonePrimary}</p>
              </div>
            </div>
            <DRow label={t("showroom.document")} value={`${client.docType || "—"} ${client.docNumber || ""}`} />
          </div>
        </Section>
      )}

      <Section title={t("showroom.sectionPricing")}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
          <DRow label={t("showroom.purchasePrice")} value={purchase ? formatAmount(purchase.purchasePrice) : null} />
          <DRow label={t("showroom.sellingPrice")} value={purchase ? formatAmount(purchase.sellingPrice) : null} />
          {sale && <DRow label={t("showroom.invoicePrice")} value={formatAmount(sale.totalAfterReduction)} />}
          {sale && <DRow label={t("showroom.tva")} value={sale.tvaEnabled ? `${sale.tvaRate}%` : t("common.no")} />}
          {sale && <DRow label={t("showroom.totalPaid")} value={formatAmount(sale.amountPaid)} />}
          {sale && <DRow label={t("showroom.remainingDebt")} value={<span className="text-rose-400">{formatAmount(sale.amountRest)}</span>} />}
        </div>
      </Section>

      <Section title={t("showroom.sectionExpenses")} tint="text-amber-400">
        <p className="text-2xl font-black text-amber-400 mb-2">{formatAmount(totalExpenses)}</p>
        <div className="space-y-1.5 max-h-40 overflow-y-auto">
          {(car.expenses || []).length === 0 && <p className="text-sm text-text-muted">{t("showroom.noExpense")}</p>}
          {(car.expenses || []).map((e) => (
            <div key={e.id} className="flex justify-between text-sm border-b border-red-600/10 pb-1">
              <div><span className="text-text-primary">{e.name}</span>{e.description && <span className="text-text-muted"> — {e.description}</span>}</div>
              <div className="text-right whitespace-nowrap"><span className="text-amber-400">{formatAmount(e.amount)}</span> <span className="text-text-muted text-xs">{formatDate(e.date)}</span></div>
            </div>
          ))}
        </div>
      </Section>

      <Section title={t("showroom.sectionPayments")}>
        <div className="space-y-1.5 max-h-40 overflow-y-auto">
          {sale && sale.payments?.length > 0 ? (
            sale.payments.map((p) => (
              <div key={p.id} className="flex justify-between text-sm border-b border-red-600/10 pb-1">
                <span className="text-text-muted">{formatDate(p.date)} — {p.description}</span>
                <span className="text-emerald-400">{formatAmount(p.amount)}</span>
              </div>
            ))
          ) : (
            <p className="text-sm text-text-muted">{t("showroom.noPayment")}</p>
          )}
        </div>
      </Section>
    </div>
  );
}

export default function Showroom() {
  const { t } = useTranslation();
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const { data: cars, loading } = useFetch(() => carsApi.list({ status, search }), [status, search]);
  const [selected, setSelected] = useState(null);

  return (
    <div>
      <PageHeader title={t("nav.showroom")} subtitle={t("showroom.subtitle")} />

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <motion.div className="flex flex-wrap gap-2" initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          {FILTERS.map((f) => (
            <motion.button key={f.key} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.92 }} className={`chip ${status === f.key ? "chip-active" : ""}`} onClick={() => setStatus(f.key)}>
              {t(f.tkey)}
            </motion.button>
          ))}
        </motion.div>
        <div className="relative flex-1 sm:max-w-xs sm:ml-auto rtl:sm:ml-0 rtl:sm:mr-auto">
          <Search className="absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
          <input className="input pl-9 rtl:pl-3 rtl:pr-9" placeholder={t("common.search")} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {loading ? (
        <SkeletonGrid />
      ) : cars?.length === 0 ? (
        <EmptyState icon={Search} message={t("showroom.noCars")} />
      ) : (
        <AnimatedGrid className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {cars.map((car) => (
            <CarCard
              key={car.id}
              car={car}
              price={car.purchase?.sellingPrice}
              onClick={() => setSelected(car)}
            />
          ))}
        </AnimatedGrid>
      )}

      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected ? `${selected.brand} ${selected.model}` : ""} size="lg">
        {selected && <CarDetail car={selected} />}
      </Modal>
    </div>
  );
}
