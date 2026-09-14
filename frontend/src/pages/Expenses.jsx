import { useState } from "react";
import { motion } from "framer-motion";
import { Pencil, Trash2, Car, Building2, Printer, Loader2, FileText } from "lucide-react";
import { expensesApi, carsApi } from "../lib/api.js";
import { useFetch } from "../hooks/useApi.js";
import { useCan } from "../lib/permissions.js";
import { useStore } from "../store/useStore.js";
import { Card, Modal, ConfirmModal, Field, EmptyState, SkeletonGrid, AnimatedGrid, useToast } from "../components/ui.jsx";
import PageHeader from "../components/PageHeader.jsx";
import SearchSelect from "../components/SearchSelect.jsx";
import { CarImage } from "../components/CarCard.jsx";
import { usePrintDialog } from "../components/PrintChooser.jsx";
import { ExpensesReport } from "../components/PrintTemplates.jsx";
import { formatAmount, formatDate, toDateInput } from "../utils/format.js";
import DateInput from "../components/DateInput.jsx";

// Period presets offered in the print dialog
function periodPresets() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  return [
    { label: "Ce mois", from: new Date(y, m, 1), to: now },
    { label: "Mois dernier", from: new Date(y, m - 1, 1), to: new Date(y, m, 0) },
    { label: "Cette année", from: new Date(y, 0, 1), to: now },
    { label: "12 derniers mois", from: new Date(y, m - 11, 1), to: now },
  ].map((p) => ({ label: p.label, from: toDateInput(p.from), to: toDateInput(p.to) }));
}

const SCOPES = [
  { key: "CAR", label: "Véhicules", icon: Car },
  { key: "SHOWROOM", label: "Showroom", icon: Building2 },
  { key: "ALL", label: "Toutes", icon: FileText },
];

