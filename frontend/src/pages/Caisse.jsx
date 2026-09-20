import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import {
  Vault, ArrowDownCircle, ArrowUpCircle, Eye, Pencil, Trash2, Printer,
  Tag, ShoppingBag, CircleDollarSign, Briefcase, Handshake, Wallet, Scale,
  TrendingUp, TrendingDown, Search, AlertTriangle, HandCoins, CalendarRange, RotateCcw,
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
import { CashTransactionInvoice, PeriodReport } from "../components/PrintTemplates.jsx";
import { BeneficeSheet } from "../components/PrintDocs.jsx";
import { usePrintDialog } from "../components/PrintChooser.jsx";
import { formatAmount, formatDateTime, formatDate, toDateTimeLocal, toDateInput } from "../utils/format.js";
import DateInput from "../components/DateInput.jsx";

// The category chips + how each ledger line is coloured / iconed.
// `benefice` and `net` are not ledger lines but filters of their own: they swap
// the ledger table for the per-sale gains of the showroom (bénéfice) and for the
// net result of the caisse (gains − dépenses).
const CATEGORIES = {
  benefice:   { icon: TrendingUp,        tint: "text-emerald-400", bg: "bg-emerald-500/15" },
  net:        { icon: Scale,             tint: "text-red-400",     bg: "bg-red-500/15" },
  cash:       { icon: Wallet,            tint: "text-sky-400",     bg: "bg-sky-500/15" },
  sale:       { icon: Tag,               tint: "text-emerald-400", bg: "bg-emerald-500/15" },
  purchase:   { icon: ShoppingBag,       tint: "text-violet-400",  bg: "bg-violet-500/15" },
  expense:    { icon: CircleDollarSign,  tint: "text-amber-400",   bg: "bg-amber-500/15" },
  payroll:    { icon: Briefcase,         tint: "text-cyan-400",    bg: "bg-cyan-500/15" },
  settlement: { icon: Handshake,         tint: "text-fuchsia-400", bg: "bg-fuchsia-500/15" },
};

const carLabel = (c) => [c?.brand, c?.model].filter(Boolean).join(" ").trim();
const personLabel = (c) => `${c?.firstName || ""} ${c?.lastName || ""}`.trim();

// Quick period buttons offered next to the two date pickers.
function periodPresets(t) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  return [
    { key: "month", label: t("caisse.presetThisMonth"), from: new Date(y, m, 1), to: now },
    { key: "last", label: t("caisse.presetLastMonth"), from: new Date(y, m - 1, 1), to: new Date(y, m, 0) },
    { key: "year", label: t("caisse.presetThisYear"), from: new Date(y, 0, 1), to: now },
    { key: "12m", label: t("caisse.presetLast12"), from: new Date(y, m - 11, 1), to: now },
  ].map((p) => ({ key: p.key, label: p.label, from: toDateInput(p.from), to: toDateInput(p.to) }));
}

