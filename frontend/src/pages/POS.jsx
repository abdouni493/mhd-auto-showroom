import { useState, useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Search, Store, User, FileText, ShoppingCart } from "lucide-react";
import { carsApi } from "../lib/api.js";
import { useFetch } from "../hooks/useApi.js";
import { useCan } from "../lib/permissions.js";
import { useStore } from "../store/useStore.js";
import { Card, Badge, EmptyState, SkeletonGrid, Modal, useToast } from "../components/ui.jsx";
import PageHeader from "../components/PageHeader.jsx";
import { CarImage } from "../components/CarCard.jsx";
import SaleWizard from "../components/SaleWizard.jsx";
import { FactureDocument } from "../components/PrintDocs.jsx";
import { usePrintDialog } from "../components/PrintChooser.jsx";
import { formatAmount, ENERGY_LABELS } from "../utils/format.js";

const ENERGY_FILTERS = [["", "pos.energyAll"], ["ESSENCE", "energy.ESSENCE"], ["DIESEL", "energy.DIESEL"], ["HYBRID", "energy.HYBRID"], ["ELECTRIC", "energy.ELECTRIC"]];

export default function POS() {
  const { t } = useTranslation();
  const can = useCan();
  const { refreshSettlements, settings } = useStore();
  const toast = useToast();
  const navigate = useNavigate();
  const openPrint = usePrintDialog();
  const [proformaCar, setProformaCar] = useState(null);
  const [createdProforma, setCreatedProforma] = useState(null);
  const canProforma = can("pos", "create") || can("proformas", "create");
  const printProforma = (p) => openPrint((lang) => (
    <FactureDocument sale={p} showroom={settings} lang={lang} proforma invoiceNumber={p.reference} />
  ));
  const [search, setSearch] = useState("");
  const [energy, setEnergy] = useState("");
  const { data: cars, loading, refetch } = useFetch(() => carsApi.listAvailable(), []);
  const [selling, setSelling] = useState(null);

  // Clean up orphaned car records left by previous purchase deletions
  useEffect(() => {
    carsApi.cleanupOrphaned().catch(() => {});
  }, []);

  const filtered = (cars || []).filter((c) =>
    (!energy || c.energy === energy) &&
    (`${c.brand} ${c.model} ${c.plate || ""}`.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div>
      <PageHeader title={t("pos.title")}>
        <Badge color="success">{filtered.length} {t("pos.available")}</Badge>
      </PageHeader>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
          <input className="input pl-9 rtl:pl-3 rtl:pr-9" placeholder={t("common.search")} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-2">
          {ENERGY_FILTERS.map(([v, l]) => <button key={v} className={`chip ${energy === v ? "chip-active" : ""}`} onClick={() => setEnergy(v)}>{t(l)}</button>)}
        </div>
      </div>

      {loading ? <SkeletonGrid /> : filtered.length === 0 ? (
        <EmptyState message={t("pos.noAvailable")} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filtered.map((car) => (
            <Card key={car.id} className="overflow-hidden flex flex-col">
              <CarImage images={car.images} heightClass="h-40" fit="cover" zoomable />
              <div className="p-4 flex-1 flex flex-col">
                <h3 className="heading text-sm text-text-primary truncate">
                  {car.brand} {car.model}{car.color ? ` (${car.color})` : ""}
                </h3>
                <div className="flex flex-wrap gap-1 my-2">
                  {car.year && <Badge color="muted">{car.year}</Badge>}
                  <Badge color="muted">{ENERGY_LABELS[car.energy]}</Badge>
                  {car.purchase?.sourceType === "CLIENT" ? (
                    <Badge color="warning"><User size={10} /> {t("pos.depositCar")}</Badge>
                  ) : car.purchase?.sourceType === "SHOWROOM" ? (
                    <Badge color="accent"><Store size={10} /> {t("purchase.sourceShowroom")}</Badge>
                  ) : null}
                </div>
                {car.vin && <p className="text-xs text-text-muted truncate">{car.vin}</p>}
                {car.mileage != null && <p className="text-xs text-text-muted mb-2">{formatAmount(car.mileage, "km")}</p>}
                <div className="mt-auto pt-3">
                  <p className="text-xl font-black text-emerald-400 mb-2">{formatAmount(car.purchase?.sellingPrice)}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {can("pos", "create") && (
                      <button className="btn-primary text-xs justify-center" onClick={() => setSelling(car)}>
                        <ShoppingCart size={13} /> {t("pos.sell")}
                      </button>
                    )}
                    {canProforma && (
                      <button
                        className={`btn-ghost text-xs justify-center !border-amber-500/40 !text-amber-300 hover:!bg-amber-500/10 ${can("pos", "create") ? "" : "col-span-2"}`}
                        onClick={() => setProformaCar(car)}
                      >
                        <FileText size={13} /> {t("proforma.short")}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <AnimatePresence>
        {proformaCar && (
          <SaleWizard
            key="proforma"
            mode="proforma"
            car={proformaCar}
            onClose={() => setProformaCar(null)}
            onDone={(p) => {
              setProformaCar(null);
              setCreatedProforma(p);
              toast(t("proforma.createdToast"));
            }}
          />
        )}
        {selling && (
          <SaleWizard
            key="sale"
            mode="sale"
            car={selling}
            onClose={() => setSelling(null)}
            onDone={() => {
              setSelling(null);
              refetch();
              // A sale of a client vehicle raises the owner-settlement alert.
              refreshSettlements();
              toast(t("pos.finalizedToast"));
            }}
          />
        )}
      </AnimatePresence>

      {/* After a proforma is created: print it now or open the history */}
      <Modal
        open={!!createdProforma}
        onClose={() => setCreatedProforma(null)}
        title={t("proforma.createdTitle")}
        size="sm"
        footer={
          <>
            <button className="btn-ghost" onClick={() => { setCreatedProforma(null); navigate("/app/proformas"); }}>{t("proforma.openHistory")}</button>
            <button className="btn-primary" onClick={() => { const p = createdProforma; setCreatedProforma(null); printProforma(p); }}>
              <FileText size={15} /> {t("proforma.printNow")}
            </button>
          </>
        }
      >
        {createdProforma && (
          <div className="text-sm space-y-1">
            <p className="text-text-primary font-bold">{createdProforma.reference}</p>
            <p className="text-text-muted">{createdProforma.car?.brand} {createdProforma.car?.model} · {createdProforma.client?.firstName} {createdProforma.client?.lastName}</p>
            <p className="text-text-muted">{t("proforma.notSoldHint")}</p>
          </div>
        )}
      </Modal>
    </div>
  );
}
