import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Eye, Pencil, Trash2, Printer, LayoutGrid, Table as TableIcon, TrendingUp, X, UserCog, Mail, Receipt, FileText, Banknote, ArrowRightLeft, Send, HandCoins, History, AlertTriangle } from "lucide-react";
import { salesApi, clientsApi, carsApi, inspectionApi } from "../lib/api.js";
import { useFetch } from "../hooks/useApi.js";
import { useCan } from "../lib/permissions.js";
import { useStore } from "../store/useStore.js";
import { Card, Badge, Modal, ConfirmModal, Field, EmptyState, SkeletonGrid, Stepper, Toggle, AnimatedGrid, useToast } from "../components/ui.jsx";
import PageHeader from "../components/PageHeader.jsx";
import ActionMenu from "../components/ActionMenu.jsx";
import SearchSelect from "../components/SearchSelect.jsx";
import ClientForm, { validateClient } from "../components/ClientForm.jsx";
import InspectionChecklist, { DEFAULT_INSPECTION, hasInspectionItems } from "../components/InspectionChecklist.jsx";
import { CarImage } from "../components/CarCard.jsx";
import { SaleInvoice } from "../components/PrintTemplates.jsx";
import { BonEntreeSortie, FactureDocument, VersementStatement } from "../components/PrintDocs.jsx";
import { usePrintDialog, printInLang } from "../components/PrintChooser.jsx";
import PrintHub, { DocPicker } from "../components/PrintHub.jsx";
import { renderDocsToHtml, documentLabels, sendDocumentsEmail } from "../lib/email.js";
import { formatAmount, formatDate, initials, toDateTimeLocal, ENERGY_LABELS, GEARBOX_LABELS } from "../utils/format.js";
import DateInput from "../components/DateInput.jsx";

const FILTERS = [
  { key: "", tkey: "reservations.filterAll" },
  { key: "saleType=NORMAL", tkey: "sales.filterNormal" },
  { key: "saleType=DEPOSIT", tkey: "sales.filterDeposit" },
  { key: "paid=PAID", tkey: "sales.filterPaid" },
  { key: "paid=DEBT", tkey: "sales.filterDebt" },
];

