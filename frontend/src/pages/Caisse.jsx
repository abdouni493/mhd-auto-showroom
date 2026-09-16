import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import {
  Vault, ArrowDownCircle, ArrowUpCircle, Eye, Pencil, Trash2, Printer,
  Tag, ShoppingBag, CircleDollarSign, Briefcase, Handshake, Wallet, Scale,
  TrendingUp, TrendingDown, Search, AlertTriangle,
} from "lucide-react";
import { cashApi, clientsApi } from "../lib/api.js";
import { useFetch } from "../hooks/useApi.js";
import { useCan } from "../lib/permissions.js";
import { useStore } from "../store/useStore.js";
import {
  Card, Badge, Modal, ConfirmModal, Field, EmptyState, SkeletonGrid, useToast,
} from "../components/ui.jsx";
import PageHeader from "../components/PageHeader.jsx";
import ActionMenu from "../components/ActionMenu.jsx";
import SearchSelect from "../components/SearchSelect.jsx";
import { CashTransactionInvoice } from "../components/PrintTemplates.jsx";
import { usePrintDialog } from "../components/PrintChooser.jsx";
import { formatAmount, formatDateTime, toDateTimeLocal } from "../utils/format.js";
import DateInput from "../components/DateInput.jsx";

// The category chips + how each ledger line is coloured / iconed.
const CATEGORIES = {
  cash:       { icon: Wallet,            tint: "text-sky-400",     bg: "bg-sky-500/15" },
  sale:       { icon: Tag,               tint: "text-emerald-400", bg: "bg-emerald-500/15" },
  purchase:   { icon: ShoppingBag,       tint: "text-violet-400",  bg: "bg-violet-500/15" },
  expense:    { icon: CircleDollarSign,  tint: "text-amber-400",   bg: "bg-amber-500/15" },
  payroll:    { icon: Briefcase,         tint: "text-cyan-400",    bg: "bg-cyan-500/15" },
  settlement: { icon: Handshake,         tint: "text-fuchsia-400", bg: "bg-fuchsia-500/15" },
};

