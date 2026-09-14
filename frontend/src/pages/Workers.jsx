import { useState } from "react";
import { Eye, Pencil, Trash2, Shield, Wallet, CalendarX, Banknote, HardHat, Phone } from "lucide-react";
import { workersApi } from "../lib/api.js";
import { useFetch } from "../hooks/useApi.js";
import { SECTIONS, ACTIONS, useCan } from "../lib/permissions.js";
import { Card, Badge, Modal, ConfirmModal, Field, EmptyState, SkeletonGrid, Toggle, AnimatedGrid } from "../components/ui.jsx";
import PageHeader from "../components/PageHeader.jsx";
import ActionMenu from "../components/ActionMenu.jsx";
import { formatAmount, formatDate, toDateInput, initials } from "../utils/format.js";
import DateInput from "../components/DateInput.jsx";

const PAY_LABELS = { MONTHLY: "Mensuel", DAILY: "Journalier", NONE: "Aucun" };
const SECTION_LABELS = { dashboard: "Tableau de bord", showroom: "Showroom", purchase: "Achats", pos: "POS", sales: "Ventes", payments: "Paiements", settlements: "Règlements propriétaires", caisse: "Caisse (Dépôts/Retraits)", websiteSettings: "Site Web", websiteReservations: "Réservations Site", clients: "Clients", workers: "Employés", expenses: "Dépenses", reports: "Rapports", settings: "Paramètres" };
const ACTION_LABELS = { view: "Voir", create: "Créer", edit: "Modifier", delete: "Supprimer", print: "Imprimer" };

