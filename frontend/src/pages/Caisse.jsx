import { useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import {
  Lock, Vault, ArrowDownCircle, ArrowUpCircle, Eye, Pencil, Trash2,
  Printer, ShieldCheck,
} from "lucide-react";
import { cashApi, clientsApi, auth } from "../lib/api.js";
import { useFetch } from "../hooks/useApi.js";
import { useCan } from "../lib/permissions.js";
import { useStore } from "../store/useStore.js";
import {
  Card, Badge, Modal, ConfirmModal, Field, EmptyState, SkeletonGrid, AnimatedGrid, useToast,
} from "../components/ui.jsx";
import PageHeader from "../components/PageHeader.jsx";
import ActionMenu from "../components/ActionMenu.jsx";
import SearchSelect from "../components/SearchSelect.jsx";
import { CashTransactionInvoice } from "../components/PrintTemplates.jsx";
import { usePrintDialog } from "../components/PrintChooser.jsx";
import { formatAmount, formatDateTime, toDateTimeLocal } from "../utils/format.js";
import DateInput from "../components/DateInput.jsx";

const UNLOCK_KEY = "caisse-unlocked";

// ── Admin-password gate ───────────────────────────────────────────────────
function LockScreen({ onUnlock }) {
  const { t } = useTranslation();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e?.preventDefault?.();
    if (!password) return;
    setLoading(true);
    setError("");
    try {
      const ok = await auth.verifyPassword(password);
      if (ok) {
        sessionStorage.setItem(UNLOCK_KEY, "1");
        onUnlock();
      } else {
        setError(t("caisse.wrongPassword"));
      }
    } catch {
      setError(t("caisse.wrongPassword"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <motion.form
        onSubmit={submit}
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 24 }}
        className="glass-panel w-full max-w-sm p-7 text-center"
      >
        <motion.div
          className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-red-600 to-red-900 flex items-center justify-center"
          animate={{ boxShadow: ["0 0 0px rgba(220,38,38,0)", "0 0 28px rgba(220,38,38,0.45)", "0 0 0px rgba(220,38,38,0)"] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        >
          <Lock size={28} className="text-white" />
        </motion.div>
        <h2 className="heading text-xl text-text-primary mb-1">{t("caisse.lockTitle")}</h2>
        <p className="text-sm text-text-muted mb-5">{t("caisse.lockDesc")}</p>

        <Field label={t("caisse.passwordLabel")}>
          <input
            className="input text-center"
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </Field>
        {error && <p className="text-rose-400 text-xs mt-2">{error}</p>}

        <button type="submit" className="btn-primary w-full mt-5 justify-center" disabled={loading}>
          <ShieldCheck size={16} /> {loading ? "..." : t("caisse.unlock")}
        </button>
      </motion.form>
    </div>
  );
}

// ── Caisse content (after unlock) ─────────────────────────────────────────
function CaisseContent() {
  const { t } = useTranslation();
  const can = useCan();
  const { settings } = useStore();
  const toast = useToast();
  const openPrint = usePrintDialog();

  const [tab, setTab] = useState("DEPOSIT"); // DEPOSIT | WITHDRAWAL
  const [search, setSearch] = useState("");
  const { data: all, loading, refetch } = useFetch(() => cashApi.list({ search }), [search]);

  const [form, setForm] = useState(null); // { type, clientName, clientPhone, clientId, amount, description, date }
  const [editId, setEditId] = useState(null);
  const [viewItem, setViewItem] = useState(null);
  const [deleteId, setDeleteId] = useState(null);

  const list = (all || []).filter((x) => x.type === tab);
  const totalDeposits = (all || []).filter((x) => x.type === "DEPOSIT").reduce((a, x) => a + (x.amount || 0), 0);
  const totalWithdrawals = (all || []).filter((x) => x.type === "WITHDRAWAL").reduce((a, x) => a + (x.amount || 0), 0);
  const balance = totalDeposits - totalWithdrawals;

  const openNew = (type) => {
    setForm({ type, clientName: "", clientPhone: "", clientId: null, amount: "", description: "", date: toDateTimeLocal(new Date()) });
    setEditId(null);
  };
  const openEdit = (x) => {
    setForm({
      type: x.type, clientName: x.clientName || "", clientPhone: x.clientPhone || "",
      clientId: x.clientId || null, amount: String(x.amount ?? ""), description: x.description || "",
      date: toDateTimeLocal(x.date),
    });
    setEditId(x.id);
  };

  const pickClient = (c) =>
    setForm((f) => ({ ...f, clientId: c.id, clientName: `${c.firstName || ""} ${c.lastName || ""}`.trim(), clientPhone: c.phonePrimary || "" }));

  const save = async () => {
    if (!form.amount || Number(form.amount) <= 0) { toast(t("caisse.amountRequired"), "error"); return; }
    if (form.type === "DEPOSIT" && !form.clientName.trim()) { toast(t("caisse.nameRequired"), "error"); return; }
    const payload = {
      type: form.type,
      clientId: form.type === "DEPOSIT" ? form.clientId : null,
      clientName: form.type === "DEPOSIT" ? form.clientName.trim() : null,
      clientPhone: form.type === "DEPOSIT" ? form.clientPhone.trim() : null,
      amount: Number(form.amount),
      description: form.description,
      date: new Date(form.date).toISOString(),
    };
    if (editId) await cashApi.update(editId, payload);
    else await cashApi.create(payload);
    setForm(null); setEditId(null); refetch();
    toast(t("caisse.savedToast"));
  };

  const confirmDelete = async () => { await cashApi.delete(deleteId); setDeleteId(null); refetch(); toast(t("caisse.deletedToast"), "info"); };

  const doPrint = (x) => openPrint((lang) => <CashTransactionInvoice transaction={x} showroom={settings} lang={lang} />);

  const menuItems = (x) => [
    { label: t("common.view"), icon: Eye, onClick: () => setViewItem(x) },
    can("caisse", "edit") && { label: t("common.edit"), icon: Pencil, onClick: () => openEdit(x) },
    can("caisse", "print") && { label: t("common.print"), icon: Printer, onClick: () => doPrint(x) },
    can("caisse", "delete") && { label: t("common.delete"), icon: Trash2, danger: true, onClick: () => setDeleteId(x.id) },
  ];

  const isDeposit = tab === "DEPOSIT";

  return (
    <div>
      <PageHeader
        title={t("nav.caisse")}
        action={can("caisse", "create") ? () => openNew(tab) : undefined}
        actionLabel={isDeposit ? t("caisse.newDeposit") : t("caisse.newWithdrawal")}
      />

      {/* Totals */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card className="p-4 flex items-center justify-between" style={{ borderLeft: "3px solid #10b981" }}>
          <div><p className="label-caps">{t("caisse.totalDeposits")}</p><p className="text-xl font-black text-emerald-400 mt-1">{formatAmount(totalDeposits)}</p></div>
          <ArrowDownCircle className="text-emerald-400" size={26} />
        </Card>
        <Card className="p-4 flex items-center justify-between" style={{ borderLeft: "3px solid #fb7185" }}>
          <div><p className="label-caps">{t("caisse.totalWithdrawals")}</p><p className="text-xl font-black text-rose-300 mt-1">{formatAmount(totalWithdrawals)}</p></div>
          <ArrowUpCircle className="text-rose-300" size={26} />
        </Card>
        <Card className="p-4 flex items-center justify-between" style={{ borderLeft: "3px solid #dc2626" }}>
          <div><p className="label-caps">{t("caisse.balance")}</p><p className={`text-xl font-black mt-1 ${balance >= 0 ? "text-text-primary" : "text-rose-400"}`}>{formatAmount(balance)}</p></div>
          <Vault className="text-red-400" size={26} />
        </Card>
      </div>

      {/* Tabs + search */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6 items-start">
        <div className="flex gap-2">
          <button className={`chip ${isDeposit ? "chip-active" : ""}`} onClick={() => setTab("DEPOSIT")}><ArrowDownCircle size={13} /> {t("caisse.tabDeposits")}</button>
          <button className={`chip ${!isDeposit ? "chip-active" : ""}`} onClick={() => setTab("WITHDRAWAL")}><ArrowUpCircle size={13} /> {t("caisse.tabWithdrawals")}</button>
        </div>
        <input className="input sm:max-w-xs sm:ml-auto rtl:sm:ml-0 rtl:sm:mr-auto" placeholder={t("caisse.searchPlaceholder")} value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {loading ? <SkeletonGrid /> : list.length === 0 ? (
        <EmptyState icon={Vault} message={t("caisse.noTransactions")} cta={can("caisse", "create") ? (isDeposit ? t("caisse.newDeposit") : t("caisse.newWithdrawal")) : undefined} onCta={() => openNew(tab)} />
      ) : (
        <AnimatedGrid className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map((x) => (
            <Card key={x.id} className="p-4">
              <div className="flex justify-between items-start gap-2">
                <div className="min-w-0">
                  <p className="text-xs text-text-muted font-mono">{x.reference}</p>
                  <p className="heading text-sm text-text-primary truncate mt-0.5">
                    {isDeposit ? (x.clientName || "—") : (x.description || t("caisse.withdrawal"))}
                  </p>
                  {isDeposit && x.clientPhone && <p className="text-xs text-text-muted">{x.clientPhone}</p>}
                </div>
                <ActionMenu items={menuItems(x)} />
              </div>
              {isDeposit && x.description && <p className="text-xs text-text-muted truncate mt-1">{x.description}</p>}
              <div className="flex justify-between items-end mt-3">
                <span className={`text-lg font-black ${isDeposit ? "text-emerald-400" : "text-rose-300"}`}>
                  {isDeposit ? "+" : "−"} {formatAmount(x.amount)}
                </span>
                <span className="text-xs text-text-muted">{formatDateTime(x.date)}</span>
              </div>
            </Card>
          ))}
        </AnimatedGrid>
      )}

      {/* Create / Edit modal */}
      <Modal
        open={!!form}
        onClose={() => { setForm(null); setEditId(null); }}
        title={form ? (form.type === "DEPOSIT" ? (editId ? t("caisse.editDeposit") : t("caisse.newDeposit")) : (editId ? t("caisse.editWithdrawal") : t("caisse.newWithdrawal"))) : ""}
        size="sm"
        footer={<><button className="btn-ghost" onClick={() => { setForm(null); setEditId(null); }}>{t("common.cancel")}</button><button className="btn-primary" onClick={save}>{t("common.save")}</button></>}
      >
        {form && (
          <div className="space-y-4">
            {form.type === "DEPOSIT" && (
              <>
                <div>
                  <p className="label-caps">{t("caisse.existingClient")}</p>
                  <SearchSelect
                    fetcher={(q) => clientsApi.search(q)}
                    placeholder={t("caisse.searchClient")}
                    onSelect={pickClient}
                    renderItem={(c) => (
                      <div><p className="text-sm text-text-primary">{c.firstName} {c.lastName}</p><p className="text-xs text-text-muted">{c.phonePrimary}</p></div>
                    )}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label={t("caisse.clientName")} required><input className="input" value={form.clientName} onChange={(e) => setForm({ ...form, clientName: e.target.value, clientId: null })} /></Field>
                  <Field label={t("caisse.clientPhone")}><input className="input" value={form.clientPhone} onChange={(e) => setForm({ ...form, clientPhone: e.target.value, clientId: null })} /></Field>
                </div>
              </>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label={t("common.amount")} required><input className="input" type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></Field>
              <Field label={t("common.datetime")}><DateInput withTime value={form.date} onChange={(v) => setForm({ ...form, date: v })} /></Field>
            </div>
            <Field label={t("common.description")}><textarea className="input min-h-[80px]" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          </div>
        )}
      </Modal>

      {/* View modal */}
      <Modal open={!!viewItem} onClose={() => setViewItem(null)} title={t("common.details")} size="sm">
        {viewItem && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge color={viewItem.type === "DEPOSIT" ? "success" : "debt"}>{viewItem.type === "DEPOSIT" ? t("caisse.deposit") : t("caisse.withdrawal")}</Badge>
              <span className="text-xs text-text-muted font-mono">{viewItem.reference}</span>
            </div>
            <div className="grid grid-cols-1">
              {Object.entries({
                ...(viewItem.type === "DEPOSIT" ? { [t("caisse.clientName")]: viewItem.clientName, [t("caisse.clientPhone")]: viewItem.clientPhone } : {}),
                [t("common.amount")]: formatAmount(viewItem.amount),
                [t("common.datetime")]: formatDateTime(viewItem.date),
                [t("common.description")]: viewItem.description,
              }).map(([k, v]) => (
                <div key={k} className="flex justify-between text-sm border-b border-red-600/10 py-1.5"><span className="text-text-muted">{k}</span><span className="text-text-primary text-right">{v || "—"}</span></div>
              ))}
            </div>
            <button className="btn-ghost w-full justify-center" onClick={() => doPrint(viewItem)}><Printer size={14} /> {t("common.print")}</button>
          </div>
        )}
      </Modal>

      <ConfirmModal open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={confirmDelete} />
    </div>
  );
}

export default function Caisse() {
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem(UNLOCK_KEY) === "1");
  if (!unlocked) return <LockScreen onUnlock={() => setUnlocked(true)} />;
  return <CaisseContent />;
}
