import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import {
  Vault, ArrowDownCircle, ArrowUpCircle, Eye, Pencil, Trash2, Printer,
  Tag, ShoppingBag, CircleDollarSign, Briefcase, Handshake, Wallet, Scale,
  TrendingUp, TrendingDown, Search, AlertTriangle, HandCoins,
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
import { BeneficeSheet } from "../components/PrintDocs.jsx";
import { usePrintDialog } from "../components/PrintChooser.jsx";
import { formatAmount, formatDateTime, formatDate, toDateTimeLocal } from "../utils/format.js";
import DateInput from "../components/DateInput.jsx";

// The category chips + how each ledger line is coloured / iconed.
// `benefice` is not a ledger line but a filter of its own: it swaps the ledger
// table for the per-sale gains of the showroom.
const CATEGORIES = {
  benefice:   { icon: TrendingUp,        tint: "text-emerald-400", bg: "bg-emerald-500/15" },
  cash:       { icon: Wallet,            tint: "text-sky-400",     bg: "bg-sky-500/15" },
  sale:       { icon: Tag,               tint: "text-emerald-400", bg: "bg-emerald-500/15" },
  purchase:   { icon: ShoppingBag,       tint: "text-violet-400",  bg: "bg-violet-500/15" },
  expense:    { icon: CircleDollarSign,  tint: "text-amber-400",   bg: "bg-amber-500/15" },
  payroll:    { icon: Briefcase,         tint: "text-cyan-400",    bg: "bg-cyan-500/15" },
  settlement: { icon: Handshake,         tint: "text-fuchsia-400", bg: "bg-fuchsia-500/15" },
};

const carLabel = (c) => [c?.brand, c?.model].filter(Boolean).join(" ").trim();
const personLabel = (c) => `${c?.firstName || ""} ${c?.lastName || ""}`.trim();

export default function Caisse() {
  const { t } = useTranslation();
  const can = useCan();
  const { settings } = useStore();
  const toast = useToast();
  const openPrint = usePrintDialog();

  // The whole money ledger + the raw manual cash rows (for edit / delete / print).
  const { data: ledger, loading, refetch } = useFetch(() => cashApi.ledger(), []);
  const { data: cashRows, refetch: refetchCash } = useFetch(() => cashApi.list({}), []);

  const [category, setCategory] = useState(""); // "" = all, "benefice" = gains view
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(null);
  const [editId, setEditId] = useState(null);
  const [viewItem, setViewItem] = useState(null);
  const [viewGain, setViewGain] = useState(null);
  const [deleteId, setDeleteId] = useState(null);

  const showGains = category === "benefice";

  const totals = ledger?.totals || { totalIn: 0, totalOut: 0, balance: 0, totalPurchases: 0, totalSales: 0, totalDebts: 0, totalGains: 0, byCategory: {} };
  const entries = useMemo(() => {
    let list = ledger?.entries || [];
    if (category && category !== "benefice") list = list.filter((e) => e.category === category);
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

  // One record per sale — the gain the showroom made on it, normal sale or
  // prestation (vehicle left by its owner).
  const gains = useMemo(() => {
    let list = ledger?.gains || [];
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(
        (g) =>
          carLabel(g.car).toLowerCase().includes(s) ||
          (g.car?.plate || "").toLowerCase().includes(s) ||
          personLabel(g.client).toLowerCase().includes(s) ||
          personLabel(g.owner).toLowerCase().includes(s) ||
          (g.reference || "").toLowerCase().includes(s)
      );
    }
    return list;
  }, [ledger, search]);

  const gainsTotal = useMemo(() => gains.reduce((a, g) => a + (Number(g.gain) || 0), 0), [gains]);

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

  // The bénéfice sheet of one sale — showroom header, vehicle, buyer, the whole
  // computation and the net gain.
  const printGain = (g) =>
    openPrint((lang) => <BeneficeSheet gain={g} showroom={settings} lang={lang} />);

  const CAT_CHIPS = [
    ["", t("caisse.catAll")],
    ["benefice", t("caisse.catBenefice")],
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
        {["benefice", "sale", "purchase", "expense", "payroll", "settlement"].map((k) => {
          const meta = CATEGORIES[k];
          const Icon = meta.icon;
          const value = totals.byCategory?.[k] || 0;
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
              <p className={`text-sm font-black ${k === "benefice" ? (value >= 0 ? "text-emerald-400" : "text-rose-400") : "text-text-primary"}`}>
                {k === "benefice" && value >= 0 ? "+" : ""}{formatAmount(value)}
              </p>
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
          <input
            className="input pl-9 rtl:pl-3 rtl:pr-9"
            placeholder={showGains ? t("caisse.beneficeSearch") : t("caisse.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {!showGains && can("caisse", "create") && (
          <div className="flex gap-2">
            <button className="btn-ghost text-xs" onClick={() => openNew("DEPOSIT")}><ArrowDownCircle size={14} /> {t("caisse.newDeposit")}</button>
            <button className="btn-ghost text-xs" onClick={() => openNew("WITHDRAWAL")}><ArrowUpCircle size={14} /> {t("caisse.newWithdrawal")}</button>
          </div>
        )}
      </div>

      {/* ── Bénéfice : one line per sale, with its own gain ─────────────── */}
      {showGains ? (
        loading ? <SkeletonGrid /> : gains.length === 0 ? (
          <EmptyState icon={TrendingUp} message={t("caisse.noGains")} />
        ) : (
          <>
            <p className="text-xs text-text-muted mb-3">
              {t("caisse.gainsCount", { count: gains.length, total: formatAmount(gainsTotal) })}
            </p>
            <Card className="overflow-x-auto p-0">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="text-left rtl:text-right bg-red-600/10 border-b border-red-600/30">
                    {[
                      t("common.date"), t("caisse.colType"), t("caisse.colVehicle"), t("caisse.colClient"),
                      t("caisse.colSalePrice"), t("caisse.colCost"), t("caisse.colGain"), "",
                    ].map((h, i) => (
                      <th key={i} className="p-3 label-caps !text-red-300/80">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {gains.map((g, i) => {
                    const prestation = g.kind === "PRESTATION";
                    const positive = (Number(g.gain) || 0) >= 0;
                    return (
                      <motion.tr
                        key={g.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(i, 20) * 0.02 }}
                        className={`border-b border-red-600/10 hover:bg-red-600/8 ${i % 2 ? "bg-white/[0.015]" : ""}`}
                      >
                        <td className="p-3 text-text-muted whitespace-nowrap">{formatDate(g.date)}</td>
                        <td className="p-3">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold ${
                            prestation ? "bg-fuchsia-500/15 text-fuchsia-400" : "bg-emerald-500/15 text-emerald-400"
                          }`}>
                            {prestation ? <Handshake size={12} /> : <Tag size={12} />}
                            {prestation ? t("caisse.kindPrestation") : t("caisse.kindNormal")}
                          </span>
                        </td>
                        <td className="p-3">
                          <p className="text-text-primary">{carLabel(g.car) || "—"}</p>
                          <p className="text-xs text-text-muted font-mono">{g.car?.plate || g.reference || "—"}</p>
                        </td>
                        <td className="p-3">
                          <p className="text-text-primary">{personLabel(g.client) || "—"}</p>
                          {prestation && g.owner && (
                            <p className="text-xs text-text-muted">{t("caisse.owner")} : {personLabel(g.owner)}</p>
                          )}
                        </td>
                        <td className="p-3 whitespace-nowrap text-text-primary">{formatAmount(g.salePrice)}</td>
                        <td className="p-3 whitespace-nowrap text-text-muted">
                          {prestation ? formatAmount(g.showroomShare) : formatAmount(g.totalCost)}
                          <span className="block text-[10px] text-amber-400/80">
                            {t("caisse.carExpenses")} : {formatAmount(g.carExpenses)}
                          </span>
                        </td>
                        <td className={`p-3 font-black whitespace-nowrap ${positive ? "text-emerald-400" : "text-rose-400"}`}>
                          {positive ? "+ " : "− "}{formatAmount(Math.abs(Number(g.gain) || 0))}
                          <span className="block text-[10px] font-normal text-text-muted">
                            {t("caisse.margin")} : {(Number(g.margin) || 0).toFixed(1)} %
                          </span>
                        </td>
                        <td className="p-3">
                          <ActionMenu items={[
                            { label: t("common.view"), icon: Eye, onClick: () => setViewGain(g) },
                            can("caisse", "print") && { label: t("common.print"), icon: Printer, onClick: () => printGain(g) },
                          ]} />
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          </>
        )
      ) : loading ? <SkeletonGrid /> : entries.length === 0 ? (
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

      {/* View one selling gain — the whole computation, sale by sale */}
      <Modal
        open={!!viewGain}
        onClose={() => setViewGain(null)}
        title={t("caisse.gainDetail")}
        size="md"
        footer={
          <>
            <button className="btn-ghost" onClick={() => setViewGain(null)}>{t("common.close")}</button>
            {can("caisse", "print") && (
              <button className="btn-primary" onClick={() => { const g = viewGain; setViewGain(null); printGain(g); }}>
                <Printer size={15} /> {t("caisse.printBenefice")}
              </button>
            )}
          </>
        }
      >
        {viewGain && <GainDetail gain={viewGain} t={t} />}
      </Modal>

      <ConfirmModal open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={confirmDelete} />
    </div>
  );
}

// ── Gain detail — every number that makes up the bénéfice of one sale ───────
function GainDetail({ gain: g, t }) {
  const prestation = g.kind === "PRESTATION";
  const positive = (Number(g.gain) || 0) >= 0;
  const expenses = Array.isArray(g.expensesList) ? g.expensesList : [];

  const cell = (label, value, cls = "text-text-primary") => (
    <div className="bg-white/5 p-2.5 rounded-lg border border-white/5">
      <p className="text-text-muted text-[10px]">{label}</p>
      <p className={`font-bold mt-0.5 ${cls}`}>{value}</p>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Identity of the sale */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge color={prestation ? "info" : "success"}>
          {prestation ? t("caisse.kindPrestation") : t("caisse.kindNormal")}
        </Badge>
        {g.reference && <span className="text-xs text-text-muted font-mono">{g.reference}</span>}
        <span className="text-xs text-text-muted">{formatDateTime(g.date)}</span>
      </div>

      {/* Vehicle + parties */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
        {cell(t("caisse.colVehicle"), `${carLabel(g.car) || "—"}${g.car?.plate ? ` · ${g.car.plate}` : ""}`)}
        {cell(t("caisse.colClient"), personLabel(g.client) || "—")}
        {prestation && cell(t("caisse.owner"), personLabel(g.owner) || "—")}
        {cell(t("caisse.collected"), `${formatAmount(g.amountPaid)} / ${formatAmount(g.salePrice)}`,
          Number(g.amountRest) > 0 ? "text-rose-300" : "text-emerald-400")}
      </div>

      {/* The computation */}
      <div className="glass-card p-3.5 rounded-xl border border-red-600/20 bg-gradient-to-r from-red-950/30 via-black/40 to-red-950/20 space-y-2.5">
        <span className="text-xs label-caps !mb-0 text-red-300">{t("caisse.gainDetail")}</span>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          {cell(t("caisse.colSalePrice"), formatAmount(g.salePrice))}
          {prestation
            ? cell(t("caisse.showroomShare"), formatAmount(g.showroomShare))
            : cell(t("caisse.purchasePrice"), formatAmount(g.purchasePrice))}
          {cell(t("caisse.carExpenses"), formatAmount(g.carExpenses), "text-amber-400")}
          {prestation
            ? cell(t("caisse.ownerAmount"), formatAmount(g.ownerAmount), "text-fuchsia-300")
            : cell(t("caisse.totalCost"), formatAmount(g.totalCost))}
        </div>

        <div className={`flex items-center justify-between rounded-lg px-3 py-2.5 border ${
          positive ? "bg-emerald-500/10 border-emerald-500/25" : "bg-rose-500/10 border-rose-500/25"
        }`}>
          <span className="flex items-center gap-2 text-xs label-caps !mb-0">
            {positive ? <TrendingUp size={14} className="text-emerald-400" /> : <TrendingDown size={14} className="text-rose-400" />}
            {t("caisse.colGain")} · {t("caisse.margin")} {(Number(g.margin) || 0).toFixed(1)} %
          </span>
          <span className={`font-black text-lg ${positive ? "text-emerald-400" : "text-rose-400"}`}>
            {positive ? "+ " : "− "}{formatAmount(Math.abs(Number(g.gain) || 0))}
          </span>
        </div>
      </div>

      {/* Owner settlement state (prestation only) */}
      {prestation && (
        <div className="glass-card p-3 rounded-xl border border-amber-500/25 bg-amber-500/5 flex items-center justify-between">
          <span className="flex items-center gap-2 text-xs text-amber-400">
            <HandCoins size={14} /> {t("caisse.settlementState")}
          </span>
          <Badge color={g.settled ? "success" : "warning"}>
            {g.settled ? t("caisse.settlementDone") : t("caisse.settlementPending")}
          </Badge>
        </div>
      )}

      {/* Expenses that ate into the gain */}
      <div>
        <p className="label-caps">{t("caisse.expensesDetail")}</p>
        {expenses.length === 0 ? (
          <p className="text-xs text-text-muted">{t("caisse.noExpense")}</p>
        ) : (
          <div className="space-y-1">
            {expenses.map((e, i) => (
              <div key={e.id ?? i} className="flex justify-between text-sm border-b border-red-600/10 py-1.5">
                <span className="text-text-primary">
                  {e.name || "—"}
                  <span className="text-xs text-text-muted ltr:ml-2 rtl:mr-2">{formatDate(e.date)}</span>
                </span>
                <span className="text-amber-400 font-bold">{formatAmount(e.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