export default function Workers() {
  const can = useCan();
  const { data: workers, loading, refetch } = useFetch(() => workersApi.list(), []);
  const { data: roles, refetch: refetchRoles } = useFetch(() => workersApi.listRoles(), []);
  const [form, setForm] = useState(null);
  const [editId, setEditId] = useState(null);
  const [view, setView] = useState(null);
  const [permWorker, setPermWorker] = useState(null);
  const [perms, setPerms] = useState({});
  const [activeSection, setActiveSection] = useState(null);
  const [modalKind, setModalKind] = useState(null); // payment
  const [modalWorker, setModalWorker] = useState(null);
  const [modalData, setModalData] = useState({});
  const [showNewRole, setShowNewRole] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [transactionEditor, setTransactionEditor] = useState(null);
  const [transactionForm, setTransactionForm] = useState({ date: toDateInput(new Date()), amount: "", cost: "", description: "" });
  const [deleteTarget, setDeleteTarget] = useState(null);

  const createRole = async () => {
    if (!newRoleName.trim()) return;
    const data = await workersApi.createRole(newRoleName.trim());
    await refetchRoles();
    setForm((f) => ({ ...f, roleId: data.id }));
    setNewRoleName("");
    setShowNewRole(false);
  };

  const openNew = () => { setForm({ fullName: "", phone: "", paymentType: "NONE", accountEnabled: false, startDate: toDateInput(new Date()) }); setEditId(null); };
  const openEdit = (w) => { setForm({ ...w, birthday: toDateInput(w.birthday), startDate: toDateInput(w.startDate) }); setEditId(w.id); };

  const save = async () => {
    if (!form.fullName || !form.phone) { alert("Nom et téléphone requis"); return; }
    if (form.accountEnabled && !editId && (!form.email || !form.password)) {
      alert("Email et mot de passe requis pour activer un compte de connexion");
      return;
    }
    try {
      if (editId) await workersApi.update(editId, form);
      else await workersApi.create(form);
      setForm(null); refetch();
    } catch (e) {
      alert(e.message || "Erreur lors de l'enregistrement");
    }
  };

  const openPerms = (w) => {
    setPermWorker(w);
    setPerms(w.role?.permissions || {});
    setActiveSection(null);
  };
  const togglePerm = (section, action) => {
    setPerms((prev) => {
      const sec = { ...(prev[section] || {}) };
      sec[action] = !sec[action];
      return { ...prev, [section]: sec };
    });
  };
  const savePerms = async () => {
    await workersApi.updatePermissions(permWorker.id, perms);
    setPermWorker(null); refetch();
  };

  const openModal = (kind, w) => {
    setModalKind(kind); setModalWorker(w);
    const pending = payrollCalc(w);
    setModalData({ date: toDateInput(new Date()), amount: kind === "payment" ? String(pending.net) : "", description: "", cost: "", month: "" });
  };
  const submitModal = async () => {
    const w = modalWorker;
    if (modalKind === "payment") await workersApi.addPayment(w.id, { amount: Number(modalData.amount), date: modalData.date, description: modalData.description, month: modalData.month });
    setModalKind(null); refetch();
  };

  const requestDelete = (type, id) => setDeleteTarget({ type, id });
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.type === "worker") await workersApi.delete(deleteTarget.id);
    if (deleteTarget.type === "advance") await workersApi.deleteAdvance(deleteTarget.id);
    if (deleteTarget.type === "absence") await workersApi.deleteAbsence(deleteTarget.id);
    setDeleteTarget(null); refetch();
  };

  // payroll calculation for payment modal
  const payrollCalc = (w) => {
    if (!w) return { base: 0, absences: [], advances: [], absenceCount: 0, absenceTotal: 0, advanceCount: 0, advanceTotal: 0, net: 0 };
    const unpaidAbsences = (w.absences || []).filter((x) => !x.isPaid);
    const unpaidAdvances = (w.advances || []).filter((x) => !x.isPaid);
    const base = w.paymentAmount || 0;
    const absenceTotal = unpaidAbsences.reduce((a, x) => a + (x.cost || 0), 0);
    const advanceTotal = unpaidAdvances.reduce((a, x) => a + (x.amount || 0), 0);
    const net = Math.max(0, base - absenceTotal - advanceTotal);
    return {
      base,
      absences: unpaidAbsences,
      advances: unpaidAdvances,
      absenceCount: unpaidAbsences.length,
      absenceTotal,
      advanceCount: unpaidAdvances.length,
      advanceTotal,
      net,
    };
  };
  const calc = payrollCalc(modalWorker);

  const openTransactionEditor = (kind, worker, item = null) => {
    setTransactionEditor({ kind, worker, item });
    setTransactionForm({
      date: item?.date ? toDateInput(item.date) : toDateInput(new Date()),
      amount: item?.amount ?? "",
      cost: item?.cost ?? "",
      description: item?.description ?? "",
    });
  };

  const saveTransaction = async () => {
    if (!transactionEditor) return;
    try {
      const payload = { date: transactionForm.date, description: transactionForm.description };
      if (transactionEditor.kind === "advance") {
        if (transactionEditor.item) {
          await workersApi.updateAdvance(transactionEditor.item.id, { ...payload, amount: Number(transactionForm.amount) || 0 });
        } else {
          await workersApi.addAdvance(transactionEditor.worker.id, { ...payload, amount: Number(transactionForm.amount) || 0 });
        }
      } else {
        if (transactionEditor.item) {
          await workersApi.updateAbsence(transactionEditor.item.id, { ...payload, cost: Number(transactionForm.cost) || 0 });
        } else {
          await workersApi.addAbsence(transactionEditor.worker.id, { ...payload, cost: Number(transactionForm.cost) || 0 });
        }
      }
      setTransactionEditor(null);
      refetch();
    } catch (e) {
      alert(e.message || "Erreur lors de l'enregistrement");
    }
  };

  return (
    <div>
      <PageHeader title="Employés" action={can("workers", "create") ? openNew : undefined} actionLabel="Nouvel Employé" />

      {loading ? <SkeletonGrid /> : workers?.length === 0 ? (
        <EmptyState icon={HardHat} message="Aucun employé" cta={can("workers", "create") ? "Nouvel Employé" : undefined} onCta={openNew} />
      ) : (
        <AnimatedGrid className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {workers.map((w) => (
            <Card key={w.id} className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-red-600 to-red-900 text-white flex items-center justify-center font-black">{initials(w.fullName)}</div>
                  <div>
                    <p className="heading text-sm text-text-primary">{w.fullName}</p>
                    <p className="text-xs text-text-muted">{w.role?.name || "Sans rôle"}</p>
                  </div>
                </div>
                <ActionMenu items={[
                  { label: "Voir", icon: Eye, onClick: () => setView(w) },
                  can("workers", "edit") && { label: "Modifier", icon: Pencil, onClick: () => openEdit(w) },
                  can("workers", "edit") && { label: "Permissions", icon: Shield, onClick: () => openPerms(w) },
                  can("workers", "edit") && { label: "Acompte", icon: Wallet, onClick: () => openTransactionEditor("advance", w) },
                  can("workers", "edit") && { label: "Absence", icon: CalendarX, onClick: () => openTransactionEditor("absence", w) },
                  can("workers", "edit") && { label: "Paiement", icon: Banknote, onClick: () => openModal("payment", w) },
                  can("workers", "delete") && { label: "Supprimer", icon: Trash2, danger: true, onClick: () => requestDelete("worker", w.id) },
                ]} />
              </div>
              <p className="text-xs text-text-muted flex items-center gap-1 mb-2"><Phone size={11} /> {w.phone}</p>
              <div className="flex justify-between items-center pt-3 border-t border-red-600/15">
                <Badge color={w.paymentType === "NONE" ? "muted" : "success"}>{PAY_LABELS[w.paymentType]}</Badge>
                {w.paymentAmount > 0 && <span className="text-sm text-emerald-400 font-bold">{formatAmount(w.paymentAmount)}</span>}
              </div>
              <p className="text-xs text-text-muted mt-2">Depuis le {formatDate(w.startDate)}</p>
            </Card>
          ))}
        </AnimatedGrid>
      )}

      {/* Worker form */}
      <Modal open={!!form} onClose={() => setForm(null)} title={editId ? "Modifier l'employé" : "Nouvel employé"} size="md"
        footer={<><button className="btn-ghost" onClick={() => setForm(null)}>Annuler</button><button className="btn-primary" onClick={save}>Enregistrer</button></>}>
        {form && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Nom complet" required><input className="input" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></Field>
              <Field label="Téléphone" required><input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
              <Field label="Date de naissance"><DateInput value={form.birthday || ""} onChange={(v) => setForm({ ...form, birthday: v })} /></Field>
              <Field label="N° CIN"><input className="input" value={form.idCardNumber || ""} onChange={(e) => setForm({ ...form, idCardNumber: e.target.value })} /></Field>
              <div>
                <div className="flex items-center justify-between">
                  <span className="label-caps">Rôle</span>
                  <button type="button" className="text-[0.6rem] text-red-400 hover:text-red-300 uppercase tracking-wider font-bold" onClick={() => setShowNewRole((s) => !s)}>+ Créer un rôle</button>
                </div>
                <select className="input" value={form.roleId || ""} onChange={(e) => setForm({ ...form, roleId: e.target.value })}>
                  <option value="">—</option>
                  {(roles || []).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
                {showNewRole && (
                  <div className="flex gap-2 mt-2">
                    <input className="input flex-1" placeholder="Nom du rôle (ex: Vendeur)" value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)} />
                    <button type="button" className="btn-primary text-xs py-2 px-3" onClick={createRole}>Créer</button>
                  </div>
                )}
              </div>
              <Field label="Date de début"><DateInput value={form.startDate || ""} onChange={(v) => setForm({ ...form, startDate: v })} /></Field>
            </div>
            <div className="flex items-center gap-3 my-2"><span className="label-caps !mb-0">Paiement</span><div className="flex-1 h-px bg-red-600/20" /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Type"><select className="input" value={form.paymentType} onChange={(e) => setForm({ ...form, paymentType: e.target.value })}><option value="NONE">Aucun</option><option value="MONTHLY">Mensuel</option><option value="DAILY">Journalier</option></select></Field>
              {form.paymentType !== "NONE" && <Field label="Montant (DA)"><input className="input" type="number" value={form.paymentAmount || ""} onChange={(e) => setForm({ ...form, paymentAmount: e.target.value })} /></Field>}
            </div>
            <div className="flex items-center justify-between"><span className="label-caps !mb-0">Activer un compte d'accès ?</span><Toggle checked={form.accountEnabled} onChange={(v) => setForm({ ...form, accountEnabled: v })} /></div>
            {form.accountEnabled && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Field label="Email"><input className="input" value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
                <Field label="Nom d'utilisateur"><input className="input" value={form.username || ""} onChange={(e) => setForm({ ...form, username: e.target.value })} /></Field>
                <Field label="Mot de passe"><input className="input" type="password" value={form.password || ""} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* View */}
      <Modal open={!!view} onClose={() => setView(null)} title={view?.fullName || ""} size="md">
        {view && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-x-6">
              {Object.entries({ Téléphone: view.phone, "N° CIN": view.idCardNumber, Rôle: view.role?.name, Paiement: PAY_LABELS[view.paymentType], Montant: view.paymentAmount && formatAmount(view.paymentAmount), Début: formatDate(view.startDate) }).map(([k, v]) => <div key={k} className="flex justify-between text-sm border-b border-red-600/10 py-1.5"><span className="text-text-muted">{k}</span><span className="text-text-primary">{v || "—"}</span></div>)}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Card className="p-3 text-center"><p className="text-base font-black text-amber-400">{formatAmount((view.advances || []).filter((x) => !x.isPaid).reduce((a, x) => a + (x.amount || 0), 0))}</p><p className="label-caps">Acomptes</p></Card>
              <Card className="p-3 text-center"><p className="text-base font-black text-rose-400">{formatAmount((view.absences || []).filter((x) => !x.isPaid).reduce((a, x) => a + (x.cost || 0), 0))}</p><p className="label-caps">Absences</p></Card>
              <Card className="p-3 text-center"><p className="text-base font-black text-emerald-400">{formatAmount((view.payments || []).reduce((a, x) => a + (x.amount || 0), 0))}</p><p className="label-caps">Payé</p></Card>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="heading text-sm text-text-primary">Acomptes en attente</h4>
                {can("workers", "edit") && <button type="button" className="text-[0.7rem] text-red-400 hover:text-red-300 uppercase tracking-wider font-bold" onClick={() => openTransactionEditor("advance", view)}>+ Ajouter</button>}
              </div>
              {payrollCalc(view).advances.length > 0 ? payrollCalc(view).advances.map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-lg border border-red-600/10 bg-black/20 p-2.5">
                  <div>
                    <p className="text-sm font-semibold text-text-primary">{formatAmount(item.amount || 0)}</p>
                    <p className="text-xs text-text-muted">{formatDate(item.date)}{item.description ? ` • ${item.description}` : ""}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {can("workers", "edit") && <button type="button" className="rounded-full p-1.5 text-text-muted hover:bg-red-600/10 hover:text-red-400" onClick={() => openTransactionEditor("advance", view, item)}><Pencil size={14} /></button>}
                    {can("workers", "delete") && <button type="button" className="rounded-full p-1.5 text-text-muted hover:bg-red-600/10 hover:text-red-400" onClick={() => requestDelete("advance", item.id)}><Trash2 size={14} /></button>}
                  </div>
                </div>
              )) : <p className="text-sm text-text-muted">Aucun acompte en attente.</p>}
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="heading text-sm text-text-primary">Absences en attente</h4>
                {can("workers", "edit") && <button type="button" className="text-[0.7rem] text-red-400 hover:text-red-300 uppercase tracking-wider font-bold" onClick={() => openTransactionEditor("absence", view)}>+ Ajouter</button>}
              </div>
              {payrollCalc(view).absences.length > 0 ? payrollCalc(view).absences.map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-lg border border-red-600/10 bg-black/20 p-2.5">
                  <div>
                    <p className="text-sm font-semibold text-text-primary">{formatAmount(item.cost || 0)}</p>
                    <p className="text-xs text-text-muted">{formatDate(item.date)}{item.description ? ` • ${item.description}` : ""}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {can("workers", "edit") && <button type="button" className="rounded-full p-1.5 text-text-muted hover:bg-red-600/10 hover:text-red-400" onClick={() => openTransactionEditor("absence", view, item)}><Pencil size={14} /></button>}
                    {can("workers", "delete") && <button type="button" className="rounded-full p-1.5 text-text-muted hover:bg-red-600/10 hover:text-red-400" onClick={() => requestDelete("absence", item.id)}><Trash2 size={14} /></button>}
                  </div>
                </div>
              )) : <p className="text-sm text-text-muted">Aucune absence en attente.</p>}
            </div>
          </div>
        )}
      </Modal>

      {/* Permissions */}
      <Modal open={!!permWorker} onClose={() => setPermWorker(null)} title={`Permissions — ${permWorker?.fullName || ""}`} size="lg"
        footer={<><button className="btn-ghost" onClick={() => setPermWorker(null)}>Annuler</button><button className="btn-primary" onClick={savePerms}>Enregistrer les permissions</button></>}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1 max-h-80 overflow-y-auto pr-2">
            {SECTIONS.map((s) => {
              const enabled = perms[s] && Object.values(perms[s]).some(Boolean);
              return (
                <button key={s} onClick={() => setActiveSection(s)} className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition ${activeSection === s ? "bg-red-600/15 text-text-primary" : "text-text-muted hover:bg-red-600/8"}`}>
                  <span>{SECTION_LABELS[s]}</span>
                  {enabled && <Badge color="success">Actif</Badge>}
                </button>
              );
            })}
          </div>
          <div className="glass-card p-4">
            {activeSection ? (
              <>
                <h4 className="heading text-xs text-text-primary mb-3">{SECTION_LABELS[activeSection]}</h4>
                <div className="space-y-2">
                  {ACTIONS.map((a) => (
                    <label key={a} className="flex items-center gap-2.5 cursor-pointer">
                      <button type="button" onClick={() => togglePerm(activeSection, a)} className={`w-5 h-5 rounded-md flex items-center justify-center border ${perms[activeSection]?.[a] ? "bg-red-600 border-red-600" : "border-white/20"}`}>{perms[activeSection]?.[a] && <span className="text-white text-xs">✓</span>}</button>
                      <span className="text-sm text-text-primary">{ACTION_LABELS[a]}</span>
                    </label>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-text-muted text-sm">Sélectionnez une section à gauche.</p>
            )}
          </div>
        </div>
      </Modal>

      {/* Advance / Absence / Payment */}
      <Modal open={!!modalKind} onClose={() => setModalKind(null)}
        title={modalKind === "advance" ? "Acompte" : modalKind === "absence" ? "Absence" : "Paiement de salaire"} size="sm"
        footer={<><button className="btn-ghost" onClick={() => setModalKind(null)}>Annuler</button><button className="btn-primary" onClick={submitModal}>Valider</button></>}>
        <div className="space-y-4">
          {modalKind === "payment" && (
            <div className="space-y-3">
              <Card className="p-3 space-y-1.5 text-sm">
                <div className="flex justify-between"><span className="text-text-muted">Salaire de base</span><span className="text-text-primary">{formatAmount(calc.base)}</span></div>
                <div className="flex justify-between"><span className="text-text-muted">Absences en attente</span><span className="text-rose-400">{calc.absenceCount} • {formatAmount(calc.absenceTotal)}</span></div>
                <div className="flex justify-between"><span className="text-text-muted">Acomptes en attente</span><span className="text-amber-400">{calc.advanceCount} • {formatAmount(calc.advanceTotal)}</span></div>
                <div className="flex justify-between pt-1.5 border-t border-red-600/15 font-black"><span className="text-text-primary">Net à payer</span><span className="text-emerald-400">{formatAmount(calc.net)}</span></div>
              </Card>
              {calc.absences.length > 0 && (
                <div className="rounded-lg border border-red-600/10 bg-black/20 p-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-text-muted mb-2">Détails absences</p>
                  <div className="space-y-2">
                    {calc.absences.map((item) => (
                      <div key={item.id} className="flex items-center justify-between text-sm">
                        <span className="text-text-primary">{formatDate(item.date)}{item.description ? ` • ${item.description}` : ""}</span>
                        <span className="text-rose-400">{formatAmount(item.cost || 0)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {calc.advances.length > 0 && (
                <div className="rounded-lg border border-red-600/10 bg-black/20 p-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-text-muted mb-2">Détails acomptes</p>
                  <div className="space-y-2">
                    {calc.advances.map((item) => (
                      <div key={item.id} className="flex items-center justify-between text-sm">
                        <span className="text-text-primary">{formatDate(item.date)}{item.description ? ` • ${item.description}` : ""}</span>
                        <span className="text-amber-400">{formatAmount(item.amount || 0)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <Field label="Date"><DateInput value={modalData.date} onChange={(v) => setModalData({ ...modalData, date: v })} /></Field>
          {modalKind === "absence" ? (
            <Field label="Coût (DA)"><input className="input" type="number" value={modalData.cost} onChange={(e) => setModalData({ ...modalData, cost: e.target.value })} /></Field>
          ) : (
            <Field label="Montant (DA)"><input className="input" type="number" placeholder={modalKind === "payment" ? String(calc.net) : ""} value={modalData.amount} onChange={(e) => setModalData({ ...modalData, amount: e.target.value })} /></Field>
          )}
          {modalKind === "payment" && <Field label="Mois"><input className="input" placeholder="ex: Janvier 2024" value={modalData.month} onChange={(e) => setModalData({ ...modalData, month: e.target.value })} /></Field>}
          <Field label="Description"><input className="input" value={modalData.description} onChange={(e) => setModalData({ ...modalData, description: e.target.value })} /></Field>
        </div>
      </Modal>

      <Modal open={!!transactionEditor} onClose={() => setTransactionEditor(null)}
        title={transactionEditor?.item ? (transactionEditor.kind === "advance" ? "Modifier l'acompte" : "Modifier l'absence") : (transactionEditor?.kind === "advance" ? "Nouvel acompte" : "Nouvelle absence")} size="sm"
        footer={<><button className="btn-ghost" onClick={() => setTransactionEditor(null)}>Annuler</button><button className="btn-primary" onClick={saveTransaction}>Enregistrer</button></>}>
        <div className="space-y-4">
          <Field label="Date"><DateInput value={transactionForm.date} onChange={(v) => setTransactionForm({ ...transactionForm, date: v })} /></Field>
          {transactionEditor?.kind === "advance" ? (
            <Field label="Montant (DA)"><input className="input" type="number" value={transactionForm.amount} onChange={(e) => setTransactionForm({ ...transactionForm, amount: e.target.value })} /></Field>
          ) : (
            <Field label="Coût (DA)"><input className="input" type="number" value={transactionForm.cost} onChange={(e) => setTransactionForm({ ...transactionForm, cost: e.target.value })} /></Field>
          )}
          <Field label="Description"><input className="input" value={transactionForm.description} onChange={(e) => setTransactionForm({ ...transactionForm, description: e.target.value })} /></Field>
        </div>
      </Modal>

      <ConfirmModal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={confirmDelete} title="Confirmer la suppression" message="Cette opération supprimera définitivement l'élément sélectionné." />
    </div>
  );
}
