import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Eye, Pencil, Trash2, Printer, Wallet, Plus, User, Check, X, KeyRound, FileText, Upload, LayoutGrid, Table as TableIcon, Store, ClipboardList, FileSignature, ClipboardCheck, Gauge, Receipt, ChevronDown } from "lucide-react";
import { carsApi, purchasesApi, clientsApi, inspectionApi } from "../lib/api.js";
import { useFetch } from "../hooks/useApi.js";
import { useCan } from "../lib/permissions.js";
import { useStore } from "../store/useStore.js";
import { Card, Badge, Modal, ConfirmModal, Field, EmptyState, SkeletonGrid, Stepper, Toggle, AnimatedGrid, useToast } from "../components/ui.jsx";
import PageHeader from "../components/PageHeader.jsx";
import ActionMenu from "../components/ActionMenu.jsx";
import SearchSelect from "../components/SearchSelect.jsx";
import CreatableSelect from "../components/CreatableSelect.jsx";
import ClientForm, { validateClient } from "../components/ClientForm.jsx";
import { MultiImageUpload } from "../components/ImageUpload.jsx";
import InspectionChecklist, { DEFAULT_INSPECTION, hasInspectionItems } from "../components/InspectionChecklist.jsx";
import { CarImage } from "../components/CarCard.jsx";
import { PurchaseInvoice } from "../components/PrintTemplates.jsx";
import { BonEntree, EngagementDepot, ReceptionForm, FicheTechnique } from "../components/PrintDocs.jsx";
import PrintHub from "../components/PrintHub.jsx";
import { formatAmount, formatDate, toDateTimeLocal } from "../utils/format.js";
import DateInput from "../components/DateInput.jsx";

const FILTERS = [
  { key: "", tkey: "common.all" },
  { key: "sourceType=CLIENT", tkey: "purchase.filterClient" },
  { key: "sourceType=SHOWROOM", tkey: "purchase.filterShowroom" },
  { key: "paid=PAID", tkey: "purchase.filterPaid" },
  { key: "paid=DEBT", tkey: "purchase.filterDebt" },
];

// Fields of the printable "Fiche technique" (cars.specs)
const SPEC_FIELDS = [
  ["engine", "car.specEngine"], ["power", "car.specPower"], ["transmission", "car.specTransmission"],
  ["consumption", "car.specConsumption"], ["wheelbase", "car.specWheelbase"], ["trunk", "car.specTrunk"],
  ["weight", "car.specWeight"], ["tank", "car.specTank"], ["dimensions", "car.specDimensions"],
];

const ENERGIES = [["ESSENCE", "energy.ESSENCE"], ["DIESEL", "energy.DIESEL"], ["HYBRID", "energy.HYBRID"], ["ELECTRIC", "energy.ELECTRIC"]];
const GEARBOXES = [["MANUAL", "gearbox.MANUAL"], ["AUTO", "gearbox.AUTO"]];