export default function Caisse() {
  const { t } = useTranslation();
  const can = useCan();
  const { settings } = useStore();
  const toast = useToast();
  const openPrint = usePrintDialog();

  // The whole money ledger + the raw manual cash rows (for edit / delete / print).
  const { data: ledger, loading, refetch } = useFetch(() => cashApi.ledger(), []);
  const { data: cashRows, refetch: refetchCash } = useFetch(() => cashApi.list({}), []);

  const [category, setCategory] = useState(""); // "" = all
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(null);
  const [editId, setEditId] = useState(null);
  const [viewItem, setViewItem] = useState(null);
  const [deleteId, setDeleteId] = useState(null);

  const totals = ledger?.totals || { totalIn: 0, totalOut: 0, balance: 0, totalPurchases: 0, totalSales: 0, totalDebts: 0, totalGains: 0, byCategory: {} };
  const entries = useMemo(() => {
    let list = ledger?.entries || [];
    if (category) list = list.filter((e) => e.category === category);
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(
        (e) =>
          (e.label || "").toLowerCase().includes(s) ||
          (e.sub || "").toLowerCase().includes(s) ||
          (e.description || "").toLowerCase().includes(s) ||
          (e.reference || "").toLowerCase().includes(s)
      );
    }
    return list;
  }, [ledger, category, search]);

  const cashById = useMemo(() => {
    const m = {};
    for (const r of cashRows || []) m[r.id] = r;
    return m;
  }, [cashRows]);

  const reload = () => { refetch(); refetchCash(); };

  const openNew = (type) => {
    setForm({ type, clientName: "", clientPhone: "", clientId: null, amount: "", description: "", date: toDateTimeLocal(new Date()) });
    setEditId(null);
  };
  const openEditCash = (id) => {
    const x = cashById[id];
    if (!x) return;
    setForm({
      type: x.type, clientName: x.clientName || "", clientPhone: x.clientPhone || "",
      clientId: x.clientId || null, amount: String(x.amount ?? ""), description: x.description || "",
      date: toDateTimeLocal(x.date),
    });
    setEditId(id);
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
    setForm(null); setEditId(null); reload();
    toast(t("caisse.savedToast"));
  };

  const confirmDelete = async () => { await cashApi.delete(deleteId); setDeleteId(null); reload(); toast(t("caisse.deletedToast"), "info"); };

  const printCash = (id) => {
    const x = cashById[id];
    if (x) openPrint((lang) => <CashTransactionInvoice transaction={x} showroom={settings} lang={lang} />);
  };

  const CAT_CHIPS = [
    ["", t("caisse.catAll")],
    ["cash", t("caisse.catCash")],
    ["sale", t("caisse.catSale")],
    ["purchase", t("caisse.catPurchase")],
    ["expense", t("caisse.catExpense")],
    ["payroll", t("caisse.catPayroll")],
    ["settlement", t("caisse.catSettlement")],
  ];

  return (
    <div>
      <PageHeader title={t("nav.caisse")} subtitle={t("caisse.subtitle")} />

      {/* Achats / Ventes / Dettes / Gains */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <Card className="p-4 flex items-center justify-between" style={{ borderLeft: "3px solid #8b5cf6" }}>
          <div><p className="label-caps">{t("caisse.totalPurchases")}</p><p className="text-xl font-black text-violet-300 mt-1">{formatAmount(totals.totalPurchases)}</p></div>
          <ShoppingBag className="text-violet-400" size={26} />
        </Card>
        <Card className="p-4 flex items-center justify-between" style={{ borderLeft: "3px solid #10b981" }}>
          <div><p className="label-caps">{t("caisse.totalSales")}</p><p className="text-xl font-black text-emerald-400 mt-1">{formatAmount(totals.totalSales)}</p></div>
          <Tag className="text-emerald-400" size={26} />
        </Card>
        <Card className="p-4 flex items-center justify-between" style={{ borderLeft: "3px solid #fb7185" }}>
          <div><p className="label-caps">{t("caisse.totalDebts")}</p><p className="text-xl font-black text-rose-300 mt-1">{formatAmount(totals.totalDebts)}</p></div>
          <AlertTriangle className="text-rose-300" size={26} />
        </Card>
        <Card className="p-4 flex items-center justify-between" style={{ borderLeft: "3px solid #dc2626" }}>
          <div><p className="label-caps">{t("caisse.totalGains")}</p><p className={`text-xl font-black mt-1 ${totals.totalGains >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{totals.totalGains >= 0 ? "+" : ""}{formatAmount(totals.totalGains)}</p></div>
          <TrendingUp className={totals.totalGains >= 0 ? "text-emerald-400" : "text-rose-400"} size={26} />
        </Card>
      </div>

      {/* Category totals */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 mb-6">
        {["cash", "sale", "purchase", "expense", "payroll", "settlement"].map((k) => {
          const meta = CATEGORIES[k];
          const Icon = meta.icon;
          return (
            <button
              key={k}
              onClick={() => setCategory(category === k ? "" : k)}
              className={`glass-card p-3 text-left rtl:text-right border transition ${category === k ? "border-red-600/60" : "border-white/5"}`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className={`p-1.5 rounded-lg ${meta.bg} ${meta.tint}`}><Icon size={14} /></span>
                <span className="label-caps !mb-0">{t(`caisse.cat${k.charAt(0).toUpperCase() + k.slice(1)}`)}</span>
              </div>
              <p className="text-sm font-black text-text-primary">{formatAmount(totals.byCategory?.[k] || 0)}</p>
            </button>
          );
        })}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5 items-start">
        <div className="flex flex-wrap gap-2">
          {CAT_CHIPS.map(([k, label]) => (
            <button key={k} className={`chip ${category === k ? "chip-active" : ""}`} onClick={() => setCategory(k)}>{label}</button>
          ))}
        </div>
        <div className="relative flex-1 sm:max-w-xs sm:ml-auto rtl:sm:ml-0 rtl:sm:mr-auto">
          <Search className="absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
          <input className="input pl-9 rtl:pl-3 rtl:pr-9" placeholder={t("caisse.searchPlaceholder")} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {can("caisse", "create") && (
          <div className="flex gap-2">
            <button className="btn-ghost text-xs" onClick={() => openNew("DEPOSIT")}><ArrowDownCircle size={14} /> {t("caisse.newDeposit")}</button>
            <button className="btn-ghost text-xs" onClick={() => openNew("WITHDRAWAL")}><ArrowUpCircle size={14} /> {t("caisse.newWithdrawal")}</button>
          </div>
        )}
      </div>

      {/* Ledger */}
      {loading ? <SkeletonGrid /> : entries.length === 0 ? (
        <EmptyState icon={Vault} message={t("caisse.noTransactions")} />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left rtl:text-right bg-red-600/10 border-b border-red-600/30">
                {[t("common.date"), t("caisse.colType"), t("caisse.colLabel"), t("caisse.colRef"), t("common.amount"), ""].map((h, i) => (
                  <th key={i} className="p-3 label-caps !text-red-300/80">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => {
                const meta = CATEGORIES[e.category] || CATEGORIES.cash;
                const Icon = meta.icon;
                const isCash = e.category === "cash";
                const rawId = isCash ? Number(String(e.id).replace("cash-", "")) : null;
                return (
                  <motion.tr
                    key={e.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i, 20) * 0.02 }}
                    className={`border-b border-red-600/10 hover:bg-red-600/8 ${i % 2 ? "bg-white/[0.015]" : ""}`}
                  >
                    <td className="p-3 text-text-muted whitespace-nowrap">{formatDateTime(e.date)}</td>
                    <td className="p-3">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold ${meta.bg} ${meta.tint}`}>
                        <Icon size={12} /> {t(`caisse.cat${e.category.charAt(0).toUpperCase() + e.category.slice(1)}`)}
                      </span>
                    </td>
                    <td className="p-3">
                      <p className="text-text-primary">{e.label}</p>
                      {e.sub && <p className="text-xs text-text-muted">{e.sub}</p>}
                    </td>
                    <td className="p-3 font-mono text-xs text-text-muted">{e.reference || "—"}</td>
                    <td className={`p-3 font-black whitespace-nowrap ${e.dir === "IN" ? "text-emerald-400" : "text-rose-300"}`}>
                      {e.dir === "IN" ? "+ " : "− "}{formatAmount(e.amount)}
                    </td>
                    <td className="p-3">
                      <ActionMenu items={[
                        { label: t("common.view"), icon: Eye, onClick: () => setViewItem(e) },
                        isCash && can("caisse", "print") && { label: t("common.print"), icon: Printer, onClick: () => printCash(rawId) },
                        isCash && can("caisse", "edit") && { label: t("common.edit"), icon: Pencil, onClick: () => openEditCash(rawId) },
                        isCash && can("caisse", "delete") && { label: t("common.delete"), icon: Trash2, danger: true, onClick: () => setDeleteId(rawId) },
                      ]} />
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {/* Create / Edit manual cash movement */}
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

      {/* View any ledger line */}
      <Modal open={!!viewItem} onClose={() => setViewItem(null)} title={t("common.details")} size="sm">
        {viewItem && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge color={viewItem.dir === "IN" ? "success" : "debt"}>{viewItem.dir === "IN" ? t("caisse.moneyIn") : t("caisse.moneyOut")}</Badge>
              {viewItem.reference && <span className="text-xs text-text-muted font-mono">{viewItem.reference}</span>}
            </div>
            <div className="grid grid-cols-1">
              {Object.entries({
                [t("caisse.colType")]: t(`caisse.cat${viewItem.category.charAt(0).toUpperCase() + viewItem.category.slice(1)}`),
                [t("caisse.colLabel")]: viewItem.label,
                ...(viewItem.sub ? { [t("common.details")]: viewItem.sub } : {}),
                [t("common.amount")]: `${viewItem.dir === "IN" ? "+ " : "− "}${formatAmount(viewItem.amount)}`,
                [t("common.datetime")]: formatDateTime(viewItem.date),
                ...(viewItem.description ? { [t("common.description")]: viewItem.description } : {}),
              }).map(([k, v]) => (
                <div key={k} className="flex justify-between text-sm border-b border-red-600/10 py-1.5"><span className="text-text-muted">{k}</span><span className="text-text-primary text-right">{v || "—"}</span></div>
              ))}
            </div>
          </div>
        )}
      </Modal>

      <ConfirmModal open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={confirmDelete} />
    </div>
  );
}
