import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Printer, FileBarChart, Loader2, LayoutGrid, Table as TableIcon, ChevronRight,
  TrendingUp, AlertTriangle, FileText,
} from "lucide-react";
import { reportsApi } from "../lib/api.js";
import { useStore } from "../store/useStore.js";
import { useCan } from "../lib/permissions.js";
import { Card, Field, EmptyState, Modal } from "../components/ui.jsx";
import PageHeader from "../components/PageHeader.jsx";
import { CarImage } from "../components/CarCard.jsx";
import { PeriodReport } from "../components/PrintTemplates.jsx";
import { usePrintDialog } from "../components/PrintChooser.jsx";
import { formatAmount, formatDate, formatDateTime, toDateInput } from "../utils/format.js";
import DateInput from "../components/DateInput.jsx";

const money = (v) => formatAmount(v);
const carName = (c) => [c?.brand, c?.model].filter(Boolean).join(" ") || "—";
const personName = (c) => `${c?.firstName || ""} ${c?.lastName || ""}`.trim() || "—";

// A reusable block that renders rows as either a styled table or cards, with clickable detail.
function DataBlock({ cols, rows, view, onRow }) {
  if (!rows || rows.length === 0) {
    return <p className="text-text-muted text-sm py-2">Aucune donnée</p>;
  }
  if (view === "table") {
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left rtl:text-right bg-red-600/10 border-b border-red-600/30">
              {cols.map((c) => <th key={c.key} className="p-3 label-caps !text-red-300/80">{c.label}</th>)}
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <motion.tr
                key={i}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i, 25) * 0.02 }}
                onClick={() => onRow?.(r)}
                className={`border-b border-red-600/10 ${onRow ? "cursor-pointer" : ""} hover:bg-red-600/8 ${i % 2 ? "bg-white/[0.015]" : ""}`}
              >
                {cols.map((c) => <td key={c.key} className={`p-3 ${c.cls || "text-text-primary"}`}>{c.render ? c.render(r) : r[c.key]}</td>)}
                <td className="p-3 text-text-muted">{onRow ? <ChevronRight size={15} /> : null}</td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  // cards
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {rows.map((r, i) => (
        <motion.button
          key={i}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: Math.min(i, 25) * 0.03 }}
          whileHover={{ y: -3 }}
          onClick={() => onRow?.(r)}
          className="glass-card p-3 text-left rtl:text-right"
        >
          {cols.slice(0, 4).map((c, j) => (
            <div key={c.key} className={`flex justify-between gap-2 ${j === 0 ? "mb-1.5" : "text-xs py-0.5"}`}>
              {j === 0 ? (
                <span className="heading text-sm text-text-primary truncate">{c.render ? c.render(r) : r[c.key]}</span>
              ) : (
                <>
                  <span className="text-text-muted">{c.label}</span>
                  <span className={c.cls || "text-text-primary"}>{c.render ? c.render(r) : r[c.key]}</span>
                </>
              )}
            </div>
          ))}
        </motion.button>
      ))}
    </div>
  );
}

// Each part of the report: its own title, its own "Imprimer" button.
function Section({ title, count, onPrint, children }) {
  return (
    <motion.section
      className="glass-card p-5 mb-5"
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
    >
      <div className="flex items-center justify-between gap-3 mb-4">
        <h3 className="heading text-sm text-text-primary">
          {title}
          {count != null && <span className="text-text-muted font-normal ltr:ml-2 rtl:mr-2">({count})</span>}
        </h3>
        {onPrint && (
          <button className="btn-ghost text-xs no-print shrink-0" onClick={onPrint}>
            <Printer size={14} /> Imprimer
          </button>
        )}
      </div>
      {children}
    </motion.section>
  );
}