// Full edit wizard for an existing sale — mirrors the POS creation flow
// (client → inspection → pricing) so every detail captured at sale time can be
// reviewed and corrected here. Saving is available from any step.
function SaleEditForm({ sale, onClose, onSaved }) {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);

  // client — either swapped for another existing one, or edited in place
  const [client, setClient] = useState(sale.client || null);
  const [clientDraft, setClientDraft] = useState(sale.client ? { ...sale.client } : {});
  const [clientDirty, setClientDirty] = useState(false);
  const [editingClient, setEditingClient] = useState(false);
  const [clientErrors, setClientErrors] = useState({});

  // inspection — an empty stored checklist falls back to the shared template
  const [inspection, setInspection] = useState(
    hasInspectionItems(sale.inspection) ? sale.inspection : DEFAULT_INSPECTION
  );
  useEffect(() => {
    if (hasInspectionItems(sale.inspection)) return;
    inspectionApi.getTemplate().then((tpl) => { if (hasInspectionItems(tpl)) setInspection(tpl); }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const persistInspection = (next) => { inspectionApi.saveTemplate(next).catch(() => {}); };

  // pricing
  const [saleType, setSaleType] = useState(sale.saleType || "NORMAL");
  const [basePrice, setBasePrice] = useState(String(sale.totalBeforeTax ?? ""));
  const [tvaEnabled, setTvaEnabled] = useState(!!sale.tvaEnabled);
  const [tvaRate, setTvaRate] = useState(String(sale.tvaRate ?? "19"));
  const [reductionType, setReductionType] = useState(sale.reductionType || "NONE");
  const [reductionValue, setReductionValue] = useState(String(sale.reductionValue ?? ""));
  const [amountPaid, setAmountPaid] = useState(String(sale.amountPaid ?? ""));
  const [clientTakeCar, setClientTakeCar] = useState(sale.clientTakeCar !== false);
  const [date, setDate] = useState(toDateTimeLocal(sale.date));
  const [saving, setSaving] = useState(false);

  // live totals — the same formula the API applies when it writes the row
  const base = Number(basePrice) || 0;
  const afterTax = tvaEnabled ? base * (1 + (Number(tvaRate) || 0) / 100) : base;
  let total = afterTax;
  if (reductionType === "PERCENT") total = afterTax * (1 - (Number(reductionValue) || 0) / 100);
  else if (reductionType === "FIXED") total = Math.max(0, afterTax - (Number(reductionValue) || 0));
  total = Math.round(total);
  const paid = Number(amountPaid) || 0;
  const rest = Math.max(0, total - paid);
  const gain = total - (Number(sale.purchasePrice) || 0) - (Number(sale.carExpenses) || 0);

  const car = sale.car || {};

  const pickClient = (c) => {
    setClient(c);
    setClientDraft({ ...c });
    setClientDirty(false);
    setEditingClient(false);
    setClientErrors({});
  };

  const save = async () => {
    // Client edits are validated before anything is written so a bad form never
    // leaves a half-applied update behind.
    if (clientDirty && client?.id) {
      const errs = validateClient(clientDraft);
      if (Object.keys(errs).length) { setClientErrors(errs); setEditingClient(true); setStep(0); return; }
    }
    setSaving(true);
    try {
      if (clientDirty && client?.id) {
        await clientsApi.update(client.id, clientDraft);
        setClientDirty(false);
      }
      const data = await salesApi.update(sale.id, {
        clientId: client?.id ?? null,
        saleType,
        basePrice: base,
        tvaEnabled,
        tvaRate,
        reductionType,
        reductionValue,
        amountPaid: paid,
        clientTakeCar,
        inspection,
        date,
      });
      onSaved(data);
    } catch (e) {
      alert(e.message || "Erreur lors de la mise à jour de la vente");
    } finally {
      setSaving(false);
    }
  };

  const saveButton = (
    <button className="btn-primary" onClick={save} disabled={saving}>
      {saving ? "..." : t("sales.saveChanges")}
    </button>
  );

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
          <h2 className="heading text-xl text-text-primary">{t("sales.edit")} — {sale.reference}</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary"><X size={22} /></button>
        </div>

        <Stepper
          steps={[t("pos.stepClient"), t("pos.stepInspection"), t("pos.stepSummary")]}
          current={step}
          onStepClick={setStep}
        />

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
          >

        {/* STEP 1 — client */}
        {step === 0 && (
          <div className="space-y-4">
            {client ? (
              <Card className="p-4 border border-emerald-500/40">
                <div className="flex justify-between items-center gap-3">
                  <div className="min-w-0">
                    <p className="heading text-sm text-text-primary truncate">{client.firstName} {client.lastName}</p>
                    <p className="text-xs text-text-muted truncate">{client.phonePrimary}{client.address ? ` · ${client.address}` : ""}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button className="btn-ghost text-xs py-1.5" onClick={() => setEditingClient((e) => !e)}><UserCog size={13} /> {t("sales.editClientInfo")}</button>
                    <button className="btn-ghost text-xs py-1.5" onClick={() => { setClient(null); setEditingClient(false); }}>{t("common.change")}</button>
                  </div>
                </div>
              </Card>
            ) : (
              <>
                <p className="text-xs text-text-muted italic">{t("sales.pickClient")}</p>
                <SearchSelect
                  fetcher={(q) => clientsApi.search(q)}
                  placeholder={t("purchase.searchClient")}
                  onSelect={pickClient}
                  renderItem={(c) => <div><p className="text-sm text-text-primary">{c.firstName} {c.lastName}</p><p className="text-xs text-text-muted">{c.phonePrimary}</p></div>}
                />
              </>
            )}

            {client && editingClient && (
              <Card className="p-4">
                <ClientForm value={clientDraft} onChange={(v) => { setClientDraft(v); setClientDirty(true); }} errors={clientErrors} />
              </Card>
            )}

            <div className="flex justify-end gap-2 pt-4">
              {saveButton}
              <button className="btn-primary" onClick={() => setStep(1)}>{t("common.next")} →</button>
            </div>
          </div>
        )}

        {/* STEP 2 — inspection */}
        {step === 1 && (
          <div className="space-y-5">
            <InspectionChecklist value={inspection} onChange={setInspection} onPersist={persistInspection} />
            <div className="flex justify-between gap-2 pt-4">
              <button className="btn-ghost" onClick={() => setStep(0)}>← {t("common.back")}</button>
              <div className="flex gap-2">
                {saveButton}
                <button className="btn-primary" onClick={() => setStep(2)}>{t("common.next")} →</button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3 — vehicle / client recap + pricing */}
        {step === 2 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <Card className="p-4">
              <h4 className="heading text-xs text-text-primary mb-3">{t("common.vehicle")}</h4>
              <div className="rounded-lg overflow-hidden mb-3"><CarImage images={car.images} heightClass="h-32" zoomable /></div>
              {[[t("car.brand"), car.brand], [t("car.model"), car.model], [t("car.year"), car.year], [t("car.plate"), car.plate], [t("car.color"), car.color], [t("car.energy"), ENERGY_LABELS[car.energy]], [t("car.gearbox"), GEARBOX_LABELS[car.gearbox]], [t("car.mileage"), car.mileage]].map(([k, v]) => (
                <div key={k} className="flex justify-between text-xs py-0.5"><span className="text-text-muted">{k}</span><span className="text-text-primary">{v ?? "—"}</span></div>
              ))}
            </Card>

            <Card className="p-4">
              <h4 className="heading text-xs text-text-primary mb-3">{t("common.client")}</h4>
              {clientDraft?.photo && <img src={clientDraft.photo} className="w-16 h-16 rounded-xl object-cover mb-3" alt="" />}
              <p className="text-text-primary font-bold">{clientDraft?.firstName} {clientDraft?.lastName}</p>
              <p className="text-xs text-text-muted mb-2">{clientDraft?.phonePrimary}</p>
              {clientDraft?.address && <p className="text-xs text-text-muted">{clientDraft.address}</p>}
              {clientDraft?.docType && <p className="text-xs text-text-muted">{clientDraft.docType} {clientDraft.docNumber}</p>}
              <button className="btn-ghost text-xs w-full mt-3" onClick={() => { setEditingClient(true); setStep(0); }}><UserCog size={13} /> {t("sales.editClientInfo")}</button>
            </Card>

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
              <Field label={t("pos.amountPaid")}><input className="input" type="number" value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} /></Field>
              <p className="text-sm">{t("common.rest")} : <span className={rest > 0 ? "text-rose-400 font-black" : "text-emerald-400 font-black"}>{formatAmount(rest)}</span></p>

              <div className="flex items-center justify-between"><span className="label-caps !mb-0">{t("pos.clientTakesCar")}</span><Toggle checked={clientTakeCar} onChange={setClientTakeCar} /></div>
              <Field label={t("common.datetime")}><DateInput withTime value={date} onChange={setDate} /></Field>
            </Card>

            <div className="lg:col-span-3 flex justify-between pt-2">
              <button className="btn-ghost" onClick={() => setStep(1)}>← {t("common.back")}</button>
              {saveButton}
            </div>
          </div>
        )}
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

// Ordinal (versement number) helper — payments oldest first.
function orderVersements(list) {
  return (list || []).slice().sort(
    (a, b) => new Date(a.date) - new Date(b.date) || (a.id || 0) - (b.id || 0)
  );
}

/* ---------------------------------------------------------------------------
 * Créer un versement — records a new installment on a sale. Shows the sale
 * total and everything already paid, then computes the remaining balance live
 * as the user types the amount of this versement.
 * ------------------------------------------------------------------------- */
function VersementForm({ sale, onClose, onCreated }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(toDateTimeLocal());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    salesApi
      .versements(sale.id)
      .then(setData)
      .catch(() =>
        setData({ total: sale.totalAfterReduction || 0, paid: sale.amountPaid || 0, rest: sale.amountRest || 0, list: [] })
      );
  }, [sale.id]);

  const total = data?.total ?? sale.totalAfterReduction ?? 0;
  const paidBefore = data?.paid ?? sale.amountPaid ?? 0;
  const thisAmount = Number(amount) || 0;
  const restAfter = Math.max(0, total - paidBefore - thisAmount);

  const submit = async () => {
    if (thisAmount <= 0) { toast(t("versements.amountRequired"), "error"); return; }
    setSaving(true);
    try {
      await salesApi.addVersement(sale.id, sale.carId, {
        amount: thisAmount, description, date: new Date(date).toISOString(),
      });
      const fresh = await salesApi.versements(sale.id);
      toast(t("versements.createdToast"));
      onCreated(fresh);
    } catch (e) {
      alert(e.message || t("common.error"));
    } finally {
      setSaving(false);
    }
  };

  const car = sale.car || {};

  return (
    <Modal
      open
      onClose={onClose}
      title={t("versements.newTitle")}
      size="md"
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>{t("common.cancel")}</button>
          <button className="btn-primary" onClick={submit} disabled={saving || thisAmount <= 0}>
            {saving ? "..." : <><HandCoins size={14} /> {t("versements.create")}</>}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3 glass-card p-3 !rounded-xl">
          <div className="w-20 h-14 rounded-lg overflow-hidden shrink-0"><CarImage images={car.images} heightClass="h-14" fit="cover" /></div>
          <div className="min-w-0 flex-1">
            <p className="heading text-sm text-text-primary truncate">{car.brand} {car.model}</p>
            <p className="text-xs text-text-muted truncate">{sale.reference} · {sale.client?.firstName} {sale.client?.lastName}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          <Card className="p-3"><p className="label-caps">{t("versements.saleTotal")}</p><p className="text-base font-black text-text-primary">{formatAmount(total)}</p></Card>
          <Card className="p-3"><p className="label-caps">{t("versements.alreadyPaid")}</p><p className="text-base font-black text-emerald-400">{formatAmount(paidBefore)}</p></Card>
          <Card className="p-3 border border-rose-500/40"><p className="label-caps">{t("versements.currentRest")}</p><p className="text-base font-black text-rose-400">{formatAmount(Math.max(0, total - paidBefore))}</p></Card>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label={t("versements.thisVersement")} required>
            <input className="input" type="number" autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
          </Field>
          <Field label={t("common.datetime")}>
            <DateInput withTime value={date} onChange={setDate} />
          </Field>
        </div>

        <div className="flex justify-between items-center px-1">
          <span className="label-caps !mb-0">{t("versements.restAfter")}</span>
          <span className={`text-lg font-black ${restAfter > 0 ? "text-rose-400" : "text-emerald-400"}`}>{formatAmount(restAfter)}</span>
        </div>

        <Field label={`${t("versements.observation")} (${t("common.optional")})`}>
          <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("versements.observationHint")} />
        </Field>
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------------------------
 * Historique des versements — every installment of a sale, each with edit /
 * delete / print, plus a "print all" (full statement) button. All prints use
 * the same "Versements" statement template (FR / AR chosen at print time).
 * ------------------------------------------------------------------------- */
function VersementHistory({ sale, showroom, onClose, onChanged }) {
  const { t } = useTranslation();
  const toast = useToast();
  const openPrint = usePrintDialog();
  const [data, setData] = useState(null);
  const [edit, setEdit] = useState(null);
  const [deleteId, setDeleteId] = useState(null);

  const load = () =>
    salesApi.versements(sale.id).then(setData).catch(() => setData({ total: 0, paid: 0, rest: 0, list: [] }));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [sale.id]);

  const list = orderVersements(data?.list);
  const printOne = (p) =>
    openPrint((lang) => <VersementStatement sale={sale} showroom={showroom} lang={lang} payments={list} highlightId={p.id} />);
  const printAll = () =>
    openPrint((lang) => <VersementStatement sale={sale} showroom={showroom} lang={lang} payments={list} />);

  const saveEdit = async () => {
    try {
      await salesApi.updateVersement(edit.id, {
        amount: Number(edit.amount) || 0, description: edit.description, date: new Date(edit.date).toISOString(),
      });
      setEdit(null); await load(); onChanged?.();
      toast(t("versements.updatedToast"));
    } catch (e) { alert(e.message || t("common.error")); }
  };
  const confirmDelete = async () => {
    try {
      await salesApi.deleteVersement(deleteId);
      setDeleteId(null); await load(); onChanged?.();
      toast(t("versements.deletedToast"), "info");
    } catch (e) { alert(e.message || t("common.error")); }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`${t("versements.historyTitle")} — ${sale.reference}`}
      size="lg"
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>{t("common.close")}</button>
          <button className="btn-primary" onClick={printAll} disabled={!list.length}>
            <Printer size={14} /> {t("versements.printAll")}
          </button>
        </>
      }
    >
      {!data ? (
        <p className="text-text-muted text-center py-6">{t("common.loading")}</p>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2.5">
            <Card className="p-3"><p className="label-caps">{t("versements.saleTotal")}</p><p className="text-base font-black text-text-primary">{formatAmount(data.total)}</p></Card>
            <Card className="p-3"><p className="label-caps">{t("versements.totalPaid")}</p><p className="text-base font-black text-emerald-400">{formatAmount(data.paid)}</p></Card>
            <Card className="p-3 border border-rose-500/40"><p className="label-caps">{t("versements.restToPay")}</p><p className="text-base font-black text-rose-400">{formatAmount(data.rest)}</p></Card>
          </div>

          {list.length === 0 ? (
            <p className="text-text-muted text-sm text-center py-4">{t("versements.none")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="text-left rtl:text-right bg-red-600/10 border-b border-red-600/30">
                    {["N°", t("versements.bonNo"), t("common.amount"), t("common.rest"), t("common.date"), t("versements.observation"), ""].map((h, i) => (
                      <th key={i} className="p-2.5 label-caps !text-red-300/80">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {list.map((p, i) => (
                    <tr key={p.id} className={`border-b border-red-600/10 ${i % 2 ? "bg-white/[0.015]" : ""}`}>
                      <td className="p-2.5 font-mono text-xs text-text-muted">{p.id}{p.isInitial ? ` · ${t("versements.initial")}` : ""}</td>
                      <td className="p-2.5 font-mono text-xs text-text-muted">{sale.id}</td>
                      <td className="p-2.5 text-emerald-400 font-bold">{formatAmount(p.amount)}</td>
                      <td className="p-2.5 text-rose-400">{formatAmount(p.restAfter)}</td>
                      <td className="p-2.5 text-text-muted whitespace-nowrap">{formatDate(p.date)}</td>
                      <td className="p-2.5 text-text-muted">{p.description || "—"}</td>
                      <td className="p-2.5">
                        <ActionMenu items={[
                          { label: t("common.print"), icon: Printer, onClick: () => printOne(p) },
                          { label: t("common.edit"), icon: Pencil, onClick: () => setEdit({ ...p, date: toDateTimeLocal(p.date) }) },
                          { label: t("common.delete"), icon: Trash2, danger: true, onClick: () => setDeleteId(p.id) },
                        ]} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Edit one versement */}
      <Modal open={!!edit} onClose={() => setEdit(null)} title={t("versements.edit")} size="sm"
        footer={<><button className="btn-ghost" onClick={() => setEdit(null)}>{t("common.cancel")}</button><button className="btn-primary" onClick={saveEdit}>{t("common.save")}</button></>}>
        {edit && (
          <div className="space-y-4">
            <Field label={t("common.amount")}><input className="input" type="number" value={edit.amount} onChange={(e) => setEdit({ ...edit, amount: e.target.value })} /></Field>
            <Field label={t("common.datetime")}><DateInput withTime value={edit.date} onChange={(v) => setEdit({ ...edit, date: v })} /></Field>
            <Field label={t("versements.observation")}><input className="input" value={edit.description || ""} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></Field>
          </div>
        )}
      </Modal>

      <ConfirmModal open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={confirmDelete} message={t("versements.deleteMsg")} />
    </Modal>
  );
}

export default function Sales() {
  const { t } = useTranslation();
  const can = useCan();
  const { settings, refreshSettlements } = useStore();
  const toast = useToast();
  const [filter, setFilter] = useState("");
  const [search, setSearch] = useState("");
  const [view, setView] = useState("cards");
  const { data: sales, loading, refetch } = useFetch(() => {
    const params = { search };
    if (filter.startsWith("saleType=")) params.saleType = filter.split("=")[1];
    if (filter.startsWith("paid=")) params.paid = filter.split("=")[1];
    return salesApi.list(params);
  }, [filter, search]);
  const [viewItem, setViewItem] = useState(null);
  const [versementTarget, setVersementTarget] = useState(null); // create a versement
  const [historyTarget, setHistoryTarget] = useState(null);     // versements history
  const [versementPrompt, setVersementPrompt] = useState(null); // { sale, list } → print prompt
  const [editItem, setEditItem] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [printTarget, setPrintTarget] = useState(null);
  const [printPayments, setPrintPayments] = useState([]);
  const [mailTarget, setMailTarget] = useState(null);
  const [mailPayments, setMailPayments] = useState([]);

  const { data: docTypeRows } = useFetch(() => carsApi.getDocumentTypes(), []);
  const docTypeNames = (docTypeRows || []).map((d) => d.name);

  // Every printable document of a sale. The same list feeds the "Impressions"
  // hub and the "Envoyer par email" picker. `payments` are the sale's versements,
  // needed by the "Versements" statement (prefetched when a hub/email opens).
  const saleDocs = (sale, payments = []) => {
    if (!sale) return [];
    return [
      {
        key: "facture-finale",
        label: t("print.factureFinale"),
        desc: t("print.factureFinaleDesc"),
        icon: Receipt,
        render: (lang) => <FactureDocument sale={sale} showroom={settings} lang={lang} />,
      },
      {
        key: "facture-proforma",
        label: t("print.factureProforma"),
        desc: t("print.factureProformaDesc"),
        icon: FileText,
        render: (lang) => <FactureDocument sale={sale} showroom={settings} lang={lang} proforma />,
      },
      {
        key: "bon-versement",
        label: t("print.bonVersement"),
        desc: t("print.bonVersementDesc"),
        icon: Banknote,
        render: (lang) => <VersementStatement sale={sale} showroom={settings} lang={lang} payments={payments} />,
      },
      {
        key: "bon-entree-sortie",
        label: t("print.bonEntreeSortie"),
        desc: t("print.bonEntreeSortieDesc"),
        icon: ArrowRightLeft,
        options: [{ name: "dateTime", label: t("print.dateTime"), type: "datetime", default: toDateTimeLocal(sale.date) }],
        render: (lang, o) => (
          <BonEntreeSortie sale={sale} showroom={settings} lang={lang} dateTime={o.dateTime} docTypes={docTypeNames} />
        ),
      },
      {
        key: "facture-vente",
        label: t("print.saleInvoice"),
        desc: t("print.saleInvoiceDesc"),
        icon: Printer,
        render: (lang) => <SaleInvoice sale={sale} showroom={settings} lang={lang} />,
      },
    ];
  };

  // Open the Impressions hub / the email modal, prefetching the sale's
  // versements so the "Versements" statement can be printed / emailed.
  const openPrintHub = async (s) => {
    setPrintTarget(s); setPrintPayments([]);
    try { const v = await salesApi.versements(s.id); setPrintPayments(v.list); } catch { setPrintPayments([]); }
  };
  const openMail = async (s) => {
    setMailTarget(s); setMailPayments([]);
    try { const v = await salesApi.versements(s.id); setMailPayments(v.list); } catch { setMailPayments([]); }
  };

  const confirmDelete = async () => {
    await salesApi.delete(deleteId);
    setDeleteId(null); refetch();
    refreshSettlements();
    toast(t("sales.deletedToast"), "info");
  };

  const menuItems = (s) => [
    { label: t("common.view"), icon: Eye, onClick: () => setViewItem(s) },
    can("sales", "edit") && { label: t("common.edit"), icon: Pencil, onClick: () => setEditItem(s) },
    (can("sales", "edit") || can("payments", "create")) && s.amountRest > 0 && { label: t("versements.create"), icon: HandCoins, onClick: () => setVersementTarget(s) },
    { label: t("versements.historyTitle"), icon: History, onClick: () => setHistoryTarget(s) },
    can("sales", "print") && { label: t("print.printings"), icon: Printer, onClick: () => openPrintHub(s) },
    can("sales", "print") && { label: t("email.action"), icon: Mail, onClick: () => openMail(s) },
    can("sales", "delete") && { label: t("common.delete"), icon: Trash2, danger: true, onClick: () => setDeleteId(s.id) },
  ];

  const debtSales = (sales || []).filter((s) => s.amountRest > 0);
  const debtTotal = debtSales.reduce((a, s) => a + (s.amountRest || 0), 0);

  return (
    <div>
      <PageHeader title={t("nav.sales")} />

      {/* Global debt alert */}
      {debtSales.length > 0 && (
        <Card className="p-4 mb-5 border border-rose-500/40 bg-rose-500/5">
          <div className="flex items-start gap-3">
            <span className="p-2 rounded-xl bg-rose-500/15 text-rose-400 shrink-0"><AlertTriangle size={20} /></span>
            <div className="flex-1 min-w-0">
              <p className="heading text-sm text-rose-400">{t("sales.debtAlertTitle")}</p>
              <p className="text-xs text-text-muted mt-0.5">{t("sales.debtAlertDesc", { count: debtSales.length, total: formatAmount(debtTotal) })}</p>
            </div>
            {filter !== "paid=DEBT" && (
              <button className="btn-ghost text-xs py-1.5 shrink-0" onClick={() => setFilter("paid=DEBT")}>{t("sales.filterDebt")}</button>
            )}
          </div>
        </Card>
      )}

      <div className="flex flex-col sm:flex-row gap-3 mb-6 items-start">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => <button key={f.key} className={`chip ${filter === f.key ? "chip-active" : ""}`} onClick={() => setFilter(f.key)}>{t(f.tkey)}</button>)}
        </div>
        <input className="input sm:max-w-xs sm:ml-auto rtl:sm:ml-0 rtl:sm:mr-auto" placeholder={t("sales.searchPlaceholder")} value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="flex gap-1">
          <button className={`chip ${view === "cards" ? "chip-active" : ""}`} onClick={() => setView("cards")}><LayoutGrid size={14} /></button>
          <button className={`chip ${view === "table" ? "chip-active" : ""}`} onClick={() => setView("table")}><TableIcon size={14} /></button>
        </div>
      </div>

      {loading ? <SkeletonGrid /> : sales?.length === 0 ? (
        <EmptyState message={t("sales.noSales")} />
      ) : view === "cards" ? (
        <AnimatedGrid className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {sales.map((s) => (
            <Card key={s.id} className={`p-4 flex gap-4 ${s.amountRest > 0 ? "border border-rose-500/40" : ""}`}>
              <div className="w-24 h-[72px] rounded-lg overflow-hidden shrink-0"><CarImage images={s.car?.images} heightClass="h-[72px]" fit="cover" /></div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="heading text-sm text-text-primary">{s.client?.firstName} {s.client?.lastName}</p>
                    <p className="text-xs text-text-muted">{s.reference} · {formatDate(s.date)}</p>
                  </div>
                  <ActionMenu items={menuItems(s)} />
                </div>
                <p className="text-xs text-text-muted my-1">{s.car?.brand} {s.car?.model} · {s.car?.plate}</p>
                <div className="flex items-center justify-between gap-1.5 mb-1.5 flex-wrap">
                  <div className="flex gap-1.5">
                    <Badge color={s.saleType === "DEPOSIT" ? "warning" : "success"}>{s.saleType === "DEPOSIT" ? t("sales.deposit") : t("sales.normal")}</Badge>
                    {s.amountRest > 0 ? <Badge color="debt"><AlertTriangle size={10} /> {t("sales.debt")}</Badge> : <Badge color="success">{t("sales.paid")}</Badge>}
                  </div>
                  {s.hasPurchaseInfo ? (
                    <div className={`px-2.5 py-0.5 rounded-full text-xs font-bold flex items-center gap-1 border shadow-sm ${
                      s.gain >= 0
                        ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                        : "bg-rose-500/15 text-rose-400 border-rose-500/30"
                    }`}>
                      <TrendingUp size={13} className={s.gain < 0 ? "rotate-180 text-rose-400" : "text-emerald-400"} />
                      <span>{t("sales.gain")}: {s.gain >= 0 ? "+" : ""}{formatAmount(s.gain)}</span>
                    </div>
                  ) : (
                    <div className="px-2 py-0.5 rounded-full text-xs text-text-muted bg-white/5 border border-white/10">
                      {t("sales.gain")}: —
                    </div>
                  )}
                </div>
                <div className="flex justify-between text-sm pt-1 border-t border-red-600/10">
                  <span className="text-text-primary font-bold">{formatAmount(s.totalAfterReduction)}</span>
                  <span>
                    <span className="text-emerald-400">{formatAmount(s.amountPaid)}</span>
                    {s.amountRest > 0 && <span className="text-rose-400"> · {formatAmount(s.amountRest)}</span>}
                  </span>
                </div>
              </div>
            </Card>
          ))}
        </AnimatedGrid>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left rtl:text-right bg-red-600/10 border-b border-red-600/30">
                {["N°", t("common.client"), t("common.vehicle"), t("common.total"), t("common.paid"), t("common.rest"), t("sales.gain"), t("common.status"), t("common.type"), t("common.date"), ""].map((h, i) => (
                  <th key={i} className="p-3.5 label-caps !text-red-300/80">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sales.map((s, i) => (
                <motion.tr
                  key={s.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className={`border-b border-red-600/10 transition-colors hover:bg-red-600/8 ${i % 2 ? "bg-white/[0.015]" : ""}`}
                >
                  <td className="p-3 text-text-muted font-mono text-xs">{s.reference}</td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-red-600 to-red-900 text-white flex items-center justify-center text-[0.6rem] font-black shrink-0">{initials(`${s.client?.firstName} ${s.client?.lastName}`)}</div>
                      <span className="text-text-primary">{s.client?.firstName} {s.client?.lastName}</span>
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-7 rounded overflow-hidden shrink-0"><CarImage images={s.car?.images} heightClass="h-7" fit="cover" /></div>
                      <span className="text-text-muted">{s.car?.brand} {s.car?.model}</span>
                    </div>
                  </td>
                  <td className="p-3 text-text-primary font-bold">{formatAmount(s.totalAfterReduction)}</td>
                  <td className="p-3 text-emerald-400">{formatAmount(s.amountPaid)}</td>
                  <td className="p-3">{s.amountRest > 0 ? <span className="text-rose-400 font-bold">{formatAmount(s.amountRest)}</span> : <span className="text-text-muted">—</span>}</td>
                  <td className="p-3">
                    {s.hasPurchaseInfo ? (
                      <span className={`font-bold flex items-center gap-1 ${s.gain >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                        <TrendingUp size={12} className={s.gain < 0 ? "rotate-180 text-rose-400" : "text-emerald-400"} />
                        {s.gain >= 0 ? "+" : ""}{formatAmount(s.gain)}
                      </span>
                    ) : (
                      <span className="text-text-muted">—</span>
                    )}
                  </td>
                  <td className="p-3">{s.amountRest > 0 ? <Badge color="debt">{t("sales.debt")}</Badge> : <Badge color="success">{t("sales.paid")}</Badge>}</td>
                  <td className="p-3"><Badge color={s.saleType === "DEPOSIT" ? "warning" : "success"}>{s.saleType === "DEPOSIT" ? t("sales.deposit") : t("sales.normal")}</Badge></td>
                  <td className="p-3 text-text-muted whitespace-nowrap">{formatDate(s.date)}</td>
                  <td className="p-3"><ActionMenu items={menuItems(s)} /></td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* View */}
      <Modal open={!!viewItem} onClose={() => setViewItem(null)} title={t("sales.detail")} size="lg">
        {viewItem && (
          <div className="space-y-3">
            <div className="rounded-xl overflow-hidden"><CarImage images={viewItem.car?.images} heightClass="h-44" zoomable /></div>

            {/* Financial Summary & Gain Card */}
            <div className="glass-card p-3.5 rounded-xl border border-red-600/20 bg-gradient-to-r from-red-950/30 via-black/40 to-red-950/20 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs label-caps !mb-0 text-red-300">{t("sales.financialSummary")}</span>
                {viewItem.hasPurchaseInfo && (
                  <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border flex items-center gap-1 ${
                    viewItem.gain >= 0
                      ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                      : "bg-rose-500/15 text-rose-400 border-rose-500/30"
                  }`}>
                    <TrendingUp size={13} className={viewItem.gain < 0 ? "rotate-180 text-rose-400" : "text-emerald-400"} />
                    {t("sales.gain")}: {viewItem.gain >= 0 ? "+" : ""}{formatAmount(viewItem.gain)}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
                <div className="bg-white/5 p-2 rounded-lg border border-white/5">
                  <p className="text-text-muted text-[10px]">{t("sales.purchaseCost")}</p>
                  <p className="font-bold text-text-primary mt-0.5">{viewItem.hasPurchaseInfo ? formatAmount(viewItem.purchasePrice) : "—"}</p>
                </div>
                <div className="bg-white/5 p-2 rounded-lg border border-white/5">
                  <p className="text-text-muted text-[10px]">{t("sales.carExpenses")}</p>
                  <p className="font-bold text-amber-400 mt-0.5">{viewItem.hasPurchaseInfo ? formatAmount(viewItem.carExpenses) : "—"}</p>
                </div>
                <div className="bg-white/5 p-2 rounded-lg border border-white/5">
                  <p className="text-text-muted text-[10px]">{t("pos.finalTotal")}</p>
                  <p className="font-bold text-text-primary mt-0.5">{formatAmount(viewItem.totalAfterReduction)}</p>
                </div>
                <div className={`p-2 rounded-lg border ${
                  viewItem.gain >= 0 ? "bg-emerald-500/10 border-emerald-500/20" : "bg-rose-500/10 border-rose-500/20"
                }`}>
                  <p className="text-text-muted text-[10px]">{t("sales.gain")}</p>
                  <p className={`font-black text-sm mt-0.5 ${viewItem.gain >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {viewItem.hasPurchaseInfo ? `${viewItem.gain >= 0 ? "+" : ""}${formatAmount(viewItem.gain)}` : "—"}
                  </p>
                </div>
              </div>
            </div>

            {viewItem.isClientCar && (
              <div className="glass-card p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/5">
                <div className="flex items-center gap-2 mb-2 text-amber-400">
                  <HandCoins size={15} />
                  <span className="label-caps !mb-0 !text-amber-400">{t("pos.clientCarTitle")}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div><p className="text-text-muted text-[10px]">{t("pos.showroomShare")}</p><p className="font-bold text-text-primary mt-0.5">{formatAmount(viewItem.showroomShare)}</p></div>
                  <div><p className="text-text-muted text-[10px]">{t("sales.carExpenses")}</p><p className="font-bold text-amber-400 mt-0.5">{formatAmount(viewItem.carExpenses)}</p></div>
                  <div><p className="text-text-muted text-[10px]">{t("pos.ownerAmount")}</p><p className="font-black text-emerald-400 mt-0.5">{formatAmount(viewItem.ownerAmount)}</p></div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-x-6">
              {Object.entries({
                [t("purchase.reference")]: viewItem.reference, [t("common.date")]: formatDate(viewItem.date),
                [t("common.client")]: `${viewItem.client?.firstName} ${viewItem.client?.lastName}`, [t("common.phone")]: viewItem.client?.phonePrimary,
                [t("common.vehicle")]: `${viewItem.car?.brand} ${viewItem.car?.model}`, [t("car.plate")]: viewItem.car?.plate,
                [t("pos.basePrice")]: formatAmount(viewItem.totalBeforeTax), [t("pos.tva")]: viewItem.tvaEnabled ? `${viewItem.tvaRate}%` : t("common.no"),
                [t("pos.finalTotal")]: formatAmount(viewItem.totalAfterReduction), [t("common.paid")]: formatAmount(viewItem.amountPaid),
                [t("common.rest")]: formatAmount(viewItem.amountRest), [t("common.type")]: viewItem.saleType === "DEPOSIT" ? t("sales.deposit") : t("sales.normal"),
                [t("sales.gain")]: viewItem.hasPurchaseInfo ? `${viewItem.gain >= 0 ? "+" : ""}${formatAmount(viewItem.gain)}` : "—",
              }).map(([k, v]) => <div key={k} className="flex justify-between text-sm border-b border-red-600/10 py-1.5"><span className="text-text-muted">{k}</span><span className={`text-right ${k === t("sales.gain") ? (viewItem.gain >= 0 ? "text-emerald-400 font-bold" : "text-rose-400 font-bold") : "text-text-primary"}`}>{v || "—"}</span></div>)}
            </div>
            {viewItem.payments?.length > 0 && (
              <div><h4 className="heading text-xs text-text-primary mb-2">{t("sales.paymentsHistory")}</h4>
                {viewItem.payments.map((p) => <div key={p.id} className="flex justify-between text-sm border-b border-red-600/10 py-1"><span className="text-text-muted">{formatDate(p.date)} — {p.description || "Paiement"}</span><span className="text-emerald-400">{formatAmount(p.amount)}</span></div>
                )}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button className="btn-ghost" onClick={() => { setHistoryTarget(viewItem); setViewItem(null); }}><History size={14} /> {t("versements.historyTitle")}</button>
              <button className="btn-ghost" onClick={() => { openPrintHub(viewItem); setViewItem(null); }}><Printer size={14} /> {t("print.printings")}</button>
              <button className="btn-ghost" onClick={() => { openMail(viewItem); setViewItem(null); }}><Mail size={14} /> {t("email.action")}</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Créer un versement */}
      {versementTarget && (
        <VersementForm
          sale={versementTarget}
          onClose={() => setVersementTarget(null)}
          onCreated={(fresh) => {
            const sale = versementTarget;
            setVersementTarget(null);
            refetch();
            setVersementPrompt({ sale, list: fresh.list });
          }}
        />
      )}

      {/* Historique des versements */}
      {historyTarget && (
        <VersementHistory
          sale={historyTarget}
          showroom={settings}
          onClose={() => setHistoryTarget(null)}
          onChanged={refetch}
        />
      )}

      {/* Print prompt after a versement is created */}
      <Modal open={!!versementPrompt} onClose={() => setVersementPrompt(null)} title={t("versements.created")} size="sm"
        footer={<>
          <button className="btn-ghost" onClick={() => setVersementPrompt(null)}>{t("common.skip")}</button>
          <button className="btn-ghost" onClick={() => { printInLang((lang) => <VersementStatement sale={versementPrompt.sale} showroom={settings} lang={lang} payments={versementPrompt.list} />, "ar"); setVersementPrompt(null); }}><Printer size={14} /> {t("common.printAr")}</button>
          <button className="btn-primary" onClick={() => { printInLang((lang) => <VersementStatement sale={versementPrompt.sale} showroom={settings} lang={lang} payments={versementPrompt.list} />, "fr"); setVersementPrompt(null); }}><Printer size={14} /> {t("common.printFr")}</button>
        </>}>
        <p className="text-text-muted">{t("versements.printPrompt")}</p>
      </Modal>

      {/* Edit — full wizard, same detail level as the POS sale flow */}
      <AnimatePresence>
        {editItem && (
          <SaleEditForm
            key={editItem.id}
            sale={editItem}
            onClose={() => setEditItem(null)}
            onSaved={() => { setEditItem(null); refetch(); refreshSettlements(); toast(t("sales.updatedToast")); }}
          />
        )}
      </AnimatePresence>

      {/* Impressions - every document of this sale */}
      <PrintHub
        open={!!printTarget}
        onClose={() => setPrintTarget(null)}
        title={t("print.printings")}
        docs={saleDocs(printTarget, printPayments)}
      />

      {/* Envoi par email (Brevo) */}
      <EmailModal
        sale={mailTarget}
        docs={saleDocs(mailTarget, mailPayments)}
        showroom={settings}
        onClose={() => setMailTarget(null)}
      />

      <ConfirmModal open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={confirmDelete} message={t("sales.deleteMsg")} />
    </div>
  );
}

/**
 * Send one or several printing templates of a sale to the client, through
 * Brevo. The documents are the very same templates the printer produces.
 */
function EmailModal({ sale, docs, showroom, onClose }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [selected, setSelected] = useState([]);
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [lang, setLang] = useState("fr");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!sale) return;
    setSelected(["facture-finale"]);
    setTo(sale.client?.email || "");
    setSubject(`${showroom?.name || "Showroom"} — ${t("email.subjectFor")} ${sale.reference}`);
    setLang("fr");
    setError("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sale?.id]);

  const send = async () => {
    setError("");
    if (!to.trim()) { setError(t("email.missingEmail")); return; }
    if (selected.length === 0) { setError(t("email.missingDocs")); return; }
    setSending(true);
    try {
      const html = renderDocsToHtml(docs, selected, lang, { title: subject });
      await sendDocumentsEmail({
        to: to.trim(),
        toName: `${sale.client?.firstName || ""} ${sale.client?.lastName || ""}`.trim(),
        subject,
        html,
        lang,
        templates: documentLabels(docs, selected),
        saleId: sale.id,
        clientId: sale.clientId || sale.client?.id || null,
        senderEmail: showroom?.emailSender || undefined,
        senderName: showroom?.emailSenderName || undefined,
        replyTo: showroom?.email || undefined,
      });
      toast(t("email.sentToast"));
      onClose();
    } catch (e) {
      setError(e?.message || t("email.failed"));
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal
      open={!!sale}
      onClose={onClose}
      title={t("email.title")}
      size="lg"
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>{t("common.cancel")}</button>
          <button className="btn-primary" onClick={send} disabled={sending}>
            {sending ? "..." : <><Send size={14} /> {t("email.send")}</>}
          </button>
        </>
      }
    >
      {sale && (
        <div className="space-y-4">
          <p className="text-xs text-text-muted">{t("email.help")}</p>

          <div>
            <p className="label-caps">{t("email.documents")}</p>
            <DocPicker docs={docs} value={selected} onChange={setSelected} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label={t("email.to")} required>
              <input className="input" type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="client@email.com" />
            </Field>
            <div>
              <p className="label-caps">{t("print.chooseLang")}</p>
              <div className="flex gap-2">
                <button className={`chip flex-1 ${lang === "fr" ? "chip-active" : ""}`} onClick={() => setLang("fr")}>Français</button>
                <button className={`chip flex-1 ${lang === "ar" ? "chip-active" : ""}`} onClick={() => setLang("ar")}>العربية</button>
              </div>
            </div>
          </div>

          <Field label={t("email.subject")}>
            <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </Field>

          <p className="text-[0.65rem] text-text-muted">
            {t("email.sender")} : <span className="text-text-primary">{showroom?.emailSenderName || "altech showroom"}</span>{" "}
            &lt;{showroom?.emailSender || "icarmhd@gmail.com"}&gt;
          </p>

          {error && <p className="text-rose-400 text-sm">{error}</p>}
        </div>
      )}
    </Modal>
  );
}