export default function Caisse() {
  const { t } = useTranslation();
  const can = useCan();
  const { settings } = useStore();
  const toast = useToast();
  const openPrint = usePrintDialog();

  // The whole money ledger + the raw manual cash rows (for edit / delete / print).
  const { data: ledger, loading, refetch } = useFetch(() => cashApi.ledger(), []);
  const { data: cashRows, refetch: refetchCash } = useFetch(() => cashApi.list({}), []);

  const [category, setCategory] = useState(""); // "" = all, "benefice" / "net" = own views
  const [search, setSearch] = useState("");
  // Period filter — empty = every record ever entered.
  const [range, setRange] = useState({ from: "", to: "" });
  const [form, setForm] = useState(null);
  const [editId, setEditId] = useState(null);
  const [viewItem, setViewItem] = useState(null);
  const [viewGain, setViewGain] = useState(null);
  const [deleteId, setDeleteId] = useState(null);

  const showGains = category === "benefice";
  const showNet = category === "net";

  // ── Period filtering ─────────────────────────────────────────────────────
  // `to` is inclusive: everything up to 23:59:59 of that day belongs to the period.
  const inRange = useMemo(() => {
    const start = range.from ? new Date(`${range.from}T00:00:00`).getTime() : null;
    const end = range.to ? new Date(`${range.to}T23:59:59.999`).getTime() : null;
    return (value) => {
      if (start === null && end === null) return true;
      if (!value) return false;
      const ts = new Date(value).getTime();
      if (isNaN(ts)) return false;
      if (start !== null && ts < start) return false;
      if (end !== null && ts > end) return false;
      return true;
    };
  }, [range.from, range.to]);

  const hasPeriod = !!(range.from || range.to);
  const periodLabel = hasPeriod
    ? `${range.from ? formatDate(range.from) : "…"} → ${range.to ? formatDate(range.to) : "…"}`
    : t("caisse.periodAll");

  const setRangeField = (patch) => setRange((r) => ({ ...r, ...patch }));
  const resetRange = () => setRange({ from: "", to: "" });

  // Every ledger line of the period, before the category / search filters.
  const periodEntries = useMemo(
    () => (ledger?.entries || []).filter((e) => inRange(e.date)),
    [ledger, inRange]
  );
  const periodGains = useMemo(
    () => (ledger?.gains || []).filter((g) => inRange(g.date)),
    [ledger, inRange]
  );
  const periodPurchases = useMemo(
    () => (ledger?.purchasesList || []).filter((p) => inRange(p.date)),
    [ledger, inRange]
  );

  // ── Totals, recomputed for the selected period ───────────────────────────
  const totals = useMemo(() => {
    const sumCat = (k) => periodEntries.filter((e) => e.category === k).reduce((a, e) => a + e.amount, 0);
    const totalGains = periodGains.reduce((a, g) => a + (Number(g.gain) || 0), 0);
    const totalPurchases = periodPurchases.reduce((a, p) => a + p.purchasePrice, 0);
    const totalSales = periodGains.reduce((a, g) => a + (Number(g.salePrice) || 0), 0);
    const totalDebts =
      periodGains.reduce((a, g) => a + (Number(g.amountRest) > 0 ? Number(g.amountRest) : 0), 0) +
      periodPurchases.reduce((a, p) => a + (p.amountRest > 0 ? p.amountRest : 0), 0);
    const carExpenses = periodEntries
      .filter((e) => e.category === "expense" && e.expenseType === "CAR")
      .reduce((a, e) => a + e.amount, 0);
    const totalExpenses = sumCat("expense");
    return {
      totalIn: periodEntries.filter((e) => e.dir === "IN").reduce((a, e) => a + e.amount, 0),
      totalOut: periodEntries.filter((e) => e.dir === "OUT").reduce((a, e) => a + e.amount, 0),
      totalPurchases,
      totalSales,
      totalDebts,
      totalGains,
      totalExpenses,
      carExpenses,
      showroomExpenses: totalExpenses - carExpenses,
      // "Caisse" view: what the showroom kept once its dépenses are paid.
      net: totalGains - totalExpenses,
      byCategory: {
        benefice: totalGains,
        net: totalGains - totalExpenses,
        cash: sumCat("cash"),
        sale: sumCat("sale"),
        purchase: sumCat("purchase"),
        expense: totalExpenses,
        payroll: sumCat("payroll"),
        settlement: sumCat("settlement"),
      },
    };
  }, [periodEntries, periodGains, periodPurchases]);

  const entries = useMemo(() => {
    let list = periodEntries;
    if (category && category !== "benefice" && category !== "net") list = list.filter((e) => e.category === category);
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
  }, [periodEntries, category, search]);

  // One record per sale — the gain the showroom made on it, normal sale or
  // prestation (vehicle left by its owner).
  const gains = useMemo(() => {
    let list = periodGains;
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
  }, [periodGains, search]);

  const gainsTotal = useMemo(() => gains.reduce((a, g) => a + (Number(g.gain) || 0), 0), [gains]);
  const expenseEntries = useMemo(() => periodEntries.filter((e) => e.category === "expense"), [periodEntries]);

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

  // ── Printing the part currently on screen, for the selected period ───────
  const catName = (k) => t(`caisse.cat${k.charAt(0).toUpperCase() + k.slice(1)}`);
  const kindLabel = (g) => (g.kind === "PRESTATION" ? t("caisse.kindPrestation") : t("caisse.kindNormal"));
  const reportFrom = range.from || (periodEntries.length ? periodEntries[periodEntries.length - 1].date : new Date());
  const reportTo = range.to || new Date();

  const gainsBlock = (list) => ({
    title: t("caisse.catBenefice"),
    columns: [
      { label: t("caisse.colNo"), width: "5%", render: (_r, i) => i + 1, ltr: true },
      { label: t("common.date"), width: "11%", nowrap: true, ltr: true, render: (g) => formatDate(g.date) },
      { label: t("caisse.colType"), width: "12%", render: (g) => kindLabel(g) },
      { label: t("caisse.colVehicle"), width: "20%", bold: true, render: (g) => `${carLabel(g.car) || "—"}${g.car?.plate ? ` · ${g.car.plate}` : ""}` },
      { label: t("caisse.colClient"), width: "17%", render: (g) => personLabel(g.client) || "—" },
      { label: t("caisse.colSalePrice"), width: "13%", align: "end", nowrap: true, ltr: true, render: (g) => formatAmount(g.salePrice) },
      { label: t("caisse.colCost"), width: "11%", align: "end", nowrap: true, ltr: true, render: (g) => formatAmount(g.kind === "PRESTATION" ? g.showroomShare : g.totalCost) },
      { label: t("caisse.colGain"), width: "11%", align: "end", bold: true, nowrap: true, ltr: true, render: (g) => formatAmount(g.gain) },
    ],
    rows: list,
    totals: [{ label: t("caisse.totalGains"), value: formatAmount(list.reduce((a, g) => a + (Number(g.gain) || 0), 0)), danger: true }],
  });

  const entriesBlock = (list, title) => ({
    title,
    columns: [
      { label: t("caisse.colNo"), width: "5%", render: (_r, i) => i + 1, ltr: true },
      { label: t("common.date"), width: "14%", nowrap: true, ltr: true, render: (e) => formatDateTime(e.date) },
      { label: t("caisse.colType"), width: "12%", render: (e) => catName(e.category) },
      { label: t("caisse.colLabel"), width: "30%", bold: true, render: (e) => e.label },
      { label: t("common.details"), width: "14%", render: (e) => e.sub || "—" },
      { label: t("caisse.colRef"), width: "11%", ltr: true, render: (e) => e.reference || "—" },
      { label: t("common.amount"), width: "14%", align: "end", bold: true, nowrap: true, ltr: true, render: (e) => `${e.dir === "IN" ? "+ " : "− "}${formatAmount(e.amount)}` },
    ],
    rows: list,
    totals: [
      { label: t("caisse.totalIn"), value: formatAmount(list.filter((e) => e.dir === "IN").reduce((a, e) => a + e.amount, 0)) },
      { label: t("caisse.totalOut"), value: formatAmount(list.filter((e) => e.dir === "OUT").reduce((a, e) => a + e.amount, 0)) },
      { label: t("caisse.balance"), value: formatAmount(list.reduce((a, e) => a + (e.dir === "IN" ? e.amount : -e.amount), 0)), danger: true },
    ],
  });

  const printCurrent = () => {
    const showroom = settings;
    if (showGains) {
      openPrint((lang) => (
        <PeriodReport
          showroom={showroom} lang={lang} from={reportFrom} to={reportTo}
          title={t("caisse.reportBeneficeTitle")} subtitle={t("caisse.beneficeSubtitle")}
          stats={[
            { label: t("caisse.gainsCountShort"), value: String(gains.length) },
            { label: t("caisse.totalSales"), value: formatAmount(gains.reduce((a, g) => a + (Number(g.salePrice) || 0), 0)) },
            { label: t("caisse.totalGains"), value: formatAmount(gainsTotal), accent: true },
          ]}
          blocks={[gainsBlock(gains)]}
        />
      ));
      return;
    }
    if (showNet) {
      const recap = [
        { label: t("caisse.totalGains"), value: formatAmount(totals.totalGains) },
        { label: t("caisse.carExpensesTotal"), value: `− ${formatAmount(totals.carExpenses)}` },
        { label: t("caisse.showroomExpensesTotal"), value: `− ${formatAmount(totals.showroomExpenses)}` },
      ];
      openPrint((lang) => (
        <PeriodReport
          showroom={showroom} lang={lang} from={reportFrom} to={reportTo}
          title={t("caisse.reportNetTitle")} subtitle={t("caisse.netFormula")}
          stats={[
            { label: t("caisse.totalGains"), value: formatAmount(totals.totalGains) },
            { label: t("caisse.totalExpenses"), value: formatAmount(totals.totalExpenses) },
            { label: t("caisse.netResult"), value: formatAmount(totals.net), accent: true },
          ]}
          blocks={[
            {
              title: t("caisse.netRecap"),
              columns: [
                { label: t("caisse.colLabel"), width: "60%", bold: true, render: (r) => r.label },
                { label: t("common.amount"), width: "40%", align: "end", nowrap: true, ltr: true, render: (r) => r.value },
              ],
              rows: recap,
              totals: [{ label: t("caisse.netResult"), value: formatAmount(totals.net), danger: true }],
            },
            gainsBlock(periodGains),
            {
              title: t("caisse.catExpense"),
              columns: [
                { label: t("caisse.colNo"), width: "6%", render: (_r, i) => i + 1, ltr: true },
                { label: t("common.date"), width: "16%", nowrap: true, ltr: true, render: (e) => formatDate(e.date) },
                { label: t("caisse.colLabel"), width: "44%", bold: true, render: (e) => e.label },
                { label: t("caisse.colCategory"), width: "18%", render: (e) => e.sub || "—" },
                { label: t("common.amount"), width: "16%", align: "end", bold: true, nowrap: true, ltr: true, render: (e) => formatAmount(e.amount) },
              ],
              rows: expenseEntries,
              totals: [{ label: t("caisse.totalExpenses"), value: formatAmount(totals.totalExpenses), danger: true }],
            },
          ]}
          note={t("caisse.netNote")}
        />
      ));
      return;
    }
    const title = category ? `${t("caisse.reportLedgerTitle")} — ${catName(category)}` : t("caisse.reportLedgerTitle");
    openPrint((lang) => (
      <PeriodReport
        showroom={showroom} lang={lang} from={reportFrom} to={reportTo}
        title={title} subtitle={t("caisse.subtitle")}
        stats={[
          { label: t("caisse.linesCount"), value: String(entries.length) },
          { label: t("caisse.totalIn"), value: formatAmount(entries.filter((e) => e.dir === "IN").reduce((a, e) => a + e.amount, 0)) },
          { label: t("caisse.totalOut"), value: formatAmount(entries.filter((e) => e.dir === "OUT").reduce((a, e) => a + e.amount, 0)) },
          { label: t("caisse.balance"), value: formatAmount(entries.reduce((a, e) => a + (e.dir === "IN" ? e.amount : -e.amount), 0)), accent: true },
        ]}
        blocks={[entriesBlock(entries, category ? catName(category) : t("caisse.catAll"))]}
      />
    ));
  };

  const CAT_CHIPS = [
    ["", t("caisse.catAll")],
    ["benefice", t("caisse.catBenefice")],
    ["net", t("caisse.catNet")],
    ["sale", t("caisse.catSale")],
    ["purchase", t("caisse.catPurchase")],
    ["expense", t("caisse.catExpense")],
    ["payroll", t("caisse.catPayroll")],
    ["settlement", t("caisse.catSettlement")],
    ["cash", t("caisse.catCash")],
  ];

  const presets = periodPresets(t);

  return (
    <div>
      <PageHeader title={t("nav.caisse")} subtitle={t("caisse.subtitle")}>
        {can("caisse", "print") && (
          <motion.button className="btn-ghost" onClick={printCurrent} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
            <Printer size={16} /> {t("caisse.printPeriod")}
          </motion.button>
        )}
      </PageHeader>

      {/* ── Période ────────────────────────────────────────────────────── */}
      <Card className="p-4 mb-4">
        <div className="flex flex-col lg:flex-row lg:items-end gap-4">
          <div className="flex-1 min-w-0">
            <p className="label-caps flex items-center gap-1.5"><CalendarRange size={13} /> {t("caisse.period")}</p>
            <div className="flex flex-wrap gap-2">
              {presets.map((p) => (
                <button
                  key={p.key}
                  className={`chip ${range.from === p.from && range.to === p.to ? "chip-active" : ""}`}
                  onClick={() => setRange({ from: p.from, to: p.to })}
                >
                  {p.label}
                </button>
              ))}
              <button className={`chip ${!hasPeriod ? "chip-active" : ""}`} onClick={resetRange}>
                <RotateCcw size={13} /> {t("caisse.periodAll")}
              </button>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Field label={t("caisse.periodFrom")} className="sm:w-44">
              <DateInput value={range.from} onChange={(v) => setRangeField({ from: v })} />
            </Field>
            <Field label={t("caisse.periodTo")} className="sm:w-44">
              <DateInput value={range.to} onChange={(v) => setRangeField({ to: v })} />
            </Field>
          </div>
        </div>
        <p className="text-xs text-text-muted mt-2">
          {t("caisse.periodShown")} : <span className="text-text-primary font-bold">{periodLabel}</span>
        </p>
      </Card>

      {/* Achats / Ventes / Dettes / Gains / Caisse nette */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
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
        {/* The Caisse card — the same net the "Caisse" filter details below. */}
        <button onClick={() => setCategory("net")} className="text-left rtl:text-right">
          <Card className="p-4 flex items-center justify-between h-full" style={{ borderLeft: "3px solid #f59e0b" }}>
            <div>
              <p className="label-caps">{t("caisse.netResult")}</p>
              <p className={`text-xl font-black mt-1 ${totals.net >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {totals.net >= 0 ? "+" : ""}{formatAmount(totals.net)}
              </p>
              <p className="text-[0.65rem] text-text-muted mt-0.5">{t("caisse.netFormula")}</p>
            </div>
            <Scale className={totals.net >= 0 ? "text-emerald-400" : "text-rose-400"} size={26} />
          </Card>
        </button>
      </div>

      {/* Category totals */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2.5 mb-6">
        {["benefice", "net", "sale", "purchase", "expense", "payroll", "settlement"].map((k) => {
          const meta = CATEGORIES[k];
          const Icon = meta.icon;
          const value = totals.byCategory?.[k] || 0;
          const signed = k === "benefice" || k === "net";
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
              <p className={`text-sm font-black ${signed ? (value >= 0 ? "text-emerald-400" : "text-rose-400") : "text-text-primary"}`}>
                {signed && value >= 0 ? "+" : ""}{formatAmount(value)}
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
        {!showNet && (
          <div className="relative flex-1 sm:max-w-xs sm:ml-auto rtl:sm:ml-0 rtl:sm:mr-auto">
            <Search className="absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
            <input
              className="input pl-9 rtl:pl-3 rtl:pr-9"
              placeholder={showGains ? t("caisse.beneficeSearch") : t("caisse.searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        )}
        {!showGains && !showNet && can("caisse", "create") && (
          <div className="flex gap-2">
            <button className="btn-ghost text-xs" onClick={() => openNew("DEPOSIT")}><ArrowDownCircle size={14} /> {t("caisse.newDeposit")}</button>
            <button className="btn-ghost text-xs" onClick={() => openNew("WITHDRAWAL")}><ArrowUpCircle size={14} /> {t("caisse.newWithdrawal")}</button>
          </div>
        )}
      </div>

      {/* ── Caisse : gains − dépenses of the period ─────────────────────── */}
      {showNet ? (
        loading ? <SkeletonGrid /> : (
          <NetView
            t={t}
            totals={totals}
            gains={periodGains}
            expenses={expenseEntries}
            periodLabel={periodLabel}
            onOpenGain={setViewGain}
          />
        )
      ) : showGains ? (
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

// ── Caisse view — total gains − total dépenses over the selected period ────
function NetView({ t, totals, gains, expenses, periodLabel, onOpenGain }) {
  const positive = totals.net >= 0;
  const tile = (label, value, cls, hint) => (
    <Card className="p-4">
      <p className="label-caps">{label}</p>
      <p className={`text-2xl font-black mt-1 ${cls}`}>{value}</p>
      {hint && <p className="text-[0.65rem] text-text-muted mt-1">{hint}</p>}
    </Card>
  );

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {tile(t("caisse.totalGains"), formatAmount(totals.totalGains), "text-emerald-400", t("caisse.gainsCountShort") + " : " + gains.length)}
        {tile(t("caisse.carExpensesTotal"), formatAmount(totals.carExpenses), "text-amber-400")}
        {tile(t("caisse.showroomExpensesTotal"), formatAmount(totals.showroomExpenses), "text-amber-400")}
        {tile(t("caisse.netResult"), `${positive ? "+" : ""}${formatAmount(totals.net)}`, positive ? "text-emerald-400" : "text-rose-400", t("caisse.netFormula"))}
      </div>

      <Card className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <Scale size={16} className="text-red-400" />
          <h3 className="heading text-sm text-text-primary">{t("caisse.netRecap")}</h3>
          <span className="text-xs text-text-muted ltr:ml-auto rtl:mr-auto">{periodLabel}</span>
        </div>
        <div className="space-y-1.5">
          {[
            [t("caisse.totalGains"), formatAmount(totals.totalGains), "text-emerald-400"],
            [t("caisse.carExpensesTotal"), `− ${formatAmount(totals.carExpenses)}`, "text-amber-400"],
            [t("caisse.showroomExpensesTotal"), `− ${formatAmount(totals.showroomExpenses)}`, "text-amber-400"],
          ].map(([label, value, cls]) => (
            <div key={label} className="flex justify-between text-sm border-b border-red-600/10 py-2">
              <span className="text-text-muted">{label}</span>
              <span className={`font-bold ${cls}`}>{value}</span>
            </div>
          ))}
          <div className={`flex items-center justify-between rounded-xl px-4 py-3 mt-3 border ${
            positive ? "bg-emerald-500/10 border-emerald-500/25" : "bg-rose-500/10 border-rose-500/25"
          }`}>
            <span className="flex items-center gap-2 label-caps !mb-0">
              {positive ? <TrendingUp size={15} className="text-emerald-400" /> : <TrendingDown size={15} className="text-rose-400" />}
              {t("caisse.netResult")}
            </span>
            <span className={`font-black text-xl ${positive ? "text-emerald-400" : "text-rose-400"}`}>
              {positive ? "+ " : "− "}{formatAmount(Math.abs(totals.net))}
            </span>
          </div>
        </div>
        <p className="text-xs text-text-muted mt-3">{t("caisse.netNote")}</p>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card className="p-0 overflow-hidden">
          <div className="p-4 border-b border-red-600/20 flex items-center gap-2">
            <TrendingUp size={15} className="text-emerald-400" />
            <h3 className="heading text-sm text-text-primary">{t("caisse.catBenefice")}</h3>
            <span className="text-xs text-emerald-400 font-bold ltr:ml-auto rtl:mr-auto">{formatAmount(totals.totalGains)}</span>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {gains.length === 0 ? (
              <p className="text-sm text-text-muted p-4">{t("caisse.noGains")}</p>
            ) : gains.map((g) => (
              <button
                key={g.id}
                onClick={() => onOpenGain(g)}
                className="w-full text-left rtl:text-right flex justify-between items-center gap-3 px-4 py-2.5 border-b border-red-600/10 hover:bg-red-600/8 transition"
              >
                <span className="min-w-0">
                  <span className="block text-sm text-text-primary truncate">{carLabel(g.car) || "—"}</span>
                  <span className="block text-xs text-text-muted">{formatDate(g.date)} · {personLabel(g.client) || "—"}</span>
                </span>
                <span className={`font-bold text-sm whitespace-nowrap ${(Number(g.gain) || 0) >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  {formatAmount(g.gain)}
                </span>
              </button>
            ))}
          </div>
        </Card>

        <Card className="p-0 overflow-hidden">
          <div className="p-4 border-b border-red-600/20 flex items-center gap-2">
            <CircleDollarSign size={15} className="text-amber-400" />
            <h3 className="heading text-sm text-text-primary">{t("caisse.catExpense")}</h3>
            <span className="text-xs text-amber-400 font-bold ltr:ml-auto rtl:mr-auto">{formatAmount(totals.totalExpenses)}</span>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {expenses.length === 0 ? (
              <p className="text-sm text-text-muted p-4">{t("caisse.noExpense")}</p>
            ) : expenses.map((e) => (
              <div key={e.id} className="flex justify-between items-center gap-3 px-4 py-2.5 border-b border-red-600/10">
                <span className="min-w-0">
                  <span className="block text-sm text-text-primary truncate">{e.label}</span>
                  <span className="block text-xs text-text-muted">{formatDate(e.date)} · {e.sub || "—"}</span>
                </span>
                <span className="font-bold text-sm text-amber-400 whitespace-nowrap">{formatAmount(e.amount)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
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