function PurchaseForm({ onClose, onSaved, editTarget }) {
  const { t } = useTranslation();
  const can = useCan();
  const { settings } = useStore();
  const isEdit = !!editTarget;
  const [step, setStep] = useState(0);
  const [sourceType, setSourceType] = useState(editTarget?.sourceType === "CLIENT" ? "CLIENT" : "SHOWROOM");
  const [client, setClient] = useState(editTarget?.sourceType === "CLIENT" ? editTarget?.client || null : null);
  const [newClient, setNewClient] = useState(null);
  const [clientErrors, setClientErrors] = useState({});
  const [car, setCar] = useState(() => editTarget?.car
    ? { ...editTarget.car, keysCount: editTarget.car.keysCount ?? "", documents: editTarget.car.documents || [], specs: editTarget.car.specs || {} }
    : { images: [], energy: "ESSENCE", gearbox: "MANUAL", keysCount: "", documents: [], specs: {} });
  const [showSpecs, setShowSpecs] = useState(false);
  // Reception form (printed as "Formulaire réception véhicule")
  const [remark, setRemark] = useState(editTarget?.remark || "");
  const [pricing, setPricing] = useState(() => isEdit
    ? { purchasePrice: String(editTarget.purchasePrice ?? ""), sellingPrice: String(editTarget.sellingPrice ?? ""), amountPaid: String(editTarget.amountPaid ?? "") }
    : { purchasePrice: "", sellingPrice: "", amountPaid: "" });
  // Once the amount paid has its own value it must survive a change of the
  // purchase price — otherwise editing the price silently rewrites what the
  // record says was already paid.
  const [paidTouched, setPaidTouched] = useState(isEdit);
  const savedInspection = editTarget?.inspection ?? editTarget?.car?.inspection;
  const [inspection, setInspection] = useState(
    hasInspectionItems(savedInspection) ? savedInspection : DEFAULT_INSPECTION
  );
  const [date, setDate] = useState(toDateTimeLocal(editTarget?.date));
  const [saving, setSaving] = useState(false);

  // Load the saved checklist template so items added on a previous purchase/sale
  // reappear here. Falls back to DEFAULT_INSPECTION when none is stored yet.
  // In edit mode the purchase's own saved checklist wins — but an empty one
  // (`{}` is the column default) would render three blank sections, so the
  // template is pulled in there too.
  useEffect(() => {
    if (isEdit && hasInspectionItems(savedInspection)) return;
    inspectionApi.getTemplate().then((tpl) => { if (hasInspectionItems(tpl)) setInspection(tpl); }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Persist add/remove of checklist items so they're remembered next time.
  const persistInspection = (next) => { inspectionApi.saveTemplate(next).catch(() => {}); };

  // documents — every known document type is shown as a checkable card; a type
  // can be checked (applicable to this car) with or without an attached file.
  const { data: docTypes, refetch: refetchTypes } = useFetch(() => carsApi.getDocumentTypes(), []);

  // Colour & year reference lists — the pickers below can add to them without
  // leaving the form, so the new value is available on the next purchase too.
  const [colors, setColors] = useState([]);
  const [years, setYears] = useState([]);
  useEffect(() => {
    carsApi.getColors().then(setColors).catch(() => {});
    carsApi.getYears().then(setYears).catch(() => {});
  }, []);
  const colorOptions = colors.map((c) => ({ id: c.id, label: c.name, value: c.name }));
  const yearOptions = years.map((y) => ({ id: y.id, label: String(y.year), value: String(y.year) }));
  const createColor = async (name) => {
    const created = await carsApi.createColor(name);
    setColors((list) => (list.some((c) => c.id === created.id) ? list : [...list, created].sort((a, b) => a.name.localeCompare(b.name))));
    return { id: created.id, label: created.name, value: created.name };
  };
  // Removing a colour is list maintenance, not a change to any vehicle: the
  // cars that already use it keep their colour. Gated on the same permission
  // the database policy checks, so the button never fails silently.
  const canEditColors = can("purchase", "delete");
  const deleteColor = async (option) => {
    await carsApi.deleteColor(option.id);
    setColors((list) => list.filter((c) => c.id !== option.id));
  };
  const createYear = async (year) => {
    const created = await carsApi.createYear(year);
    setYears((list) => (list.some((y) => y.id === created.id) ? list : [...list, created].sort((a, b) => b.year - a.year)));
    return { id: created.id, label: String(created.year), value: String(created.year) };
  };
  const [newDocType, setNewDocType] = useState("");
  const [showNewDocType, setShowNewDocType] = useState(false);
  const [uploadingType, setUploadingType] = useState("");

  const setCarField = (f) => (e) => setCar({ ...car, [f]: e.target.value });
  const setSpec = (f) => (e) => setCar((c) => ({ ...c, specs: { ...(c.specs || {}), [f]: e.target.value } }));
  // purchase price drives the editable "montant versé" default, until the user
  // (or an existing record) gives the amount paid a value of its own
  const setPurchasePrice = (v) =>
    setPricing((pr) => (paidTouched ? { ...pr, purchasePrice: v } : { ...pr, purchasePrice: v, amountPaid: v }));
  const setAmountPaid = (v) => { setPaidTouched(true); setPricing((pr) => ({ ...pr, amountPaid: v })); };
  const rest = Math.max(0, (Number(pricing.purchasePrice) || 0) - (Number(pricing.amountPaid) || 0));

  const createDocType = async () => {
    if (!newDocType.trim()) return;
    const data = await carsApi.createDocumentType(newDocType.trim());
    await refetchTypes();
    setCar((c) => ({ ...c, documents: [...(c.documents || []), { type: data.name, url: null }] }));
    setNewDocType("");
    setShowNewDocType(false);
  };

  const toggleDocType = (typeName) => {
    setCar((c) => {
      const exists = (c.documents || []).some((d) => d.type === typeName);
      return {
        ...c,
        documents: exists
          ? c.documents.filter((d) => d.type !== typeName)
          : [...(c.documents || []), { type: typeName, url: null }],
      };
    });
  };

  const scanDocument = async (typeName, file) => {
    if (!file) return;
    setUploadingType(typeName);
    try {
      const url = await carsApi.uploadDocument(null, file);
      setCar((c) => ({ ...c, documents: (c.documents || []).map((d) => (d.type === typeName ? { ...d, url } : d)) }));
    } catch (e) {
      alert(e?.message || "Erreur lors du téléchargement du document");
    } finally {
      setUploadingType("");
    }
  };

  const saveClient = async () => {
    const errs = validateClient(newClient || {});
    if (Object.keys(errs).length) { setClientErrors(errs); return; }
    try {
      const data = await clientsApi.create(newClient);
      setClient(data);
      setNewClient(null);
    } catch (e) { alert(e.message || "Erreur"); }
  };

  // A vehicle the showroom owner bought himself has no counterparty at all.
  const isShowroom = sourceType === "SHOWROOM";
  const hasCounterparty = isShowroom || !!client;
  const canNext1 = hasCounterparty;

  // Everything the wizard needs before a record can be written. In edit mode the
  // save button is available on every step, so it is checked here too.
  const complete = hasCounterparty && !!car.brand && !!car.model && !!pricing.purchasePrice;

  const save = async () => {
    if (!complete) return;
    setSaving(true);
    try {
      const payload = {
        sourceType,
        clientId: sourceType === "CLIENT" ? client?.id : null,
        car: { ...car, year: car.year ? Number(car.year) : null, seats: car.seats ? Number(car.seats) : null, mileage: car.mileage ? Number(car.mileage) : null },
        purchasePrice: Number(pricing.purchasePrice) || 0,
        sellingPrice: Number(pricing.sellingPrice) || 0,
        // A showroom purchase carries no debt: the API forces amountPaid = price.
        amountPaid: isShowroom
          ? Number(pricing.purchasePrice) || 0
          : pricing.amountPaid === ""
          ? Number(pricing.purchasePrice) || 0
          : Number(pricing.amountPaid),
        inspection,
        date,
        receivedAt: date,
        remark,
      };
      const data = isEdit ? await purchasesApi.update(editTarget.id, payload) : await purchasesApi.create(payload);
      onSaved(data);
    } catch (e) {
      alert(e.message || (isEdit ? "Erreur lors de la mise à jour" : "Erreur lors de la création"));
    } finally {
      setSaving(false);
    }
  };

  const saveButton = (
    <button className="btn-primary" onClick={save} disabled={saving || !complete}>
      {saving ? "..." : isEdit ? t("purchase.saveChanges") : t("purchase.createPurchase")}
    </button>
  );

  return (
    <motion.div
      className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm overflow-y-auto p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    >
      <motion.div
        className="max-w-4xl mx-auto my-6 glass-panel p-6"
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="heading text-xl text-text-primary">{isEdit ? t("purchase.editTitle") : t("purchase.new")}</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary"><X size={22} /></button>
        </div>

        <Stepper
          steps={[t("purchase.stepSource"), t("purchase.stepVehicle"), t("purchase.stepInspection")]}
          current={step}
          onStepClick={isEdit ? setStep : undefined}
        />

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
          >

        {/* STEP 1 */}
        {step === 0 && (
          <div className="space-y-4">
            {/* Where the vehicle comes from — two choices since the supplier
                feature was removed: the showroom bought it, or a client left it
                on deposit ("prestation"). */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button onClick={() => setSourceType("SHOWROOM")} className={`p-4 rounded-xl border flex items-center gap-3 text-left rtl:text-right transition ${isShowroom ? "border-red-500 bg-red-600/15" : "border-red-600/30 hover:border-red-600/60"}`}>
                <span className={`p-2 rounded-lg shrink-0 ${isShowroom ? "bg-red-600/25 text-red-300" : "bg-red-600/10 text-text-muted"}`}><Store size={20} /></span>
                <span className="min-w-0">
                  <span className={`block font-black uppercase text-xs tracking-wide ${isShowroom ? "text-red-300" : "text-text-muted"}`}>{t("purchase.sourceShowroom")}</span>
                  <span className="block text-[0.68rem] text-text-muted mt-0.5 normal-case">{t("purchase.sourceShowroomHint")}</span>
                </span>
              </button>
              <button onClick={() => setSourceType("CLIENT")} className={`p-4 rounded-xl border flex items-center gap-3 text-left rtl:text-right transition ${sourceType === "CLIENT" ? "border-blue-500 bg-blue-600/15" : "border-red-600/30 hover:border-red-600/60"}`}>
                <span className={`p-2 rounded-lg shrink-0 ${sourceType === "CLIENT" ? "bg-blue-600/25 text-blue-300" : "bg-red-600/10 text-text-muted"}`}><User size={20} /></span>
                <span className="min-w-0">
                  <span className={`block font-black uppercase text-xs tracking-wide ${sourceType === "CLIENT" ? "text-blue-300" : "text-text-muted"}`}>{t("purchase.sourcePrestation")}</span>
                  <span className="block text-[0.68rem] text-text-muted mt-0.5 normal-case">{t("purchase.sourcePrestationHint")}</span>
                </span>
              </button>
            </div>

            {isShowroom ? (
              <Card className="p-4 border border-red-500/40">
                <div className="flex items-start gap-3">
                  <span className="p-2 rounded-lg bg-red-600/15 text-red-400 shrink-0"><Store size={18} /></span>
                  <div>
                    <p className="heading text-sm text-text-primary">{settings?.name || t("purchase.sourceShowroom")}</p>
                    <p className="text-xs text-text-muted mt-0.5">{t("purchase.showroomHelp")}</p>
                  </div>
                </div>
              </Card>
            ) : (
              <div>
                {client ? (
                  <Card className="p-4 border border-blue-500/40">
                    <div className="flex justify-between items-center">
                      <div><p className="heading text-sm text-text-primary">{client.firstName} {client.lastName}</p><p className="text-xs text-text-muted">{client.phonePrimary}</p></div>
                      <button className="btn-ghost text-xs py-1.5" onClick={() => setClient(null)}>{t("common.change")}</button>
                    </div>
                  </Card>
                ) : (
                  <>
                    <SearchSelect fetcher={(q) => clientsApi.search(q)} placeholder={t("purchase.searchClient")} onSelect={setClient}
                      renderItem={(c) => <div><p className="text-sm text-text-primary">{c.firstName} {c.lastName}</p><p className="text-xs text-text-muted">{c.phonePrimary}</p></div>} />
                    {!newClient ? (
                      <button className="btn-ghost w-full mt-3" onClick={() => setNewClient({})}><Plus size={14} /> {t("purchase.newClient")}</button>
                    ) : (
                      <Card className="p-4 mt-3">
                        <ClientForm value={newClient} onChange={setNewClient} errors={clientErrors} />
                        <div className="flex gap-2 justify-end mt-3"><button className="btn-ghost text-xs" onClick={() => setNewClient(null)}>{t("common.cancel")}</button><button className="btn-primary text-xs" onClick={saveClient}>{t("common.save")}</button></div>
                      </Card>
                    )}
                  </>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4">
              {isEdit && saveButton}
              <button className="btn-primary" disabled={!canNext1} onClick={() => setStep(1)}>{t("common.next")} →</button>
            </div>
          </div>
        )}

        {/* STEP 2 */}
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <p className="label-caps">{t("car.images")}</p>
              <MultiImageUpload value={car.images} onChange={(images) => setCar({ ...car, images })} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label={t("car.brand")} required><input className="input" value={car.brand || ""} onChange={setCarField("brand")} /></Field>
              <Field label={t("car.model")} required><input className="input" value={car.model || ""} onChange={setCarField("model")} /></Field>
              <Field label={t("car.plate")}><input className="input" value={car.plate || ""} onChange={setCarField("plate")} /></Field>
              <Field label={t("car.year")}>
                <CreatableSelect
                  numeric
                  value={car.year == null ? "" : String(car.year)}
                  onChange={(v) => setCar((c) => ({ ...c, year: v }))}
                  options={yearOptions}
                  onCreate={createYear}
                  placeholder={t("car.yearPlaceholder")}
                />
              </Field>
              <Field label={t("car.color")}>
                <CreatableSelect
                  value={car.color || ""}
                  onChange={(v) => setCar((c) => ({ ...c, color: v }))}
                  options={colorOptions}
                  onCreate={createColor}
                  onDelete={canEditColors ? deleteColor : undefined}
                  placeholder={t("car.colorPlaceholder")}
                />
              </Field>
              <Field label={t("car.vin")}><input className="input" value={car.vin || ""} onChange={setCarField("vin")} /></Field>
              <Field label={t("car.fiche")} className="sm:col-span-2"><textarea className="input" rows={2} value={car.fiche || ""} onChange={setCarField("fiche")} /></Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="label-caps">{t("car.energy")}</p>
                <div className="flex flex-wrap gap-2">{ENERGIES.map(([v, l]) => <button key={v} className={`chip ${car.energy === v ? "chip-active" : ""}`} onClick={() => setCar({ ...car, energy: v })}>{t(l)}</button>)}</div>
              </div>
              <div>
                <p className="label-caps">{t("car.gearbox")}</p>
                <div className="flex flex-wrap gap-2">{GEARBOXES.map(([v, l]) => <button key={v} className={`chip ${car.gearbox === v ? "chip-active" : ""}`} onClick={() => setCar({ ...car, gearbox: v })}>{t(l)}</button>)}</div>
              </div>
              <Field label={t("car.seats")}><input className="input" type="number" value={car.seats || ""} onChange={setCarField("seats")} /></Field>
              <Field label={t("car.mileage")}><input className="input" type="number" value={car.mileage || ""} onChange={setCarField("mileage")} /></Field>
            </div>

            {/* Keys & documents */}
            <div className="flex items-center gap-3 my-2"><span className="label-caps !mb-0">{t("purchase.keysAndDocs")}</span><div className="flex-1 h-px bg-red-600/20" /></div>
            <Field label={t("car.keys")} className="max-w-[10rem]">
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-red-500/70" size={15} />
                <input className="input pl-9" type="number" min="0" value={car.keysCount} onChange={setCarField("keysCount")} placeholder="2" />
              </div>
            </Field>

            <div className="flex items-center justify-between">
              <span className="label-caps !mb-0">{t("car.availableDocTypes")}</span>
              <button type="button" className="text-[0.6rem] text-red-400 hover:text-red-300 uppercase tracking-wider font-bold" onClick={() => setShowNewDocType((s) => !s)}>{t("car.newDocType")}</button>
            </div>
            <p className="text-xs text-text-muted italic -mt-1">{t("car.scanOptional")}</p>
            {showNewDocType && (
              <div className="flex gap-2">
                <input className="input flex-1" placeholder={t("car.docTypeName")} value={newDocType} onChange={(e) => setNewDocType(e.target.value)} />
                <button type="button" className="btn-primary text-xs py-2 px-3" onClick={createDocType}>{t("common.create")}</button>
              </div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {(docTypes || []).map((dt) => {
                const doc = (car.documents || []).find((d) => d.type === dt.name);
                const checked = !!doc;
                return (
                  <div key={dt.id} className={`glass-card !rounded-xl p-2.5 border transition ${checked ? "border-red-600/60" : "border-white/10"}`}>
                    <button type="button" onClick={() => toggleDocType(dt.name)} className="flex items-center gap-2 w-full text-left rtl:text-right">
                      <span className={`w-5 h-5 rounded-md flex items-center justify-center border shrink-0 transition ${checked ? "bg-red-600 border-red-600 text-white" : "border-white/20 text-transparent"}`}>
                        <Check size={13} />
                      </span>
                      <span className="text-sm text-text-primary truncate">{dt.name}</span>
                    </button>
                    {checked && (
                      <div className="flex items-center gap-2 mt-2 pl-7 rtl:pl-0 rtl:pr-7">
                        {doc.url ? (
                          <a href={doc.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-blue-400 hover:underline flex-1 min-w-0 truncate">
                            <FileText size={12} className="shrink-0" /> {t("car.viewFile")}
                          </a>
                        ) : (
                          <span className="text-xs text-text-muted flex-1 truncate">{t("car.noFileYet")}</span>
                        )}
                        <label className="text-text-muted hover:text-red-400 cursor-pointer shrink-0">
                          {uploadingType === dt.name ? <span className="text-[0.6rem]">...</span> : <Upload size={13} />}
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => scanDocument(dt.name, e.target.files[0])} />
                        </label>
                      </div>
                    )}
                  </div>
                );
              })}
              {(!docTypes || docTypes.length === 0) && <p className="text-xs text-text-muted italic col-span-full">{t("car.noDocTypes")}</p>}
            </div>

            {/* Fiche technique — printed on the "Fiche technique" document */}
            <div className="flex items-center gap-3 my-2">
              <button type="button" onClick={() => setShowSpecs((v) => !v)} className="label-caps !mb-0 flex items-center gap-1 hover:text-text-primary transition">
                <Gauge size={13} /> {t("car.specsTitle")}
                <motion.span animate={{ rotate: showSpecs ? 180 : 0 }} className="inline-flex"><ChevronDown size={13} /></motion.span>
              </button>
              <div className="flex-1 h-px bg-red-600/20" />
            </div>
            <AnimatePresence initial={false}>
              {showSpecs && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }} className="overflow-hidden"
                >
                  <p className="text-xs text-text-muted italic mb-3">{t("car.specsHelp")}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {SPEC_FIELDS.map(([key, label]) => (
                      <Field key={key} label={t(label)}>
                        <input className="input" value={car.specs?.[key] || ""} onChange={setSpec(key)} />
                      </Field>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <Field label={t("purchase.remark")}>
              <textarea className="input" rows={2} value={remark} onChange={(e) => setRemark(e.target.value)} placeholder={t("purchase.remarkHint")} />
            </Field>

            <div className="flex items-center gap-3 my-2"><span className="label-caps !mb-0">{t("purchase.pricing")}</span><div className="flex-1 h-px bg-red-600/20" /></div>
            <div className={`grid grid-cols-1 gap-4 ${isShowroom ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}>
              <Field label={sourceType === "CLIENT" ? t("purchase.clientProposedPrice") : t("showroom.purchasePrice")} required><input className="input" type="number" value={pricing.purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} /></Field>
              <Field label={t("showroom.sellingPrice")}><input className="input" type="number" value={pricing.sellingPrice} onChange={(e) => setPricing({ ...pricing, sellingPrice: e.target.value })} /></Field>
              {/* The owner bought the vehicle himself: there is nothing left to pay,
                  so the "montant versé" field is not shown at all. */}
              {!isShowroom && (
                <Field label={t("purchase.amountPaid")}><input className="input" type="number" value={pricing.amountPaid} onChange={(e) => setAmountPaid(e.target.value)} /></Field>
              )}
            </div>
            {isShowroom ? (
              <p className="text-sm text-text-muted italic">{t("purchase.showroomNoDebt")}</p>
            ) : (
              <p className="text-sm">{t("purchase.remaining")} : <span className={rest > 0 ? "text-rose-400 font-black" : "text-emerald-400 font-black"}>{formatAmount(rest)}</span></p>
            )}

            <div className="flex justify-between gap-2 pt-4">
              <button className="btn-ghost" onClick={() => setStep(0)}>← {t("common.back")}</button>
              <div className="flex gap-2">
                {isEdit && saveButton}
                <button className="btn-primary" disabled={!car.brand || !car.model || !pricing.purchasePrice} onClick={() => setStep(2)}>{t("common.next")} →</button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3 */}
        {step === 2 && (
          <div className="space-y-5">
            <InspectionChecklist value={inspection} onChange={setInspection} onPersist={persistInspection} />
            <Field label={t("purchase.purchaseDate")}><DateInput withTime className="sm:max-w-xs" value={date} onChange={setDate} /></Field>
            <div className="flex justify-between pt-4">
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

// Prestation (depot client) / Showroom
function SourceBadge({ sourceType }) {
  const { t } = useTranslation();
  if (sourceType === "CLIENT") return <Badge color="info">{t("purchase.sourcePrestation")}</Badge>;
  return <Badge color="accent">{t("purchase.sourceShowroom")}</Badge>;
}

export default function Purchase() {
  const { t } = useTranslation();
  const can = useCan();
  const { settings } = useStore();
  const toast = useToast();
  const [filter, setFilter] = useState("");
  const [search, setSearch] = useState("");
  const { data: purchases, loading, refetch } = useFetch(() => {
    const params = { search };
    if (filter.startsWith("sourceType=")) params.sourceType = filter.split("=")[1];
    if (filter.startsWith("paid=")) params.paid = filter.split("=")[1];
    return purchasesApi.list(params);
  }, [filter, search]);
  const { data: docTypeRows } = useFetch(() => carsApi.getDocumentTypes(), []);
  const docTypeNames = (docTypeRows || []).map((d) => d.name);
  const [showNew, setShowNew] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [printTarget, setPrintTarget] = useState(null);
  const [payTarget, setPayTarget] = useState(null);
  const [payAmount, setPayAmount] = useState("");
  const [viewItem, setViewItem] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [view, setView] = useState("cards");

  // Every printable document of a purchase. The hub asks for the options a
  // document needs (date & heure, prix de vente) and then the language.
  const purchaseDocs = (p) => {
    if (!p) return [];
    const docs = [
      {
        key: "bon-entree",
        label: t("print.bonEntree"),
        desc: t("print.bonEntreeDesc"),
        icon: ClipboardList,
        options: [{ name: "dateTime", label: t("print.dateTime"), type: "datetime", default: toDateTimeLocal(p.date) }],
        render: (lang, o) => <BonEntree purchase={p} showroom={settings} lang={lang} dateTime={o.dateTime} />,
      },
      {
        key: "reception",
        label: t("print.reception"),
        desc: t("print.receptionDesc"),
        icon: ClipboardCheck,
        options: [
          { name: "dateTime", label: t("print.dateTime"), type: "datetime", default: toDateTimeLocal(p.receivedAt || p.date) },
          { name: "receivedPhone", label: t("print.receivedPhone"), type: "text", default: "", hint: t("print.receivedPhoneHint") },
        ],
        render: (lang, o) => (
          <ReceptionForm purchase={p} showroom={settings} lang={lang} dateTime={o.dateTime} receivedPhone={o.receivedPhone} docTypes={docTypeNames} />
        ),
      },
      {
        key: "fiche",
        label: t("print.fiche"),
        desc: t("print.ficheDesc"),
        icon: Gauge,
        options: [{ name: "price", label: t("showroom.sellingPrice"), type: "number", default: String(p.sellingPrice ?? "") }],
        render: (lang, o) => <FicheTechnique car={p.car} showroom={settings} lang={lang} price={o.price} />,
      },
      {
        key: "bon-achat",
        label: t("print.purchaseInvoice"),
        desc: t("print.purchaseInvoiceDesc"),
        icon: Receipt,
        render: (lang) => <PurchaseInvoice purchase={p} showroom={settings} lang={lang} />,
      },
    ];
    // The deposit contract only makes sense for a vehicle left by its owner.
    if (p.sourceType === "CLIENT") {
      docs.splice(2, 0, {
        key: "engagement",
        label: t("print.engagement"),
        desc: t("print.engagementDesc"),
        icon: FileSignature,
        render: (lang) => <EngagementDepot purchase={p} showroom={settings} lang={lang} />,
      });
    }
    return docs;
  };

  const menuItems = (p) => [
    { label: t("common.view"), icon: Eye, onClick: () => setViewItem(p) },
    can("purchase", "edit") && { label: t("common.edit"), icon: Pencil, onClick: () => setEditItem(p) },
    can("purchase", "print") && { label: t("print.printings"), icon: Printer, onClick: () => setPrintTarget(p) },
    can("purchase", "edit") && p.amountRest > 0 && { label: t("common.payDebt"), icon: Wallet, onClick: () => { setPayTarget(p); setPayAmount(String(p.amountRest)); } },
    can("purchase", "delete") && { label: t("common.delete"), icon: Trash2, danger: true, onClick: () => setDeleteId(p.id) },
  ];

  const pay = async () => {
    await purchasesApi.addPayment(payTarget.id, Number(payAmount));
    setPayTarget(null); setPayAmount(""); refetch();
    toast(t("purchase.debtPaidToast"));
  };

  const confirmDelete = async () => {
    await purchasesApi.delete(deleteId);
    setDeleteId(null); refetch();
    toast(t("purchase.deletedToast"), "info");
  };

  return (
    <div>
      <PageHeader title={t("nav.purchase")} action={can("purchase", "create") ? () => setShowNew(true) : undefined} actionLabel={t("purchase.new")} />

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => <button key={f.key} className={`chip ${filter === f.key ? "chip-active" : ""}`} onClick={() => setFilter(f.key)}>{t(f.tkey)}</button>)}
        </div>
        <input className="input sm:max-w-xs sm:ml-auto rtl:sm:ml-0 rtl:sm:mr-auto" placeholder={t("purchase.searchPlaceholder")} value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="flex gap-1">
          <button className={`chip ${view === "cards" ? "chip-active" : ""}`} onClick={() => setView("cards")}><LayoutGrid size={14} /></button>
          <button className={`chip ${view === "table" ? "chip-active" : ""}`} onClick={() => setView("table")}><TableIcon size={14} /></button>
        </div>
      </div>

      {loading ? <SkeletonGrid /> : purchases?.length === 0 ? (
        <EmptyState message={t("purchase.noPurchase")} cta={can("purchase", "create") ? t("purchase.new") : undefined} onCta={() => setShowNew(true)} />
      ) : view === "table" ? (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left rtl:text-right border-b border-red-600/20 text-text-muted">
              {["N°", t("common.vehicle"), t("purchase.source"), t("common.price"), t("common.paid"), t("common.rest"), t("common.date"), ""].map((h, i) => <th key={i} className="p-3 label-caps">{h}</th>)}
            </tr></thead>
            <tbody>
              {purchases.map((p) => (
                <tr key={p.id} className="border-b border-red-600/10 hover:bg-red-600/5">
                  <td className="p-3 text-text-muted">{p.reference}</td>
                  <td className="p-3 text-text-primary">{p.car?.brand} {p.car?.model} <span className="text-text-muted">{p.car?.plate}</span></td>
                  <td className="p-3"><SourceBadge sourceType={p.sourceType} /></td>
                  <td className="p-3 text-text-primary">{formatAmount(p.purchasePrice)}</td>
                  <td className="p-3 text-emerald-400">{formatAmount(p.amountPaid)}</td>
                  <td className="p-3 text-rose-400">{formatAmount(p.amountRest)}</td>
                  <td className="p-3 text-text-muted">{formatDate(p.date)}</td>
                  <td className="p-3"><ActionMenu items={menuItems(p)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : (
        <AnimatedGrid className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {purchases.map((p) => (
            <Card key={p.id} className="p-4 flex gap-4">
              <div className="w-28 h-20 rounded-lg overflow-hidden shrink-0"><CarImage images={p.car?.images} heightClass="h-20" fit="cover" /></div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <p className="heading text-sm text-text-primary truncate">
                      {p.car?.brand} {p.car?.model}{p.car?.color ? ` (${p.car.color})` : ""}
                    </p>
                    <p className="text-xs text-text-muted truncate">
                      {[p.car?.vin, p.car?.year, p.reference].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <ActionMenu items={menuItems(p)} />
                </div>
                <div className="flex gap-1.5 my-2">
                  <SourceBadge sourceType={p.sourceType} />
                  {p.amountRest > 0 ? <Badge color="debt">{t("purchase.filterDebt")}</Badge> : <Badge color="success">{t("purchase.filterPaid")}</Badge>}
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">{formatDate(p.date)}</span>
                  <span className="text-text-primary">{formatAmount(p.purchasePrice)} {p.amountRest > 0 && <span className="text-rose-400">· {t("common.rest")} {formatAmount(p.amountRest)}</span>}</span>
                </div>
              </div>
            </Card>
          ))}
        </AnimatedGrid>
      )}

      <AnimatePresence>
        {(showNew || editItem) && (
          <PurchaseForm
            key={editItem ? `edit-${editItem.id}` : "new"}
            editTarget={editItem}
            onClose={() => { setShowNew(false); setEditItem(null); }}
            onSaved={() => {
              const wasEdit = !!editItem;
              setShowNew(false); setEditItem(null); refetch();
              toast(wasEdit ? t("purchase.updatedToast") : t("purchase.createdToast"));
            }}
          />
        )}
      </AnimatePresence>

      {/* Impressions - every document of this purchase */}
      <PrintHub
        open={!!printTarget}
        onClose={() => setPrintTarget(null)}
        title={t("print.printings")}
        docs={purchaseDocs(printTarget)}
      />

      {/* Pay debt */}
      <Modal open={!!payTarget} onClose={() => setPayTarget(null)} title={t("common.payDebt")} size="sm"
        footer={<><button className="btn-ghost" onClick={() => setPayTarget(null)}>{t("common.cancel")}</button><button className="btn-primary" onClick={pay}>{t("common.validate")}</button></>}>
        {payTarget && (
          <div className="space-y-3">
            <div className="flex justify-between text-sm"><span className="text-text-muted">{t("common.total")}</span><span className="text-text-primary">{formatAmount(payTarget.purchasePrice)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-text-muted">{t("purchase.alreadyPaid")}</span><span className="text-emerald-400">{formatAmount(payTarget.amountPaid)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-text-muted">{t("common.rest")}</span><span className="text-rose-400">{formatAmount(payTarget.amountRest)}</span></div>
            <Field label={t("purchase.amountToPay")}><input className="input" type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} /></Field>
          </div>
        )}
      </Modal>

      {/* View */}
      <Modal open={!!viewItem} onClose={() => setViewItem(null)} title={t("purchase.detail")} size="lg">
        {viewItem && (
          <div className="space-y-3">
            <div className="rounded-xl overflow-hidden"><CarImage images={viewItem.car?.images} heightClass="h-48" zoomable /></div>
            <div className="grid grid-cols-2 gap-x-6">
              {Object.entries({
                [t("purchase.reference")]: viewItem.reference, [t("common.date")]: formatDate(viewItem.date),
                [t("common.vehicle")]: `${viewItem.car?.brand} ${viewItem.car?.model}`, [t("car.plate")]: viewItem.car?.plate,
                [t("purchase.source")]: viewItem.sourceType === "CLIENT"
                  ? `${viewItem.client?.firstName} ${viewItem.client?.lastName}`
                  : settings?.name || t("purchase.sourceShowroom"),
                [t("showroom.purchasePrice")]: formatAmount(viewItem.purchasePrice), [t("showroom.sellingPrice")]: formatAmount(viewItem.sellingPrice),
                [t("common.paid")]: formatAmount(viewItem.amountPaid), [t("common.rest")]: formatAmount(viewItem.amountRest),
                [t("car.keys")]: viewItem.car?.keysCount != null ? viewItem.car.keysCount : "—",
              }).map(([k, v]) => <div key={k} className="flex justify-between text-sm border-b border-red-600/10 py-1.5"><span className="text-text-muted">{k}</span><span className="text-text-primary text-right">{v || "—"}</span></div>)}
            </div>
            {(viewItem.car?.documents || []).length > 0 && (
              <div>
                <p className="label-caps mb-2">{t("car.documentsOfVehicle")}</p>
                <div className="flex flex-wrap gap-2">
                  {viewItem.car.documents.map((d, i) => d.url ? (
                    <a key={i} href={d.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 glass-card !rounded-lg px-2.5 py-1.5 hover:border-red-600/60">
                      <FileText size={14} className="text-blue-400" />
                      <span className="text-xs text-text-primary">{d.type}</span>
                    </a>
                  ) : (
                    <div key={i} className="flex items-center gap-2 glass-card !rounded-lg px-2.5 py-1.5 opacity-60">
                      <FileText size={14} className="text-text-muted" />
                      <span className="text-xs text-text-primary">{d.type}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <button className="btn-ghost w-full" onClick={() => { setPrintTarget(viewItem); setViewItem(null); }}><Printer size={14} /> {t("print.printings")}</button>
          </div>
        )}
      </Modal>

      <ConfirmModal open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={confirmDelete} message={t("purchase.deleteMsg")} />
    </div>
  );
}
