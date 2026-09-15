import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { X, Search, HandCoins, Store, User } from "lucide-react";
import { salesApi, carsApi, clientsApi, inspectionApi } from "../lib/api.js";
import { useFetch } from "../hooks/useApi.js";
import { useCan } from "../lib/permissions.js";
import { useStore } from "../store/useStore.js";
import { Card, Badge, Field, EmptyState, SkeletonGrid, Stepper, Toggle, useToast } from "../components/ui.jsx";
import PageHeader from "../components/PageHeader.jsx";
import SearchSelect from "../components/SearchSelect.jsx";
import ClientForm, { validateClient } from "../components/ClientForm.jsx";
import InspectionChecklist, { DEFAULT_INSPECTION } from "../components/InspectionChecklist.jsx";
import { CarImage } from "../components/CarCard.jsx";
import { formatAmount, toDateTimeLocal, ENERGY_LABELS, GEARBOX_LABELS } from "../utils/format.js";
import DateInput from "../components/DateInput.jsx";

const ENERGY_FILTERS = [["", "pos.energyAll"], ["ESSENCE", "energy.ESSENCE"], ["DIESEL", "energy.DIESEL"], ["HYBRID", "energy.HYBRID"], ["ELECTRIC", "energy.ELECTRIC"]];

function SaleFlow({ car, onClose, onCreated }) {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const [client, setClient] = useState(null);
  const [newClient, setNewClient] = useState({});
  const [useExisting, setUseExisting] = useState(false);
  const [clientErrors, setClientErrors] = useState({});
  const [inspection, setInspection] = useState(DEFAULT_INSPECTION);

  // Reuse the saved checklist template (shared with purchases) so custom items persist.
  useEffect(() => {
    inspectionApi.getTemplate().then((tpl) => { if (tpl) setInspection(tpl); }).catch(() => {});
  }, []);
  const persistInspection = (next) => { inspectionApi.saveTemplate(next).catch(() => {}); };

  const basePriceDefault = car.purchase?.sellingPrice || 0;
  // "Prestation (Dépôt client)": the vehicle belongs to a client, so the sale is
  // split between the showroom (its share) and the owner (the rest, minus the
  // expenses engaged on the vehicle).
  const isClientCar = car.purchase?.sourceType === "CLIENT";
  const owner = car.purchase?.client || null;
  const carExpenses = (car.expenses || [])
    .filter((e) => e.type === "CAR" || !e.type)
    .reduce((a, e) => a + (Number(e.amount) || 0), 0);
  const [showroomShare, setShowroomShare] = useState("");
  const [saleType, setSaleType] = useState("NORMAL");
  const [basePrice, setBasePrice] = useState(String(basePriceDefault));
  const [tvaEnabled, setTvaEnabled] = useState(false);
  const [tvaRate, setTvaRate] = useState("19");
  const [reductionType, setReductionType] = useState("NONE");
  const [reductionValue, setReductionValue] = useState("");
  const [amountPaid, setAmountPaid] = useState("");
  const [paidTouched, setPaidTouched] = useState(false);
  const [clientTakeCar, setClientTakeCar] = useState(true);
  const [date, setDate] = useState(toDateTimeLocal());
  const [saving, setSaving] = useState(false);

  // live totals
  const base = Number(basePrice) || 0;
  const afterTax = tvaEnabled ? base * (1 + (Number(tvaRate) || 0) / 100) : base;
  let total = afterTax;
  if (reductionType === "PERCENT") total = afterTax * (1 - (Number(reductionValue) || 0) / 100);
  else if (reductionType === "FIXED") total = Math.max(0, afterTax - (Number(reductionValue) || 0));
  total = Math.round(total);
  const paid = paidTouched ? Number(amountPaid) || 0 : total;
  const rest = Math.max(0, total - paid);
  const share = Number(showroomShare) || 0;
  const ownerAmount = Math.max(0, total - share - carExpenses);

  const step1Valid = useExisting ? !!client : Object.keys(validateClient(newClient)).length === 0;

  const goStep2 = () => {
    if (!useExisting) {
      const errs = validateClient(newClient);
      if (Object.keys(errs).length) { setClientErrors(errs); return; }
    }
    setStep(1);
  };

  const finalize = async () => {
    setSaving(true);
    try {
      const payload = {
        carId: car.id,
        clientId: useExisting ? client?.id : null,
        client: useExisting ? null : newClient,
        saleType, basePrice: base, tvaEnabled, tvaRate, reductionType, reductionValue,
        amountPaid: paid, clientTakeCar, inspection, date,
        showroomShare: isClientCar ? share : 0,
      };
      const data = await salesApi.create(payload);
      onCreated(data);
    } catch (e) {
      alert(e.message || "Erreur lors de la vente");
    } finally {
      setSaving(false);
    }
  };

  const displayClient = useExisting ? client : newClient;

  return (
    <motion.div
      className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm overflow-y-auto p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    >
      <motion.div
        className="max-w-5xl mx-auto my-6 glass-panel p-6"
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="heading text-xl text-text-primary">{t("pos.saleTitle")} — {car.brand} {car.model}</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary"><X size={22} /></button>
        </div>

        <Stepper steps={[t("pos.stepClient"), t("pos.stepInspection"), t("pos.stepSummary")]} current={step} />

        {/* STEP 1 */}
        {step === 0 && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <button className={`chip ${!useExisting ? "chip-active" : ""}`} onClick={() => setUseExisting(false)}>{t("pos.newClient")}</button>
              <button className={`chip ${useExisting ? "chip-active" : ""}`} onClick={() => setUseExisting(true)}>{t("pos.existingClient")}</button>
            </div>

            {useExisting ? (
              client ? (
                <Card className="p-4 border border-emerald-500/40">
                  <div className="flex justify-between items-center">
                    <div><p className="heading text-sm text-text-primary">{client.firstName} {client.lastName}</p><p className="text-xs text-text-muted">{client.phonePrimary}</p></div>
                    <button className="btn-ghost text-xs py-1.5" onClick={() => setClient(null)}>{t("common.change")}</button>
                  </div>
                </Card>
              ) : (
                <SearchSelect fetcher={(q) => clientsApi.search(q)} placeholder={t("purchase.searchClient")} onSelect={setClient}
                  renderItem={(c) => <div><p className="text-sm text-text-primary">{c.firstName} {c.lastName}</p><p className="text-xs text-text-muted">{c.phonePrimary}</p></div>} />
              )
            ) : (
              <ClientForm value={newClient} onChange={setNewClient} errors={clientErrors} />
            )}

            <div className="flex justify-end pt-4">
              <button className="btn-primary" disabled={!step1Valid} onClick={goStep2}>{t("common.next")} →</button>
            </div>
          </div>
        )}

        {/* STEP 2 */}
        {step === 1 && (
          <div className="space-y-5">
            <InspectionChecklist value={inspection} onChange={setInspection} onPersist={persistInspection} />
            <div className="flex justify-between pt-4">
              <button className="btn-ghost" onClick={() => setStep(0)}>← {t("common.back")}</button>
              <button className="btn-primary" onClick={() => setStep(2)}>{t("common.next")} →</button>
            </div>
          </div>
        )}

        {/* STEP 3 */}
        {step === 2 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Vehicle summary */}
            <Card className="p-4">
              <h4 className="heading text-xs text-text-primary mb-3">{t("common.vehicle")}</h4>
              <div className="rounded-lg overflow-hidden mb-3"><CarImage images={car.images} heightClass="h-32" zoomable /></div>
              {[[t("car.brand"), car.brand], [t("car.model"), car.model], [t("car.year"), car.year], [t("car.plate"), car.plate], [t("car.color"), car.color], [t("car.energy"), ENERGY_LABELS[car.energy]], [t("car.gearbox"), GEARBOX_LABELS[car.gearbox]], [t("car.mileage"), car.mileage]].map(([k, v]) => (
                <div key={k} className="flex justify-between text-xs py-0.5"><span className="text-text-muted">{k}</span><span className="text-text-primary">{v ?? "—"}</span></div>
              ))}
            </Card>

            {/* Client summary */}
            <Card className="p-4">
              <h4 className="heading text-xs text-text-primary mb-3">{t("common.client")}</h4>
              {displayClient?.photo && <img src={displayClient.photo} className="w-16 h-16 rounded-xl object-cover mb-3" alt="" />}
              <p className="text-text-primary font-bold">{displayClient?.firstName} {displayClient?.lastName}</p>
              <p className="text-xs text-text-muted mb-2">{displayClient?.phonePrimary}</p>
              {displayClient?.address && <p className="text-xs text-text-muted">{displayClient.address}</p>}
              {displayClient?.docType && <p className="text-xs text-text-muted">{displayClient.docType} {displayClient.docNumber}</p>}
            </Card>

            {/* Pricing */}
            <Card className="p-4 space-y-3">
              <h4 className="heading text-xs text-text-primary">{t("purchase.pricing")}</h4>
              <div className="flex gap-2">
                <button className={`chip flex-1 ${saleType === "NORMAL" ? "chip-active" : ""}`} onClick={() => setSaleType("NORMAL")}>{t("pos.saleNormal")}</button>
                <button className={`chip flex-1 ${saleType === "DEPOSIT" ? "chip-active" : ""}`} onClick={() => setSaleType("DEPOSIT")}>{t("pos.saleDeposit")}</button>
              </div>
              <Field label={t("pos.basePrice")}><input className="input" type="number" value={basePrice} onChange={(e) => setBasePrice(e.target.value)} /></Field>

              <div className="flex items-center justify-between"><span className="label-caps !mb-0">{t("pos.tva")}</span><Toggle checked={tvaEnabled} onChange={setTvaEnabled} /></div>
              {tvaEnabled && <Field label={t("pos.tvaRate")}><input className="input" type="number" value={tvaRate} onChange={(e) => setTvaRate(e.target.value)} /></Field>}

              <div className="flex items-center justify-between"><span className="label-caps !mb-0">{t("pos.reduction")}</span><Toggle checked={reductionType !== "NONE"} onChange={(on) => setReductionType(on ? "PERCENT" : "NONE")} /></div>
              {reductionType !== "NONE" && (
                <>
                  <div className="flex gap-2">
                    <button className={`chip flex-1 ${reductionType === "PERCENT" ? "chip-active" : ""}`} onClick={() => setReductionType("PERCENT")}>{t("pos.percent")}</button>
                    <button className={`chip flex-1 ${reductionType === "FIXED" ? "chip-active" : ""}`} onClick={() => setReductionType("FIXED")}>{t("pos.fixed")}</button>
                  </div>
                  <Field label={t("pos.value")}><input className="input" type="number" value={reductionValue} onChange={(e) => setReductionValue(e.target.value)} /></Field>
                </>
              )}

              <div className="pt-2 border-t border-red-600/15">
                <div className="flex justify-between text-sm"><span className="text-text-muted">{t("pos.finalTotal")}</span><span className="text-2xl font-black text-emerald-400">{formatAmount(total)}</span></div>
              </div>
              <Field label={t("pos.amountPaid")}><input className="input" type="number" value={paidTouched ? amountPaid : total} onChange={(e) => { setPaidTouched(true); setAmountPaid(e.target.value); }} /></Field>
              <p className="text-sm">{t("common.rest")} : <span className={rest > 0 ? "text-rose-400 font-black" : "text-emerald-400 font-black"}>{formatAmount(rest)}</span></p>

              {/* Vehicle owned by a client: split the sale */}
              {isClientCar && (
                <div className="pt-3 mt-1 border-t border-amber-500/25 space-y-2.5">
                  <div className="flex items-center gap-2 text-amber-400">
                    <HandCoins size={15} />
                    <span className="label-caps !mb-0 !text-amber-400">{t("pos.clientCarTitle")}</span>
                  </div>
                  {owner && (
                    <p className="text-xs text-text-muted">
                      {t("pos.owner")} : <span className="text-text-primary font-bold">{owner.firstName} {owner.lastName}</span>
                    </p>
                  )}
                  <Field label={t("pos.showroomShare")}>
                    <input
                      className="input"
                      type="number"
                      value={showroomShare}
                      onChange={(e) => setShowroomShare(e.target.value)}
                      placeholder="0"
                    />
                  </Field>
                  <div className="text-xs space-y-1">
                    <div className="flex justify-between"><span className="text-text-muted">{t("sales.carExpenses")}</span><span className="text-amber-400 font-bold">- {formatAmount(carExpenses)}</span></div>
                    <div className="flex justify-between"><span className="text-text-muted">{t("pos.ownerAmount")}</span><span className="text-emerald-400 font-black">{formatAmount(ownerAmount)}</span></div>
                  </div>
                  <p className="text-[0.65rem] text-text-muted italic">{t("pos.settlementHint")}</p>
                </div>
              )}

              <div className="flex items-center justify-between"><span className="label-caps !mb-0">{t("pos.clientTakesCar")}</span><Toggle checked={clientTakeCar} onChange={setClientTakeCar} /></div>
              <Field label={t("common.datetime")}><DateInput withTime value={date} onChange={setDate} /></Field>
            </Card>

            <div className="lg:col-span-3 flex justify-between pt-2">
              <button className="btn-ghost" onClick={() => setStep(1)}>← {t("common.back")}</button>
              <button className="btn-primary" onClick={finalize} disabled={saving}>{saving ? "..." : t("pos.finalize")}</button>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

export default function POS() {
  const { t } = useTranslation();
  const can = useCan();
  const { refreshSettlements } = useStore();
  const toast = useToast();
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
              <CarImage images={car.images} heightClass="h-40" zoomable />
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
                  {can("pos", "create") && <button className="btn-primary w-full text-xs" onClick={() => setSelling(car)}>{t("pos.sell")}</button>}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <AnimatePresence>
        {selling && (
          <SaleFlow
            car={selling}
            onClose={() => setSelling(null)}
            onCreated={() => {
              setSelling(null);
              refetch();
              // A sale of a client vehicle raises the owner-settlement alert.
              refreshSettlements();
              toast(t("pos.finalizedToast"));
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