// Detail modal content — flexible key/value renderer
function DetailView({ detail }) {
  if (!detail) return null;
  const { car, rows } = detail;
  return (
    <div className="space-y-3">
      {car && <div className="rounded-xl overflow-hidden"><CarImage images={car.images} heightClass="h-40" zoomable /></div>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between text-sm border-b border-red-600/10 py-1.5">
            <span className="text-text-muted">{k}</span>
            <span className="text-text-primary text-right">{v ?? "—"}</span>
          </div>
        ))}
      </div>
      {detail.expenseList && detail.expenseList.length > 0 && (
        <div>
          <p className="label-caps mb-1">Dépenses du véhicule</p>
          {detail.expenseList.map((e, i) => (
            <div key={i} className="flex justify-between text-sm border-b border-red-600/10 py-1"><span className="text-text-muted">{e.name}</span><span className="text-amber-400">{money(e.amount)}</span></div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Screen column configs ───────────────────────────────────────────────
const salesCols = [
  { key: "client", label: "Client", render: (s) => personName(s.client) },
  { key: "car", label: "Véhicule", render: (s) => carName(s.car), cls: "text-text-muted" },
  { key: "total", label: "Total", render: (s) => money(s.totalAfterReduction), cls: "text-text-primary font-bold" },
  { key: "profit", label: "Profit", render: (s) => {
    const profit = s.totalAfterReduction - (s.purchasePrice || 0);
    return <span className={profit >= 0 ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}><TrendingUp size={12} className="inline mr-1" />{money(profit)}</span>;
  }, cls: "" },
  { key: "rest", label: "Reste", render: (s) => money(s.amountRest), cls: "text-rose-400" },
  { key: "date", label: "Date", render: (s) => formatDate(s.date), cls: "text-text-muted" },
];
const purchaseCols = [
  { key: "ref", label: "Véhicule", render: (p) => carName(p.car) },
  { key: "src", label: "Source", render: (p) => (p.sourceType === "CLIENT" ? "Dépôt client" : "Showroom"), cls: "text-text-muted" },
  { key: "price", label: "Prix", render: (p) => money(p.purchasePrice), cls: "text-text-primary font-bold" },
  { key: "rest", label: "Reste", render: (p) => money(p.amountRest), cls: "text-rose-400" },
  { key: "date", label: "Date", render: (p) => formatDate(p.date), cls: "text-text-muted" },
];
const gainCols = [
  { key: "car", label: "Véhicule", render: (g) => carName(g.car) },
  { key: "kind", label: "Type", render: (g) => (g.kind === "PRESTATION" ? "Prestation" : "Vente normale"), cls: "text-text-muted" },
  { key: "sale", label: "Prix de vente", render: (g) => money(g.salePrice), cls: "text-text-primary" },
  { key: "cost", label: "Coût / Part", render: (g) => money(g.kind === "PRESTATION" ? g.showroomShare : g.totalCost), cls: "text-text-muted" },
  { key: "gain", label: "Bénéfice", render: (g) => <span className={g.gain >= 0 ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>{money(g.gain)}</span> },
  { key: "date", label: "Date", render: (g) => formatDate(g.date), cls: "text-text-muted" },
];
const carCols = [
  { key: "car", label: "Véhicule", render: (c) => carName(c.car) },
  { key: "cost", label: "Coût total", render: (c) => money(c.totalCost), cls: "text-text-muted" },
  { key: "sale", label: "Vente", render: (c) => money(c.salePrice), cls: "text-text-primary" },
  { key: "net", label: "Marge nette", render: (c) => <span className={`font-bold flex items-center gap-1 ${c.netMargin >= 0 ? "text-emerald-400" : "text-rose-400"}`}><TrendingUp size={12} />{money(c.netMargin)}</span> },
  { key: "pct", label: "%", render: (c) => <span className={c.netMargin >= 0 ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>{c.netMarginPct}%</span>, cls: "" },
];
const debtClientCols = [
  { key: "client", label: "Client", render: (d) => personName(d.client) },
  { key: "car", label: "Véhicule", render: (d) => carName(d.car), cls: "text-text-muted" },
  { key: "rest", label: "Reste", render: (d) => money(d.rest), cls: "text-rose-400 font-bold" },
  { key: "date", label: "Date", render: (d) => formatDate(d.date), cls: "text-text-muted" },
];
const debtPurchaseCols = [
  { key: "source", label: "Source", render: (d) => d.source },
  { key: "car", label: "Véhicule", render: (d) => carName(d.car), cls: "text-text-muted" },
  { key: "rest", label: "Reste", render: (d) => money(d.rest), cls: "text-rose-400 font-bold" },
  { key: "date", label: "Date", render: (d) => formatDate(d.date), cls: "text-text-muted" },
];
const payrollCols = [
  { key: "fullName", label: "Employé", render: (p) => p.fullName },
  { key: "role", label: "Rôle", render: (p) => p.role, cls: "text-text-muted" },
  { key: "net", label: "Net payé", render: (p) => money(p.netPaid), cls: "text-emerald-400 font-bold" },
  { key: "abs", label: "Absences", render: (p) => money(p.absences), cls: "text-rose-400" },
];
const workerPaymentCols = [
  { key: "worker", label: "Employé", render: (p) => p.worker?.fullName || "—" },
  { key: "month", label: "Mois", render: (p) => p.month || "—", cls: "text-text-muted" },
  { key: "amount", label: "Montant", render: (p) => money(p.amount), cls: "text-emerald-400 font-bold" },
  { key: "date", label: "Date", render: (p) => formatDate(p.date), cls: "text-text-muted" },
];
const expenseCols = [
  { key: "name", label: "Nom", render: (e) => e.name },
  { key: "desc", label: "Description", render: (e) => e.description || "—", cls: "text-text-muted" },
  { key: "amount", label: "Montant", render: (e) => money(e.amount), cls: "text-amber-400 font-bold" },
  { key: "date", label: "Date", render: (e) => formatDate(e.date), cls: "text-text-muted" },
];
const carExpenseCols = [
  { key: "name", label: "Nom", render: (e) => e.name },
  { key: "car", label: "Véhicule", render: (e) => carName(e.car), cls: "text-text-muted" },
  { key: "amount", label: "Montant", render: (e) => money(e.amount), cls: "text-amber-400 font-bold" },
  { key: "date", label: "Date", render: (e) => formatDate(e.date), cls: "text-text-muted" },
];
const versementCols = [
  { key: "client", label: "Client", render: (p) => personName(p.sale?.client) },
  { key: "car", label: "Véhicule", render: (p) => carName(p.car), cls: "text-text-muted" },
  { key: "ref", label: "Vente", render: (p) => p.sale?.reference || "—", cls: "text-text-muted" },
  { key: "amount", label: "Montant", render: (p) => money(p.amount), cls: "text-emerald-400 font-bold" },
  { key: "date", label: "Date", render: (p) => formatDate(p.date), cls: "text-text-muted" },
];
const cashCols = [
  { key: "type", label: "Type", render: (c) => (c.type === "WITHDRAWAL" ? "Retrait" : "Versement") },
  { key: "party", label: "Bénéficiaire / Client", render: (c) => c.clientName || personName(c.client), cls: "text-text-muted" },
  { key: "desc", label: "Description", render: (c) => c.description || "—", cls: "text-text-muted" },
  { key: "amount", label: "Montant", render: (c) => <span className={c.type === "WITHDRAWAL" ? "text-rose-400 font-bold" : "text-emerald-400 font-bold"}>{money(c.amount)}</span> },
  { key: "date", label: "Date", render: (c) => formatDate(c.date), cls: "text-text-muted" },
];
const settlementCols = [
  { key: "client", label: "Propriétaire", render: (st) => personName(st.client) },
  { key: "car", label: "Véhicule", render: (st) => carName(st.car), cls: "text-text-muted" },
  { key: "share", label: "Part showroom", render: (st) => money(st.showroomShare), cls: "text-text-muted" },
  { key: "owner", label: "Versé au propriétaire", render: (st) => money(st.ownerAmount), cls: "text-fuchsia-300 font-bold" },
  { key: "date", label: "Date", render: (st) => formatDate(st.date), cls: "text-text-muted" },
];
const prestationCols = [
  { key: "client", label: "Propriétaire", render: (p) => personName(p.client) },
  { key: "car", label: "Véhicule", render: (p) => carName(p.car), cls: "text-text-muted" },
  { key: "sale", label: "Prix vente", render: (p) => money(p.salePrice), cls: "text-text-primary" },
  { key: "share", label: "Part showroom", render: (p) => money(p.showroomShare), cls: "text-text-muted" },
  { key: "gain", label: "Gain showroom", render: (p) => p.settled
      ? <span className={p.showroomGain >= 0 ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}><TrendingUp size={12} className="inline mr-1" />{money(p.showroomGain)}</span>
      : <span className="text-amber-400">En attente</span> },
  { key: "date", label: "Date", render: (p) => formatDate(p.date), cls: "text-text-muted" },
];

// row → detail object
const saleDetail = (s) => ({ car: s.car, rows: [["Client", personName(s.client)], ["Téléphone", s.client?.phonePrimary], ["Véhicule", carName(s.car)], ["Plaque", s.car?.plate], ["Prix de vente", money(s.totalAfterReduction)], ["Achat initial", money(s.purchasePrice || 0)], ["Profit", money(s.totalAfterReduction - (s.purchasePrice || 0))], ["Payé", money(s.amountPaid)], ["Date", formatDate(s.date)]] });
const purchaseDetail = (p) => ({ car: p.car, rows: [["Référence", p.reference], ["Véhicule", carName(p.car)], ["Plaque", p.car?.plate], ["Source", p.sourceType === "CLIENT" ? personName(p.client) : "Showroom"], ["Prix", money(p.purchasePrice)], ["Payé", money(p.amountPaid)], ["Reste", money(p.amountRest)], ["Date", formatDate(p.date)]] });
const gainDetail = (g) => ({ car: g.car, rows: [["Véhicule", carName(g.car)], ["Type", g.kind === "PRESTATION" ? "Prestation" : "Vente normale"], ["Client", personName(g.client)], ["Prix de vente", money(g.salePrice)], ["Prix d'achat", money(g.purchasePrice)], ["Dépenses véhicule", money(g.carExpenses)], ["Part showroom", money(g.showroomShare)], ["Bénéfice", money(g.gain)], ["Marge", `${(g.margin || 0).toFixed(1)} %`], ["Date", formatDate(g.date)]] });
const carDetail = (c) => ({ car: c.car, expenseList: c.expenseList, rows: [["Véhicule", carName(c.car)], ["Plaque", c.car?.plate], ["Prix d'achat", money(c.purchasePrice)], ["Dépenses", money(c.expenses)], ["Coût total", money(c.totalCost)], ["Prix de vente", money(c.salePrice)], ["Profit brut", money(c.grossMargin)], ["Profit net", money(c.netMargin)], ["Marge %", `${c.netMarginPct}%`]] });
const debtClientDetail = (d) => ({ car: d.car, rows: [["Client", personName(d.client)], ["Véhicule", carName(d.car)], ["Total", money(d.total)], ["Payé", money(d.paid)], ["Reste", money(d.rest)], ["Date", formatDate(d.date)]] });
const debtPurchaseDetail = (d) => ({ car: d.car, rows: [["Source", d.source], ["Véhicule", carName(d.car)], ["Total", money(d.total)], ["Payé", money(d.paid)], ["Reste", money(d.rest)], ["Date", formatDate(d.date)]] });
const payrollDetail = (p) => ({ rows: [["Employé", p.fullName], ["Rôle", p.role], ["Type", p.paymentType], ["Salaire base", money(p.baseSalary)], ["Acomptes", money(p.advances)], ["Absences", money(p.absences)], ["Net payé", money(p.netPaid)]] });
const workerPaymentDetail = (p) => ({ rows: [["Employé", p.worker?.fullName], ["Mois", p.month || "—"], ["Montant", money(p.amount)], ["Description", p.description || "—"], ["Date", formatDate(p.date)]] });
const expenseDetail = (e) => ({ car: e.car, rows: [["Nom", e.name], ["Véhicule", e.car ? carName(e.car) : "Showroom"], ["Description", e.description || "—"], ["Montant", money(e.amount)], ["Date", formatDate(e.date)]] });
const versementDetail = (p) => ({ car: p.car, rows: [["Client", personName(p.sale?.client)], ["Véhicule", carName(p.car)], ["Vente", p.sale?.reference || "—"], ["Montant", money(p.amount)], ["Description", p.description || "—"], ["Date", formatDateTime(p.date)]] });
const cashDetail = (c) => ({ rows: [["Type", c.type === "WITHDRAWAL" ? "Retrait" : "Versement"], ["Client", c.clientName || personName(c.client)], ["Téléphone", c.clientPhone || "—"], ["Montant", money(c.amount)], ["Référence", c.reference || "—"], ["Description", c.description || "—"], ["Date", formatDateTime(c.date)]] });
const settlementDetail = (st) => ({ car: st.car, rows: [["Propriétaire", personName(st.client)], ["Véhicule", carName(st.car)], ["Prix de vente", money(st.salePrice)], ["Part showroom", money(st.showroomShare)], ["Dépenses", money(st.expensesTotal)], ["Net au propriétaire", money(st.ownerAmount)], ["Date", formatDate(st.date)]] });
const prestationDetail = (p) => ({ car: p.car, rows: [["Propriétaire", personName(p.client)], ["Véhicule", carName(p.car)], ["Prix de vente", money(p.salePrice)], ["Part showroom", money(p.showroomShare)], ["Dépenses véhicule", money(p.expenses)], ["Gain showroom", p.settled ? money(p.showroomGain) : "En attente de règlement"], ["Réglé", p.settled ? "Oui" : "Non"], ["Date", formatDate(p.date)]] });

// ── Print column configs (plain text, shared by "part" and "tout") ──────
const col = (label, render, extra = {}) => ({ label, render, ...extra });
const num = { align: "end", nowrap: true, ltr: true };
const idx = col("N°", (_r, i) => i + 1, { width: "5%", ltr: true });
const sum = (list, get) => list.reduce((a, r) => a + (Number(get(r)) || 0), 0);

// Every part of the report, in printing order. `block` is what the paper
// document renders; `rows` is what the screen renders. `onDetail` opens the
// detail modal of a clicked row.
export function buildParts(report, onDetail) {
  if (!report) return [];
  const s = report.synthese;
  const recap = [
    ["Ventes", `${s.totalSalesCount} op.`, money(s.totalSalesAmount)],
    ["Achats", `${s.totalPurchaseCount} op.`, money(s.totalPurchaseAmount)],
    ["Dépenses véhicules", "", money(s.totalCarExpenses)],
    ["Dépenses showroom", "", money(s.totalShowroomExpenses)],
    ["Versements encaissés", `${report.salePayments.length} op.`, money(s.totalVersements)],
    ["Versements de caisse", "", money(s.totalCashIn)],
    ["Retraits de caisse", "", money(s.totalCashOut)],
    ["Salaires versés", "", money(s.totalPayrollPaid)],
    ["Règlements propriétaires", "", money(s.totalSettlements)],
    ["Bénéfice brut", "", money(s.grossProfit)],
    ["Bénéfice net", "", money(s.netProfit)],
    ["Total bénéfices des ventes", "", money(s.totalGains)],
  ].map(([label, count, amount]) => ({ label, count, amount }));

  return [
    {
      id: "synthese",
      title: "1. Synthèse Globale",
      screen: null, // rendered as tiles
      block: {
        title: "Synthèse globale de la période",
        columns: [
          col("Rubrique", (r) => r.label, { width: "55%", bold: true }),
          col("Opérations", (r) => r.count || "—", { width: "20%" }),
          col("Montant", (r) => r.amount, { width: "25%", ...num, bold: true }),
        ],
        rows: recap,
        totals: [{ label: "Caisse (net) — bénéfices − dépenses", value: money(s.caisseNet), danger: true }],
      },
      stats: [
        { label: "Ventes", value: money(s.totalSalesAmount) },
        { label: "Achats", value: money(s.totalPurchaseAmount) },
        { label: "Bénéfices", value: money(s.totalGains) },
        { label: "Caisse (net)", value: money(s.caisseNet), accent: true },
      ],
    },
    {
      id: "sales",
      title: "2. Ventes",
      cols: salesCols, rows: report.sales, onRow: (r) => onDetail({ title: "Vente", ...saleDetail(r) }),
      block: {
        title: "Ventes de la période",
        columns: [
          idx,
          col("Date", (r) => formatDate(r.date), { width: "11%", nowrap: true, ltr: true }),
          col("Client", (r) => personName(r.client), { width: "20%", bold: true }),
          col("Véhicule", (r) => carName(r.car), { width: "20%" }),
          col("Réf.", (r) => r.reference || "—", { width: "12%", ltr: true }),
          col("Payé", (r) => money(r.amountPaid), { width: "14%", ...num }),
          col("Total", (r) => money(r.totalAfterReduction), { width: "18%", ...num, bold: true }),
        ],
        rows: report.sales,
        totals: [{ label: "Total des ventes", value: money(sum(report.sales, (r) => r.totalAfterReduction)), danger: true }],
      },
    },
    {
      id: "purchases",
      title: "3. Achats",
      cols: purchaseCols, rows: report.purchases, onRow: (r) => onDetail({ title: "Achat", ...purchaseDetail(r) }),
      block: {
        title: "Achats de la période",
        columns: [
          idx,
          col("Date", (r) => formatDate(r.date), { width: "12%", nowrap: true, ltr: true }),
          col("Véhicule", (r) => carName(r.car), { width: "24%", bold: true }),
          col("Source", (r) => (r.sourceType === "CLIENT" ? personName(r.client) : "Showroom"), { width: "20%" }),
          col("Réf.", (r) => r.reference || "—", { width: "13%", ltr: true }),
          col("Reste", (r) => money(r.amountRest), { width: "12%", ...num }),
          col("Prix", (r) => money(r.purchasePrice), { width: "14%", ...num, bold: true }),
        ],
        rows: report.purchases,
        totals: [{ label: "Total des achats", value: money(sum(report.purchases, (r) => r.purchasePrice)), danger: true }],
      },
    },
    {
      id: "gains",
      title: "4. Bénéfices des Ventes",
      cols: gainCols, rows: report.gains, onRow: (r) => onDetail({ title: "Bénéfice", ...gainDetail(r) }),
      block: {
        title: "Bénéfices des ventes",
        columns: [
          idx,
          col("Date", (r) => formatDate(r.date), { width: "11%", nowrap: true, ltr: true }),
          col("Véhicule", (r) => carName(r.car), { width: "22%", bold: true }),
          col("Type", (r) => (r.kind === "PRESTATION" ? "Prestation" : "Vente normale"), { width: "14%" }),
          col("Prix de vente", (r) => money(r.salePrice), { width: "16%", ...num }),
          col("Coût / Part", (r) => money(r.kind === "PRESTATION" ? r.showroomShare : r.totalCost), { width: "16%", ...num }),
          col("Bénéfice", (r) => money(r.gain), { width: "16%", ...num, bold: true }),
        ],
        rows: report.gains,
        totals: [{ label: "Total des bénéfices", value: money(sum(report.gains, (r) => r.gain)), danger: true }],
      },
    },
    {
      id: "carAnalysis",
      title: "5. Analyse par Véhicule",
      cols: carCols, rows: report.carAnalysis, onRow: (r) => onDetail({ title: "Analyse véhicule", ...carDetail(r) }),
      block: {
        title: "Analyse par véhicule",
        columns: [
          idx,
          col("Véhicule", (r) => carName(r.car), { width: "23%", bold: true }),
          col("Immat.", (r) => r.car?.plate || "—", { width: "12%", ltr: true }),
          col("Achat", (r) => money(r.purchasePrice), { width: "14%", ...num }),
          col("Dépenses", (r) => money(r.expenses), { width: "13%", ...num }),
          col("Vente", (r) => money(r.salePrice), { width: "14%", ...num }),
          col("Marge nette", (r) => `${money(r.netMargin)} (${r.netMarginPct}%)`, { width: "19%", ...num, bold: true }),
        ],
        rows: report.carAnalysis,
        totals: [{ label: "Total marge nette", value: money(sum(report.carAnalysis, (r) => r.netMargin)), danger: true }],
      },
    },
    {
      id: "carExpenses",
      title: "6. Dépenses Véhicules",
      cols: carExpenseCols, rows: report.carExpenses, onRow: (r) => onDetail({ title: "Dépense véhicule", ...expenseDetail(r) }),
      block: {
        title: "Dépenses véhicules",
        columns: [
          idx,
          col("Date", (r) => formatDate(r.date), { width: "13%", nowrap: true, ltr: true }),
          col("Désignation", (r) => r.name, { width: "27%", bold: true }),
          col("Véhicule", (r) => carName(r.car), { width: "22%" }),
          col("Description", (r) => r.description || "—", { width: "20%" }),
          col("Montant", (r) => money(r.amount), { width: "18%", ...num, bold: true }),
        ],
        rows: report.carExpenses,
        totals: [{ label: "Total dépenses véhicules", value: money(sum(report.carExpenses, (r) => r.amount)), danger: true }],
      },
    },
    {
      id: "showroomExpenses",
      title: "7. Dépenses Showroom",
      cols: expenseCols, rows: report.showroomExpenses, onRow: (r) => onDetail({ title: "Dépense", ...expenseDetail(r) }),
      block: {
        title: "Dépenses showroom",
        columns: [
          idx,
          col("Date", (r) => formatDate(r.date), { width: "14%", nowrap: true, ltr: true }),
          col("Désignation", (r) => r.name, { width: "32%", bold: true }),
          col("Description", (r) => r.description || "—", { width: "34%" }),
          col("Montant", (r) => money(r.amount), { width: "20%", ...num, bold: true }),
        ],
        rows: report.showroomExpenses,
        totals: [{ label: "Total dépenses showroom", value: money(sum(report.showroomExpenses, (r) => r.amount)), danger: true }],
      },
    },
    {
      id: "versements",
      title: "8. Versements Encaissés",
      cols: versementCols, rows: report.salePayments, onRow: (r) => onDetail({ title: "Versement", ...versementDetail(r) }),
      block: {
        title: "Versements encaissés sur les ventes",
        columns: [
          idx,
          col("Date", (r) => formatDate(r.date), { width: "13%", nowrap: true, ltr: true }),
          col("Client", (r) => personName(r.sale?.client), { width: "22%", bold: true }),
          col("Véhicule", (r) => carName(r.car), { width: "22%" }),
          col("Vente", (r) => r.sale?.reference || "—", { width: "16%", ltr: true }),
          col("Montant", (r) => money(r.amount), { width: "22%", ...num, bold: true }),
        ],
        rows: report.salePayments,
        totals: [{ label: "Total encaissé", value: money(sum(report.salePayments, (r) => r.amount)), danger: true }],
      },
    },
    {
      id: "cash",
      title: "9. Mouvements de Caisse",
      cols: cashCols, rows: report.cashMovements, onRow: (r) => onDetail({ title: "Mouvement de caisse", ...cashDetail(r) }),
      block: {
        title: "Mouvements de caisse (versements / retraits)",
        columns: [
          idx,
          col("Date", (r) => formatDate(r.date), { width: "13%", nowrap: true, ltr: true }),
          col("Type", (r) => (r.type === "WITHDRAWAL" ? "Retrait" : "Versement"), { width: "14%" }),
          col("Client / Bénéficiaire", (r) => r.clientName || personName(r.client), { width: "24%", bold: true }),
          col("Description", (r) => r.description || "—", { width: "24%" }),
          col("Montant", (r) => `${r.type === "WITHDRAWAL" ? "− " : "+ "}${money(r.amount)}`, { width: "20%", ...num, bold: true }),
        ],
        rows: report.cashMovements,
        totals: [
          { label: "Total versements", value: money(sum(report.cashMovements.filter((c) => c.type !== "WITHDRAWAL"), (r) => r.amount)) },
          { label: "Total retraits", value: money(sum(report.cashMovements.filter((c) => c.type === "WITHDRAWAL"), (r) => r.amount)) },
          { label: "Solde de caisse", value: money(report.synthese.totalCashIn - report.synthese.totalCashOut), danger: true },
        ],
      },
    },
    {
      id: "clientDebts",
      title: "10. Dettes Clients",
      cols: debtClientCols, rows: report.clientDebts, onRow: (r) => onDetail({ title: "Dette client", ...debtClientDetail(r) }),
      block: {
        title: "Dettes clients",
        columns: [
          idx,
          col("Date", (r) => formatDate(r.date), { width: "13%", nowrap: true, ltr: true }),
          col("Client", (r) => personName(r.client), { width: "24%", bold: true }),
          col("Véhicule", (r) => carName(r.car), { width: "22%" }),
          col("Total", (r) => money(r.total), { width: "14%", ...num }),
          col("Payé", (r) => money(r.paid), { width: "12%", ...num }),
          col("Reste", (r) => money(r.rest), { width: "15%", ...num, bold: true }),
        ],
        rows: report.clientDebts,
        totals: [{ label: "Total dû par les clients", value: money(sum(report.clientDebts, (r) => r.rest)), danger: true }],
      },
    },
    {
      id: "purchaseDebts",
      title: "11. Dettes sur Achats",
      cols: debtPurchaseCols, rows: report.purchaseDebts, onRow: (r) => onDetail({ title: "Dette", ...debtPurchaseDetail(r) }),
      block: {
        title: "Dettes sur achats",
        columns: [
          idx,
          col("Date", (r) => formatDate(r.date), { width: "13%", nowrap: true, ltr: true }),
          col("Source", (r) => r.source, { width: "24%", bold: true }),
          col("Véhicule", (r) => carName(r.car), { width: "22%" }),
          col("Total", (r) => money(r.total), { width: "14%", ...num }),
          col("Payé", (r) => money(r.paid), { width: "12%", ...num }),
          col("Reste", (r) => money(r.rest), { width: "15%", ...num, bold: true }),
        ],
        rows: report.purchaseDebts,
        totals: [{ label: "Total dû par le showroom", value: money(sum(report.purchaseDebts, (r) => r.rest)), danger: true }],
      },
    },
    {
      id: "payroll",
      title: "12. Employés & Salaires",
      cols: payrollCols, rows: report.payroll, onRow: (r) => onDetail({ title: "Salaire", ...payrollDetail(r) }),
      block: {
        title: "Employés & salaires de la période",
        columns: [
          idx,
          col("Employé", (r) => r.fullName, { width: "24%", bold: true }),
          col("Rôle", (r) => r.role, { width: "17%" }),
          col("Salaire base", (r) => money(r.baseSalary), { width: "15%", ...num }),
          col("Acomptes", (r) => money(r.advances), { width: "13%", ...num }),
          col("Absences", (r) => money(r.absences), { width: "13%", ...num }),
          col("Net payé", (r) => money(r.netPaid), { width: "13%", ...num, bold: true }),
        ],
        rows: report.payroll,
        totals: [{ label: "Total net payé", value: money(sum(report.payroll, (r) => r.netPaid)), danger: true }],
      },
    },
    {
      id: "workerPayments",
      title: "13. Salaires Versés",
      cols: workerPaymentCols, rows: report.workerPayments, onRow: (r) => onDetail({ title: "Salaire versé", ...workerPaymentDetail(r) }),
      block: {
        title: "Salaires versés",
        columns: [
          idx,
          col("Date", (r) => formatDate(r.date), { width: "14%", nowrap: true, ltr: true }),
          col("Employé", (r) => r.worker?.fullName || "—", { width: "28%", bold: true }),
          col("Mois", (r) => r.month || "—", { width: "16%" }),
          col("Description", (r) => r.description || "—", { width: "22%" }),
          col("Montant", (r) => money(r.amount), { width: "20%", ...num, bold: true }),
        ],
        rows: report.workerPayments,
        totals: [{ label: "Total versé", value: money(sum(report.workerPayments, (r) => r.amount)), danger: true }],
      },
    },
    {
      id: "settlements",
      title: "14. Règlements Propriétaires",
      cols: settlementCols, rows: report.settlements, onRow: (r) => onDetail({ title: "Règlement", ...settlementDetail(r) }),
      block: {
        title: "Règlements versés aux propriétaires",
        columns: [
          idx,
          col("Date", (r) => formatDate(r.date), { width: "13%", nowrap: true, ltr: true }),
          col("Propriétaire", (r) => personName(r.client), { width: "23%", bold: true }),
          col("Véhicule", (r) => carName(r.car), { width: "21%" }),
          col("Prix de vente", (r) => money(r.salePrice), { width: "15%", ...num }),
          col("Part showroom", (r) => money(r.showroomShare), { width: "14%", ...num }),
          col("Net propriétaire", (r) => money(r.ownerAmount), { width: "14%", ...num, bold: true }),
        ],
        rows: report.settlements,
        totals: [{ label: "Total versé aux propriétaires", value: money(sum(report.settlements, (r) => r.ownerAmount)), danger: true }],
      },
    },
    {
      id: "clientSourced",
      title: "15. Véhicules Déposés par des Clients",
      cols: debtPurchaseCols, rows: report.clientSourcedPurchases, onRow: (r) => onDetail({ title: "Véhicule client", ...debtPurchaseDetail(r) }),
      block: {
        title: "Véhicules déposés par des clients",
        columns: [
          idx,
          col("Date", (r) => formatDate(r.date), { width: "13%", nowrap: true, ltr: true }),
          col("Propriétaire", (r) => r.source, { width: "26%", bold: true }),
          col("Véhicule", (r) => carName(r.car), { width: "23%" }),
          col("Total", (r) => money(r.total), { width: "13%", ...num }),
          col("Payé", (r) => money(r.paid), { width: "12%", ...num }),
          col("Reste", (r) => money(r.rest), { width: "13%", ...num, bold: true }),
        ],
        rows: report.clientSourcedPurchases,
        totals: [{ label: "Total", value: money(sum(report.clientSourcedPurchases, (r) => r.total)), danger: true }],
      },
    },
    {
      id: "prestation",
      title: "16. Ventes Prestation (Gains Showroom)",
      cols: prestationCols, rows: report.prestationSales, onRow: (r) => onDetail({ title: "Vente prestation", ...prestationDetail(r) }),
      block: {
        title: "Ventes prestation — gains du showroom",
        columns: [
          idx,
          col("Date", (r) => formatDate(r.date), { width: "13%", nowrap: true, ltr: true }),
          col("Propriétaire", (r) => personName(r.client), { width: "23%", bold: true }),
          col("Véhicule", (r) => carName(r.car), { width: "21%" }),
          col("Prix de vente", (r) => money(r.salePrice), { width: "15%", ...num }),
          col("Part showroom", (r) => money(r.showroomShare), { width: "14%", ...num }),
          col("Gain", (r) => (r.settled ? money(r.showroomGain) : "En attente"), { width: "14%", ...num, bold: true }),
        ],
        rows: report.prestationSales,
        totals: [{ label: "Total gains prestation", value: money(sum(report.prestationSales, (r) => r.showroomGain)), danger: true }],
      },
    },
  ];
}

export default function Reports() {
  const can = useCan();
  const { settings } = useStore();
  const openPrint = usePrintDialog();
  const today = new Date();
  const monthAgo = new Date(today.getFullYear(), today.getMonth() - 11, 1);
  const [from, setFrom] = useState(toDateInput(monthAgo));
  const [to, setTo] = useState(toDateInput(today));
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState("table");
  const [detail, setDetail] = useState(null);

  const generate = async () => {
    setLoading(true);
    try {
      const data = await reportsApi.generate({ from, to });
      setReport(data);
    } finally {
      setLoading(false);
    }
  };

  const parts = useMemo(() => buildParts(report, setDetail), [report]);

  // ── Printing ────────────────────────────────────────────────────────────
  const printPart = (part) =>
    openPrint((lang) => (
      <PeriodReport
        showroom={settings}
        lang={lang}
        from={from}
        to={to}
        title={part.title.replace(/^\d+\.\s*/, "")}
        subtitle={`${settings?.name || "Showroom"} — Rapport de période`}
        stats={
          part.stats || [
            { label: "Nombre de lignes", value: String(part.block.rows?.length || 0) },
            ...(part.block.totals || []).slice(-1).map((tt) => ({ label: tt.label, value: tt.value, accent: true })),
          ]
        }
        blocks={[part.block]}
      />
    ));

  const printAll = () => {
    if (!report) return;
    const s = report.synthese;
    openPrint((lang) => (
      <PeriodReport
        showroom={settings}
        lang={lang}
        from={from}
        to={to}
        title="Rapport Général"
        subtitle="Toutes les activités du showroom sur la période"
        stats={[
          { label: "Ventes", value: money(s.totalSalesAmount) },
          { label: "Achats", value: money(s.totalPurchaseAmount) },
          { label: "Bénéfice net", value: money(s.netProfit) },
          { label: "Caisse (net)", value: money(s.caisseNet), accent: true },
        ]}
        blocks={parts.map((p) => p.block)}
      />
    ));
  };

  return (
    <div>
      <div className="no-print">
        <PageHeader title="Rapports" subtitle="Toutes les activités du showroom sur une période, partie par partie">
          {report && can("reports", "print") && (
            <motion.button className="btn-ghost" onClick={printAll} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
              <FileText size={16} /> Imprimer tout le rapport
            </motion.button>
          )}
        </PageHeader>
        <Card className="p-5 mb-6">
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <Field label="Du" className="flex-1"><DateInput value={from} onChange={setFrom} /></Field>
            <Field label="Au" className="flex-1"><DateInput value={to} onChange={setTo} /></Field>
            <motion.button className="btn-primary" onClick={generate} disabled={loading} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
              {loading ? <motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="inline-flex"><Loader2 size={16} /></motion.span> : "Générer"}
            </motion.button>
            {report && (
              <div className="flex gap-1">
                <button className={`chip ${view === "cards" ? "chip-active" : ""}`} onClick={() => setView("cards")}><LayoutGrid size={14} /></button>
                <button className={`chip ${view === "table" ? "chip-active" : ""}`} onClick={() => setView("table")}><TableIcon size={14} /></button>
              </div>
            )}
          </div>
          {report && (
            <p className="text-xs text-text-muted mt-3">
              Période : <span className="text-text-primary font-bold">{formatDate(from)} → {formatDate(to)}</span> · Chaque partie ci-dessous a son propre bouton « Imprimer ».
            </p>
          )}
        </Card>
      </div>

      {!report ? (
        <div className="no-print"><EmptyState icon={FileBarChart} message="Sélectionnez une période et générez le rapport" /></div>
      ) : (
        <div className="print-report">
          {/* Debt alerts */}
          {(report.alerts?.clientDebtCount > 0 || report.alerts?.purchaseDebtCount > 0) && (
            <div className="glass-card p-4 mb-5 border border-rose-500/40 bg-rose-500/5 flex items-start gap-3">
              <span className="p-2 rounded-xl bg-rose-500/15 text-rose-400 shrink-0"><AlertTriangle size={20} /></span>
              <div className="flex-1 min-w-0">
                <p className="heading text-sm text-rose-400">Alertes dettes</p>
                <p className="text-xs text-text-muted mt-0.5">
                  {report.alerts.clientDebtCount} dette(s) clients — <span className="text-rose-400 font-bold">{money(report.alerts.clientDebtTotal)}</span>
                  {"  ·  "}
                  {report.alerts.purchaseDebtCount} dette(s) sur achats — <span className="text-rose-400 font-bold">{money(report.alerts.purchaseDebtTotal)}</span>
                </p>
              </div>
            </div>
          )}

          {parts.map((part) =>
            part.id === "synthese" ? (
              <Section key={part.id} title={part.title} onPrint={can("reports", "print") ? () => printPart(part) : undefined}>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    ["Ventes", `${report.synthese.totalSalesCount} op.`, money(report.synthese.totalSalesAmount), "text-emerald-400"],
                    ["Achats", `${report.synthese.totalPurchaseCount} op.`, money(report.synthese.totalPurchaseAmount), "text-violet-400"],
                    ["Dépenses véhicules", "", money(report.synthese.totalCarExpenses), "text-amber-400"],
                    ["Dépenses showroom", "", money(report.synthese.totalShowroomExpenses), "text-amber-400"],
                    ["Versements encaissés", "", money(report.synthese.totalVersements), "text-emerald-400"],
                    ["Salaires versés", "", money(report.synthese.totalPayrollPaid), "text-cyan-400"],
                    ["Règlements propriétaires", "", money(report.synthese.totalSettlements), "text-fuchsia-300"],
                    ["Bénéfice brut", "", money(report.synthese.grossProfit), "text-emerald-400"],
                    ["Bénéfice net", "", money(report.synthese.netProfit), "text-emerald-400"],
                    ["Total bénéfices", "", money(report.synthese.totalGains), "text-emerald-400"],
                    ["Solde de caisse", "", money(report.synthese.totalCashIn - report.synthese.totalCashOut), "text-sky-400"],
                    ["Caisse (net)", "Bénéfices − dépenses", money(report.synthese.caisseNet), report.synthese.caisseNet >= 0 ? "text-emerald-400" : "text-rose-400"],
                  ].map(([label, count, amount, color]) => (
                    <motion.div key={label} whileHover={{ scale: 1.03 }} className="glass-card p-3">
                      <p className="label-caps">{label}</p>
                      {count && <p className="text-text-primary text-xs">{count}</p>}
                      <p className={`font-black ${color}`}>{amount}</p>
                    </motion.div>
                  ))}
                </div>
              </Section>
            ) : (
              <Section
                key={part.id}
                title={part.title}
                count={part.rows?.length || 0}
                onPrint={can("reports", "print") ? () => printPart(part) : undefined}
              >
                <DataBlock cols={part.cols} rows={part.rows} view={view} onRow={part.onRow} />
              </Section>
            )
          )}
        </div>
      )}

      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.title || "Détails"} size="md">
        <DetailView detail={detail} />
      </Modal>
    </div>
  );
}
