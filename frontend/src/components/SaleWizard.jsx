import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { X, HandCoins, FileText, Receipt, Stamp } from "lucide-react";
import { salesApi, clientsApi, inspectionApi, proformasApi, computeSaleTotal } from "../lib/api.js";
import { useStore } from "../store/useStore.js";
import { Card, Field, Stepper, Toggle } from "./ui.jsx";
import SearchSelect from "./SearchSelect.jsx";
import ClientForm, { validateClient } from "./ClientForm.jsx";
import InspectionChecklist, { DEFAULT_INSPECTION, hasInspectionItems } from "./InspectionChecklist.jsx";
import { CarImage } from "./CarCard.jsx";
import PaymentMethodSelect from "./PaymentMethodSelect.jsx";
import { FactureDocument } from "./PrintDocs.jsx";
import { formatAmount, toDateTimeLocal, ENERGY_LABELS, GEARBOX_LABELS } from "../utils/format.js";
import DateInput from "./DateInput.jsx";

// Live, scaled-down preview of a printed document — the exact template that is
// printed, so what the user sees is what the client gets.
export function DocPreview({ children, maxHeight = 640 }) {
  const box = useRef(null);
  const [scale, setScale] = useState(0.6);
  useEffect(() => {
    const el = box.current;
    if (!el) return undefined;
    const SHEET_PX = 720; // 190mm at 96dpi
    const update = () => setScale(Math.min(1, (el.clientWidth - 24) / SHEET_PX));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={box} className="rounded-xl bg-neutral-200 p-3 overflow-hidden" style={{ maxHeight, overflowY: "auto" }}>
      <div style={{ width: 720 * scale, margin: "0 auto" }}>
        <div
          style={{
            width: 720, transform: `scale(${scale})`, transformOrigin: "top left",
            background: "#fff", boxShadow: "0 6px 24px rgba(0,0,0,.25)", padding: 18,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

// Same formula as the printed facture (FactureDocument): HT → TVA → réduction
// → timbre, plus the showroom part billed as a service of its own.
export function invoiceTotals({ basePrice, tvaEnabled, tvaRate, reductionType, reductionValue, stampEnabled, stampRate, showroomShare }) {
  const base = Number(basePrice) || 0;
  const rate = tvaEnabled ? Number(tvaRate) || 0 : 0;
  const tva = Math.round((base * rate) / 100);
  const total = computeSaleTotal({ basePrice: base, tvaEnabled, tvaRate, reductionType, reductionValue });
  const reduction = Math.max(0, base + tva - total);
  const sRate = stampEnabled ? Number(stampRate) || 0 : 0;
  const stamp = Math.round((total * sRate) / 100);
  const part = Math.max(0, Number(showroomShare) || 0);
  const partTva = Math.round((part * rate) / 100);
  const partTTC = part + partTva;
  return { base, rate, tva, total, reduction, sRate, stamp, part, partTva, partTTC, grandTotal: total + stamp + partTTC };
}

/**
 * Sale / proforma wizard used by the POS (and to edit a proforma).
 *   mode="sale"     → creates a real sale (the vehicle is sold / reserved)
 *   mode="proforma" → creates (or edits, with `proforma`) a facture proforma;
 *                     the vehicle stays available.
 * Steps are the same in both modes: client → inspection → pricing.
 */
export default function SaleWizard({ car, mode = "sale", proforma = null, onClose, onDone }) {
  const { t } = useTranslation();
  const { settings } = useStore();
  const isProforma = mode === "proforma";
  const editing = !!proforma;
  const [step, setStep] = useState(0);

  // ── client ────────────────────────────────────────────────────────────────
  const initialClient = proforma?.client?.id ? proforma.client : null;
  const [client, setClient] = useState(initialClient);
  const [newClient, setNewClient] = useState(
    proforma && !proforma.client?.id ? { clientType: "NORMAL", ...(proforma.client || {}) } : { clientType: "NORMAL" }
  );
  const [useExisting, setUseExisting] = useState(!!initialClient);
  const [clientErrors, setClientErrors] = useState({});

  // ── inspection ────────────────────────────────────────────────────────────
  const [inspection, setInspection] = useState(
    hasInspectionItems(proforma?.inspection) ? proforma.inspection : DEFAULT_INSPECTION
  );
  useEffect(() => {
    if (hasInspectionItems(proforma?.inspection)) return;
    inspectionApi.getTemplate().then((tpl) => { if (tpl) setInspection(tpl); }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const persistInspection = (next) => { inspectionApi.saveTemplate(next).catch(() => {}); };

  // ── pricing ───────────────────────────────────────────────────────────────
  const isClientCar = proforma ? proforma.isClientCar : car.purchase?.sourceType === "CLIENT";
  const owner = car.purchase?.client || null;
  const carExpenses = (Array.isArray(car.expenses) ? car.expenses : [])
    .filter((e) => e.type === "CAR" || !e.type)
    .reduce((a, e) => a + (Number(e.amount) || 0), 0);

  const [saleType, setSaleType] = useState("NORMAL");
  const [basePrice, setBasePrice] = useState(String(proforma ? proforma.totalBeforeTax : car.purchase?.sellingPrice || 0));
  const [tvaEnabled, setTvaEnabled] = useState(!!proforma?.tvaEnabled);
  const [tvaRate, setTvaRate] = useState(String(proforma?.tvaEnabled ? proforma.tvaRate : 19));
  const [reductionType, setReductionType] = useState(proforma?.reductionType || "NONE");
  const [reductionValue, setReductionValue] = useState(proforma?.reductionValue ? String(proforma.reductionValue) : "");
  const [stampEnabled, setStampEnabled] = useState(!!proforma?.stampEnabled);
  const [stampRate, setStampRate] = useState(String(proforma?.stampEnabled ? proforma.stampRate : 1));
  const [showroomShare, setShowroomShare] = useState(proforma?.showroomShare ? String(proforma.showroomShare) : "");
  const [paymentMethod, setPaymentMethod] = useState(proforma?.paymentMethod || "");
  const [amountPaid, setAmountPaid] = useState("");
  const [paidTouched, setPaidTouched] = useState(false);
  const [clientTakeCar, setClientTakeCar] = useState(true);
  const [date, setDate] = useState(toDateTimeLocal(proforma?.date));
  const [firstVersementDate, setFirstVersementDate] = useState(toDateTimeLocal());
  const [saving, setSaving] = useState(false);

  const pricing = { basePrice, tvaEnabled, tvaRate, reductionType, reductionValue, stampEnabled, stampRate, showroomShare: isClientCar ? showroomShare : 0 };
  const tot = invoiceTotals(pricing);
  const total = tot.total;
  const paid = paidTouched ? Number(amountPaid) || 0 : total;
  const rest = Math.max(0, total - paid);
  const ownerNet = total - tot.part - carExpenses;

  const step1Valid = useExisting ? !!client : Object.keys(validateClient(newClient)).length === 0;
  const goStep2 = () => {
    if (!useExisting) {
      const errs = validateClient(newClient);
      if (Object.keys(errs).length) { setClientErrors(errs); return; }
    }
    setStep(1);
  };

  const displayClient = useExisting ? client : newClient;

  // the record the printed proforma is built from (live preview)
  const previewSale = {
    car, client: displayClient || {},
    totalBeforeTax: tot.base, tvaEnabled, tvaRate: Number(tvaRate) || 0,
    totalAfterReduction: total, stampEnabled, stampRate: Number(stampRate) || 0,
    showroomShare: tot.part, paymentMethod, amountPaid: 0,
    date: date ? new Date(date).toISOString() : new Date().toISOString(),
  };

  const finalize = async () => {
    if (tot.base <= 0) { alert(t("proforma.priceRequired")); return; }
    setSaving(true);
    try {
      const common = {
        carId: car.id,
        car,
        clientId: useExisting ? client?.id : null,
        client: useExisting ? null : { clientType: "NORMAL", ...newClient },
        clientSnapshot: useExisting ? client : { clientType: "NORMAL", ...newClient },
        basePrice: tot.base, tvaEnabled, tvaRate: Number(tvaRate) || 0,
        reductionType, reductionValue: Number(reductionValue) || 0,
        stampEnabled, stampRate: Number(stampRate) || 0,
        showroomShare: tot.part,
        paymentMethod,
        inspection, date,
      };
      if (isProforma) {
        const data = editing
          ? await proformasApi.update(proforma.id, { ...common, carId: proforma.carId || car.id }, { local: proforma.local })
          : await proformasApi.create(common);
        onDone(data);
      } else {
        const data = await salesApi.create({
          ...common,
          saleType,
          amountPaid: paid,
          clientTakeCar,
          initialPaymentDate: rest > 0 && paid > 0 ? new Date(firstVersementDate).toISOString() : null,
        });
        onDone(data);
      }
    } catch (e) {
      alert(e.message || t("proforma.saveError"));
    } finally {
      setSaving(false);
    }
  };

  const title = isProforma
    ? `${editing ? t("proforma.editTitle") : t("proforma.createTitle")} — ${car.brand || ""} ${car.model || ""}`
    : `${t("pos.saleTitle")} — ${car.brand} ${car.model}`;

  const Line = ({ label, value, cls = "text-text-primary", strong }) => (
    <div className={`flex justify-between text-sm py-0.5 ${strong ? "font-black" : ""}`}>
      <span className="text-text-muted">{label}</span><span className={cls}>{value}</span>
    </div>
  );

  return (
    <motion.div
      className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm overflow-y-auto p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    >
      <motion.div
        className="max-w-6xl mx-auto my-6 glass-panel p-6"
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        <div className="flex items-center justify-between mb-6 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isProforma ? "bg-gradient-to-br from-amber-500 to-red-700" : "bg-gradient-to-br from-red-600 to-red-900"}`}>
              {isProforma ? <FileText size={18} className="text-white" /> : <Receipt size={18} className="text-white" />}
            </div>
            <div className="min-w-0">
              <h2 className="heading text-xl text-text-primary truncate">{title}</h2>
              {isProforma && <p className="text-xs text-amber-400">{t("proforma.notSoldHint")}</p>}
            </div>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary"><X size={22} /></button>
        </div>

        <Stepper steps={[t("pos.stepClient"), t("pos.stepInspection"), t("pos.stepSummary")]} current={step} />

        {/* STEP 1 — client */}
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
                <SearchSelect fetcher={(q) => clientsApi.search(q, "NORMAL")} placeholder={t("purchase.searchClient")} onSelect={setClient}
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

        {/* STEP 2 — inspection */}
        {step === 1 && (
          <div className="space-y-5">
            <InspectionChecklist value={inspection} onChange={setInspection} onPersist={persistInspection} />
            <div className="flex justify-between pt-4">
              <button className="btn-ghost" onClick={() => setStep(0)}>← {t("common.back")}</button>
              <button className="btn-primary" onClick={() => setStep(2)}>{t("common.next")} →</button>
            </div>
          </div>
        )}

        {/* STEP 3 — summary & pricing */}
        {step === 2 && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Vehicle */}
              <Card className="p-4">
                <h4 className="heading text-xs text-text-primary mb-3">{t("common.vehicle")}</h4>
                <div className="rounded-lg overflow-hidden mb-3"><CarImage images={car.images} heightClass="h-32" zoomable /></div>
                {[[t("car.brand"), car.brand], [t("car.model"), car.model], [t("car.year"), car.year], [t("car.plate"), car.plate], [t("car.color"), car.color], [t("car.energy"), ENERGY_LABELS[car.energy]], [t("car.gearbox"), GEARBOX_LABELS[car.gearbox]], [t("car.mileage"), car.mileage]].map(([k, v]) => (
                  <div key={k} className="flex justify-between text-xs py-0.5"><span className="text-text-muted">{k}</span><span className="text-text-primary">{v ?? "—"}</span></div>
                ))}
              </Card>

              {/* Client + recap */}
              <div className="space-y-5">
                <Card className="p-4">
                  <h4 className="heading text-xs text-text-primary mb-3">{t("common.client")}</h4>
                  {displayClient?.photo && <img src={displayClient.photo} className="w-16 h-16 rounded-xl object-cover mb-3" alt="" />}
                  <p className="text-text-primary font-bold">{displayClient?.firstName} {displayClient?.lastName}</p>
                  <p className="text-xs text-text-muted mb-2">{displayClient?.phonePrimary}</p>
                  {displayClient?.address && <p className="text-xs text-text-muted">{displayClient.address}</p>}
                  {displayClient?.docType && <p className="text-xs text-text-muted">{displayClient.docType} {displayClient.docNumber}</p>}
                </Card>

                <Card className="p-4 border border-red-600/25 bg-gradient-to-br from-red-950/30 via-black/30 to-black/10">
                  <h4 className="heading text-xs text-red-300 mb-2">{t("proforma.invoiceRecap")}</h4>
                  <Line label={t("proforma.totalHT")} value={formatAmount(tot.base)} />
                  {tot.rate > 0 && <Line label={`${t("pos.tva")} ${tot.rate}%`} value={formatAmount(tot.tva)} />}
                  {tot.reduction > 0 && <Line label={t("pos.reduction")} value={`- ${formatAmount(tot.reduction)}`} cls="text-amber-400" />}
                  {tot.sRate > 0 && <Line label={`${t("proforma.stamp")} ${tot.sRate}%`} value={formatAmount(tot.stamp)} />}
                  {tot.part > 0 && <Line label={t("proforma.showroomPartTTC")} value={formatAmount(tot.partTTC)} cls="text-red-300" />}
                  <div className="mt-2 pt-2 border-t border-red-600/25 flex justify-between items-center">
                    <span className="label-caps !mb-0 !text-red-300">{t("proforma.totalTTC")}</span>
                    <span className="text-2xl font-black text-emerald-400">{formatAmount(tot.grandTotal)}</span>
                  </div>
                  {isClientCar && (
                    <div className="mt-3 pt-2 border-t border-amber-500/25 space-y-0.5">
                      <Line label={t("pos.showroomShare")} value={formatAmount(tot.part)} cls="text-text-primary" />
                      <Line label={t("sales.carExpenses")} value={formatAmount(carExpenses)} cls="text-amber-400" />
                      <Line label={t("pos.ownerAmount")} value={formatAmount(ownerNet)} cls="text-emerald-400" strong />
                    </div>
                  )}
                </Card>
              </div>

              {/* Pricing controls */}
              <Card className="p-4 space-y-3">
                <h4 className="heading text-xs text-text-primary">{t("purchase.pricing")}</h4>
                {!isProforma && (
                  <div className="flex gap-2">
                    <button className={`chip flex-1 ${saleType === "NORMAL" ? "chip-active" : ""}`} onClick={() => setSaleType("NORMAL")}>{t("pos.saleNormal")}</button>
                    <button className={`chip flex-1 ${saleType === "DEPOSIT" ? "chip-active" : ""}`} onClick={() => setSaleType("DEPOSIT")}>{t("pos.saleDeposit")}</button>
                  </div>
                )}
                <Field label={t("pos.basePrice")}><input className="input" type="number" min="0" value={basePrice} onChange={(e) => setBasePrice(e.target.value)} /></Field>

                <div className="flex items-center justify-between"><span className="label-caps !mb-0">{t("pos.tva")}</span><Toggle checked={tvaEnabled} onChange={setTvaEnabled} /></div>
                {tvaEnabled && <Field label={t("pos.tvaRate")}><input className="input" type="number" min="0" value={tvaRate} onChange={(e) => setTvaRate(e.target.value)} /></Field>}

                <div className="flex items-center justify-between"><span className="label-caps !mb-0">{t("pos.reduction")}</span><Toggle checked={reductionType !== "NONE"} onChange={(on) => setReductionType(on ? "PERCENT" : "NONE")} /></div>
                {reductionType !== "NONE" && (
                  <>
                    <div className="flex gap-2">
                      <button className={`chip flex-1 ${reductionType === "PERCENT" ? "chip-active" : ""}`} onClick={() => setReductionType("PERCENT")}>{t("pos.percent")}</button>
                      <button className={`chip flex-1 ${reductionType === "FIXED" ? "chip-active" : ""}`} onClick={() => setReductionType("FIXED")}>{t("pos.fixed")}</button>
                    </div>
                    <Field label={t("pos.value")}><input className="input" type="number" min="0" value={reductionValue} onChange={(e) => setReductionValue(e.target.value)} /></Field>
                  </>
                )}

                <div className="flex items-center justify-between"><span className="label-caps !mb-0 flex items-center gap-1"><Stamp size={12} /> {t("proforma.stamp")}</span><Toggle checked={stampEnabled} onChange={setStampEnabled} /></div>
                {stampEnabled && <Field label={t("proforma.stampRate")}><input className="input" type="number" min="0" step="0.1" value={stampRate} onChange={(e) => setStampRate(e.target.value)} /></Field>}

                {/* Vehicle left by a client: the showroom part is set here. */}
                {isClientCar && (
                  <div className="pt-3 mt-1 border-t border-amber-500/25 space-y-2">
                    <div className="flex items-center gap-2 text-amber-400">
                      <HandCoins size={15} />
                      <span className="label-caps !mb-0 !text-amber-400">{t("pos.clientCarTitle")}</span>
                    </div>
                    {owner && (
                      <p className="text-xs text-text-muted">{t("pos.owner")} : <span className="text-text-primary font-bold">{owner.firstName} {owner.lastName}</span></p>
                    )}
                    <Field label={t("pos.showroomShare")}><input className="input" type="number" min="0" placeholder="0" value={showroomShare} onChange={(e) => setShowroomShare(e.target.value)} /></Field>
                    <p className="text-[0.65rem] text-text-muted italic">{t("proforma.shareHint")}</p>
                  </div>
                )}

                <Field label={t("proforma.paymentMethod")}><PaymentMethodSelect value={paymentMethod} onChange={setPaymentMethod} /></Field>

                {!isProforma && (
                  <>
                    <div className="pt-2 border-t border-red-600/15">
                      <div className="flex justify-between text-sm"><span className="text-text-muted">{t("pos.finalTotal")}</span><span className="text-xl font-black text-emerald-400">{formatAmount(total)}</span></div>
                    </div>
                    <Field label={t("pos.amountPaid")}><input className="input" type="number" min="0" value={paidTouched ? amountPaid : total} onChange={(e) => { setPaidTouched(true); setAmountPaid(e.target.value); }} /></Field>
                    <p className="text-sm">{t("common.rest")} : <span className={rest > 0 ? "text-rose-400 font-black" : "text-emerald-400 font-black"}>{formatAmount(rest)}</span></p>
                    {rest > 0 && paid > 0 && (
                      <div className="pt-3 mt-1 border-t border-rose-500/25 space-y-2">
                        <div className="flex items-center gap-2 text-rose-400">
                          <HandCoins size={15} />
                          <span className="label-caps !mb-0 !text-rose-400">{t("pos.firstVersement")}</span>
                        </div>
                        <Field label={t("pos.firstVersementDate")}><DateInput withTime value={firstVersementDate} onChange={setFirstVersementDate} /></Field>
                        <p className="text-[0.65rem] text-text-muted italic">{t("pos.firstVersementHint")}</p>
                      </div>
                    )}
                    <div className="flex items-center justify-between"><span className="label-caps !mb-0">{t("pos.clientTakesCar")}</span><Toggle checked={clientTakeCar} onChange={setClientTakeCar} /></div>
                  </>
                )}
                <Field label={t("common.datetime")}><DateInput withTime value={date} onChange={setDate} /></Field>
              </Card>
            </div>

            {/* The printed proforma, live */}
            {isProforma && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <FileText size={15} className="text-red-400" />
                  <span className="heading text-xs text-text-primary">{t("proforma.preview")}</span>
                </div>
                <DocPreview>
                  <FactureDocument sale={previewSale} showroom={settings} lang="fr" proforma invoiceNumber={proforma?.reference || "PRO-…"} />
                </DocPreview>
              </div>
            )}

            <div className="flex justify-between pt-2">
              <button className="btn-ghost" onClick={() => setStep(1)}>← {t("common.back")}</button>
              <button className="btn-primary" onClick={finalize} disabled={saving}>
                {saving ? "..." : isProforma ? (editing ? t("proforma.saveChanges") : t("proforma.create")) : t("pos.finalize")}
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