export default function Expenses() {
  const can = useCan();
  const toast = useToast();
  const { settings } = useStore();
  const openPrint = usePrintDialog();
  const [tab, setTab] = useState("CAR");
  const { data: expenses, loading, refetch } = useFetch(() => expensesApi.list(tab), [tab]);
  const [form, setForm] = useState(null);
  const [editId, setEditId] = useState(null);
  const [selectedCar, setSelectedCar] = useState(null);
  const [deleteId, setDeleteId] = useState(null);

  // ── Print-a-period state ────────────────────────────────────────────────
  const [printOpen, setPrintOpen] = useState(false);
  const [scope, setScope] = useState("CAR");
  const [range, setRange] = useState({ from: "", to: "" });
  const [rows, setRows] = useState(null); // generated list (null = not generated yet)
  const [generating, setGenerating] = useState(false);

  const total = (expenses || []).reduce((a, e) => a + e.amount, 0);

  const openNew = () => { setForm({ name: "", description: "", amount: "", date: toDateInput(new Date()) }); setEditId(null); setSelectedCar(null); };
  const openEdit = (e) => { setForm({ ...e, date: toDateInput(e.date) }); setEditId(e.id); setSelectedCar(e.car || null); };

  const openPrintModal = () => {
    const [thisMonth] = periodPresets();
    setScope(tab);
    setRange({ from: thisMonth.from, to: thisMonth.to });
    setRows(null);
    setPrintOpen(true);
  };

  const generate = async () => {
    if (!range.from || !range.to) { toast("Sélectionnez une date de début et une date de fin", "error"); return; }
    if (range.from > range.to) { toast("La date de début doit précéder la date de fin", "error"); return; }
    setGenerating(true);
    try {
      const data = await expensesApi.listRange({ from: range.from, to: range.to, type: scope === "ALL" ? "" : scope });
      setRows(data);
      if (data.length === 0) toast("Aucune dépense sur cette période", "info");
    } catch {
      toast("Erreur lors de la génération", "error");
    } finally {
      setGenerating(false);
    }
  };

  // Changing the period/scope invalidates a previously generated list.
  const setRangeField = (patch) => { setRange((r) => ({ ...r, ...patch })); setRows(null); };
  const changeScope = (k) => { setScope(k); setRows(null); };

  const printReport = () => {
    if (!rows?.length) return;
    openPrint((lang) => (
      <ExpensesReport expenses={rows} showroom={settings} from={range.from} to={range.to} scope={scope} lang={lang} />
    ));
  };

  const reportTotal = (rows || []).reduce((a, e) => a + (Number(e.amount) || 0), 0);
  const reportCarTotal = (rows || []).filter((e) => e.type === "CAR").reduce((a, e) => a + (Number(e.amount) || 0), 0);
  const reportShowroomTotal = reportTotal - reportCarTotal;

  const save = async () => {
    if (!form.name || !form.amount) { alert("Nom et montant requis"); return; }
    if (tab === "CAR" && !selectedCar && !editId) { alert("Sélectionnez un véhicule"); return; }
    const payload = { ...form, type: tab, amount: Number(form.amount), carId: tab === "CAR" ? (selectedCar?.id || form.carId) : null };
    if (editId) await expensesApi.update(editId, payload);
    else await expensesApi.create(payload);
    setForm(null); refetch();
  };

  const confirmDelete = async () => { await expensesApi.delete(deleteId); setDeleteId(null); refetch(); };

  return (
    <div>
      <PageHeader title="Dépenses" action={can("expenses", "create") ? openNew : undefined} actionLabel={tab === "CAR" ? "Nouvelle Dépense Véhicule" : "Nouvelle Dépense"}>
        {can("expenses", "print") && (
          <motion.button className="btn-ghost" onClick={openPrintModal} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
            <Printer size={16} /> Imprimer
          </motion.button>
        )}
      </PageHeader>

      <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
        <div className="flex gap-2">
          <button className={`chip ${tab === "CAR" ? "chip-active" : ""}`} onClick={() => setTab("CAR")}><Car size={13} /> Véhicules</button>
          <button className={`chip ${tab === "SHOWROOM" ? "chip-active" : ""}`} onClick={() => setTab("SHOWROOM")}><Building2 size={13} /> Showroom</button>
        </div>
        <Card className="px-4 py-2"><span className="label-caps !mb-0">Total : </span><span className="text-amber-400 font-black">{formatAmount(total)}</span></Card>
      </div>

      {loading ? <SkeletonGrid /> : expenses?.length === 0 ? (
        <EmptyState icon={tab === "CAR" ? Car : Building2} message="Aucune dépense" cta={can("expenses", "create") ? "Ajouter" : undefined} onCta={openNew} />
      ) : (
        <AnimatedGrid className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {expenses.map((e) => (
            <Card key={e.id} className="p-4 flex gap-3">
              {tab === "CAR" && <div className="w-16 h-12 rounded-lg overflow-hidden shrink-0"><CarImage images={e.car?.images} heightClass="h-12" /></div>}
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <p className="heading text-sm text-text-primary truncate">{e.name}</p>
                    {tab === "CAR" && e.car && <p className="text-xs text-text-muted">{e.car.brand} {e.car.model} · {e.car.plate}</p>}
                    {e.description && <p className="text-xs text-text-muted truncate">{e.description}</p>}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {can("expenses", "edit") && <button className="text-text-muted hover:text-text-primary" onClick={() => openEdit(e)}><Pencil size={15} /></button>}
                    {can("expenses", "delete") && <button className="text-text-muted hover:text-rose-400" onClick={() => setDeleteId(e.id)}><Trash2 size={15} /></button>}
                  </div>
                </div>
                <div className="flex justify-between items-end mt-2">
                  <span className="text-lg font-black text-amber-400">{formatAmount(e.amount)}</span>
                  <span className="text-xs text-text-muted">{formatDate(e.date)}</span>
                </div>
              </div>
            </Card>
          ))}
        </AnimatedGrid>
      )}

      <Modal open={!!form} onClose={() => setForm(null)} title={editId ? "Modifier la dépense" : "Nouvelle dépense"} size="sm"
        footer={<><button className="btn-ghost" onClick={() => setForm(null)}>Annuler</button><button className="btn-primary" onClick={save}>Enregistrer</button></>}>
        {form && (
          <div className="space-y-4">
            {tab === "CAR" && !editId && (
              selectedCar ? (
                <Card className="p-2 flex items-center gap-2">
                  <div className="w-12 h-9 rounded overflow-hidden shrink-0"><CarImage images={selectedCar.images} heightClass="h-9" /></div>
                  <div className="flex-1"><p className="text-sm text-text-primary">{selectedCar.brand} {selectedCar.model}</p><p className="text-xs text-text-muted">{selectedCar.plate}</p></div>
                  <button className="btn-ghost text-xs py-1" onClick={() => setSelectedCar(null)}>Changer</button>
                </Card>
              ) : (
                <div><p className="label-caps">Véhicule</p>
                  <SearchSelect fetcher={(q) => carsApi.list({ search: q })} placeholder="Rechercher un véhicule..." onSelect={setSelectedCar}
                    renderItem={(c) => <div><p className="text-sm text-text-primary">{c.brand} {c.model}</p><p className="text-xs text-text-muted">{c.plate}</p></div>} />
                </div>
              )
            )}
            <Field label="Nom de la dépense" required><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Description"><input className="input" value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Montant" required><input className="input" type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></Field>
              <Field label="Date"><DateInput value={form.date} onChange={(v) => setForm({ ...form, date: v })} /></Field>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Print a period ─────────────────────────────────────────────── */}
      <Modal
        open={printOpen}
        onClose={() => setPrintOpen(false)}
        title="Imprimer les dépenses"
        size="lg"
        footer={
          <>
            <button className="btn-ghost" onClick={() => setPrintOpen(false)}>Fermer</button>
            <button className="btn-primary" onClick={printReport} disabled={!rows?.length}>
              <Printer size={16} /> Imprimer
            </button>
          </>
        }
      >
        <div className="space-y-5">
          <div>
            <p className="label-caps">Type de dépenses</p>
            <div className="flex gap-2 flex-wrap">
              {SCOPES.map((s) => (
                <button key={s.key} className={`chip ${scope === s.key ? "chip-active" : ""}`} onClick={() => changeScope(s.key)}>
                  <s.icon size={13} /> {s.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="label-caps">Périodes rapides</p>
            <div className="flex gap-2 flex-wrap">
              {periodPresets().map((p) => (
                <button
                  key={p.label}
                  className={`chip ${range.from === p.from && range.to === p.to ? "chip-active" : ""}`}
                  onClick={() => setRangeField({ from: p.from, to: p.to })}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 sm:items-end">
            <Field label="Date de début" className="flex-1" required>
              <DateInput value={range.from} onChange={(v) => setRangeField({ from: v })} />
            </Field>
            <Field label="Date de fin" className="flex-1" required>
              <DateInput value={range.to} onChange={(v) => setRangeField({ to: v })} />
            </Field>
            <motion.button className="btn-primary" onClick={generate} disabled={generating} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
              {generating ? (
                <motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="inline-flex">
                  <Loader2 size={16} />
                </motion.span>
              ) : (
                "Générer"
              )}
            </motion.button>
          </div>

          {rows === null ? (
            <Card className="p-6 text-center text-text-muted text-sm">
              Choisissez une période puis cliquez sur « Générer » pour afficher la liste des dépenses.
            </Card>
          ) : rows.length === 0 ? (
            <Card className="p-6 text-center text-text-muted text-sm">Aucune dépense sur cette période.</Card>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  ["Dépenses", `${rows.length}`, "text-text-primary"],
                  ["Total véhicules", formatAmount(reportCarTotal), "text-amber-400"],
                  ["Total showroom", formatAmount(reportShowroomTotal), "text-amber-400"],
                  ["Total général", formatAmount(reportTotal), "text-red-400"],
                ].map(([label, value, cls]) => (
                  <Card key={label} className="p-3">
                    <p className="label-caps">{label}</p>
                    <p className={`font-black ${cls}`}>{value}</p>
                  </Card>
                ))}
              </div>

              <Card className="p-0 overflow-hidden">
                <div className="max-h-72 overflow-y-auto overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead className="sticky top-0 z-10">
                      <tr className="text-left rtl:text-right bg-[#1a0507] border-b border-red-600/30">
                        {["N°", "Date", "Désignation", "Description", "Véhicule / Catégorie", "Montant"].map((h) => (
                          <th key={h} className="p-2.5 label-caps !mb-0 !text-red-300/80 whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((e, i) => (
                        <tr key={e.id ?? i} className={`border-b border-red-600/10 ${i % 2 ? "bg-white/[0.015]" : ""}`}>
                          <td className="p-2.5 text-text-muted">{i + 1}</td>
                          <td className="p-2.5 text-text-muted whitespace-nowrap">{formatDate(e.date)}</td>
                          <td className="p-2.5 text-text-primary">{e.name}</td>
                          <td className="p-2.5 text-text-muted">{e.description || "—"}</td>
                          <td className="p-2.5 text-text-muted">
                            {e.type === "CAR"
                              ? `${[e.car?.brand, e.car?.model].filter(Boolean).join(" ") || "Véhicule"}${e.car?.plate ? ` · ${e.car.plate}` : ""}`
                              : "Showroom"}
                          </td>
                          <td className="p-2.5 text-amber-400 font-bold whitespace-nowrap">{formatAmount(e.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-red-600/10 border-t border-red-600/30">
                        <td className="p-2.5 heading text-xs text-text-primary" colSpan={5}>Total général</td>
                        <td className="p-2.5 font-black text-red-400 whitespace-nowrap">{formatAmount(reportTotal)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </Card>

              <p className="text-xs text-text-muted">
                Période : {formatDate(range.from)} → {formatDate(range.to)} · Le document imprimé reprend le logo et les informations du showroom.
              </p>
            </div>
          )}
        </div>
      </Modal>

      <ConfirmModal open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={confirmDelete} />
    </div>
  );
}
