import { useState } from "react";
import { motion } from "framer-motion";
import { Printer, FileBarChart, Loader2, LayoutGrid, Table as TableIcon, ChevronRight, TrendingUp, AlertTriangle } from "lucide-react";
import { reportsApi } from "../lib/api.js";
import { useStore } from "../store/useStore.js";
import { useCan } from "../lib/permissions.js";
import { Card, Field, EmptyState, Modal, Badge } from "../components/ui.jsx";
import PageHeader from "../components/PageHeader.jsx";
import { CarImage } from "../components/CarCard.jsx";
import { formatAmount, formatDate, toDateInput } from "../utils/format.js";
import DateInput from "../components/DateInput.jsx";

const money = (v) => formatAmount(v);

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
                transition={{ delay: i * 0.02 }}
                onClick={() => onRow(r)}
                className={`border-b border-red-600/10 cursor-pointer hover:bg-red-600/8 ${i % 2 ? "bg-white/[0.015]" : ""}`}
              >
                {cols.map((c) => <td key={c.key} className={`p-3 ${c.cls || "text-text-primary"}`}>{c.render ? c.render(r) : r[c.key]}</td>)}
                <td className="p-3 text-text-muted"><ChevronRight size={15} /></td>
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
          transition={{ delay: i * 0.03 }}
          whileHover={{ y: -3 }}
          onClick={() => onRow(r)}
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

function Section({ title, children }) {
  return (
    <motion.section
      className="glass-card p-5 mb-5"
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
    >
      <h3 className="heading text-sm text-text-primary mb-4">{title}</h3>
      {children}
    </motion.section>
  );
}

// Detail modal content — flexible key/value renderer
function DetailView({ detail }) {
  if (!detail) return null;
  const { car, client, rows } = detail;
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

export default function Reports() {
  const can = useCan();
  const { settings } = useStore();
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
  const doPrint = () => window.print();

  // column configs
  const salesCols = [
    { key: "client", label: "Client", render: (s) => `${s.client?.firstName || ""} ${s.client?.lastName || ""}` },
    { key: "car", label: "Véhicule", render: (s) => `${s.car?.brand} ${s.car?.model}`, cls: "text-text-muted" },
    { key: "total", label: "Total", render: (s) => money(s.totalAfterReduction), cls: "text-text-primary font-bold" },
    { key: "profit", label: "Profit", render: (s) => {
      const profit = s.totalAfterReduction - (s.purchasePrice || 0);
      return <span className={profit >= 0 ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}><TrendingUp size={12} className="inline mr-1" />{money(profit)}</span>;
    }, cls: "" },
    { key: "rest", label: "Reste", render: (s) => money(s.amountRest), cls: "text-rose-400" },
    { key: "date", label: "Date", render: (s) => formatDate(s.date), cls: "text-text-muted" },
  ];
  const purchaseCols = [
    { key: "ref", label: "Véhicule", render: (p) => `${p.car?.brand} ${p.car?.model}` },
    { key: "src", label: "Source", render: (p) => (p.sourceType === "CLIENT" ? "Dépôt client" : "Showroom"), cls: "text-text-muted" },
    { key: "price", label: "Prix", render: (p) => money(p.purchasePrice), cls: "text-text-primary font-bold" },
    { key: "rest", label: "Reste", render: (p) => money(p.amountRest), cls: "text-rose-400" },
    { key: "date", label: "Date", render: (p) => formatDate(p.date), cls: "text-text-muted" },
  ];
  const carCols = [
    { key: "car", label: "Véhicule", render: (c) => `${c.car?.brand} ${c.car?.model}` },
    { key: "cost", label: "Coût total", render: (c) => money(c.totalCost), cls: "text-text-muted" },
    { key: "sale", label: "Vente", render: (c) => money(c.salePrice), cls: "text-text-primary" },
    { key: "net", label: "Marge nette", render: (c) => <span className={`font-bold flex items-center gap-1 ${c.netMargin >= 0 ? "text-emerald-400" : "text-rose-400"}`}><TrendingUp size={12} />{money(c.netMargin)}</span> },
    { key: "pct", label: "%", render: (c) => <span className={c.netMargin >= 0 ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>{c.netMarginPct}%</span>, cls: "" },
  ];
  const debtClientCols = [
    { key: "client", label: "Client", render: (d) => `${d.client?.firstName || ""} ${d.client?.lastName || ""}` },
    { key: "car", label: "Véhicule", render: (d) => `${d.car?.brand} ${d.car?.model}`, cls: "text-text-muted" },
    { key: "rest", label: "Reste", render: (d) => money(d.rest), cls: "text-rose-400 font-bold" },
    { key: "date", label: "Date", render: (d) => formatDate(d.date), cls: "text-text-muted" },
  ];
  const debtPurchaseCols = [
    { key: "source", label: "Source", render: (d) => d.source },
    { key: "car", label: "Véhicule", render: (d) => `${d.car?.brand} ${d.car?.model}`, cls: "text-text-muted" },
    { key: "rest", label: "Reste", render: (d) => money(d.rest), cls: "text-rose-400 font-bold" },
    { key: "date", label: "Date", render: (d) => formatDate(d.date), cls: "text-text-muted" },
  ];
  const payrollCols = [
    { key: "fullName", label: "Employé", render: (p) => p.fullName },
    { key: "role", label: "Rôle", render: (p) => p.role, cls: "text-text-muted" },
    { key: "net", label: "Net payé", render: (p) => money(p.netPaid), cls: "text-emerald-400 font-bold" },
    { key: "abs", label: "Absences", render: (p) => money(p.absences), cls: "text-rose-400" },
  ];
  const expenseCols = [
    { key: "name", label: "Nom", render: (e) => e.name },
    { key: "desc", label: "Description", render: (e) => e.description || "—", cls: "text-text-muted" },
    { key: "amount", label: "Montant", render: (e) => money(e.amount), cls: "text-amber-400 font-bold" },
    { key: "date", label: "Date", render: (e) => formatDate(e.date), cls: "text-text-muted" },
  ];
  const prestationCols = [
    { key: "client", label: "Propriétaire", render: (p) => `${p.client?.firstName || ""} ${p.client?.lastName || ""}` },
    { key: "car", label: "Véhicule", render: (p) => `${p.car?.brand} ${p.car?.model}`, cls: "text-text-muted" },
    { key: "sale", label: "Prix vente", render: (p) => money(p.salePrice), cls: "text-text-primary" },
    { key: "share", label: "Part showroom", render: (p) => money(p.showroomShare), cls: "text-text-muted" },
    { key: "gain", label: "Gain showroom", render: (p) => p.settled
        ? <span className={p.showroomGain >= 0 ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}><TrendingUp size={12} className="inline mr-1" />{money(p.showroomGain)}</span>
        : <span className="text-amber-400">En attente</span> },
    { key: "date", label: "Date", render: (p) => formatDate(p.date), cls: "text-text-muted" },
  ];

  // row → detail object
  const saleDetail = (s) => ({ car: s.car, rows: [["Client", `${s.client?.firstName} ${s.client?.lastName}`], ["Téléphone", s.client?.phonePrimary], ["Véhicule", `${s.car?.brand} ${s.car?.model}`], ["Plaque", s.car?.plate], ["Prix de vente", money(s.totalAfterReduction)], ["Achat initial", money(s.purchasePrice || 0)], ["Profit", money(s.totalAfterReduction - (s.purchasePrice || 0))], ["Payé", money(s.amountPaid)], ["Date", formatDate(s.date)]] });
  const purchaseDetail = (p) => ({ car: p.car, rows: [["Référence", p.reference], ["Véhicule", `${p.car?.brand} ${p.car?.model}`], ["Plaque", p.car?.plate], ["Source", p.sourceType === "CLIENT" ? (p.client ? `${p.client.firstName} ${p.client.lastName}` : "—") : "Showroom"], ["Prix", money(p.purchasePrice)], ["Payé", money(p.amountPaid)], ["Reste", money(p.amountRest)], ["Date", formatDate(p.date)]] });
  const carDetail = (c) => ({ car: c.car, expenseList: c.expenseList, rows: [["Véhicule", `${c.car?.brand} ${c.car?.model}`], ["Plaque", c.car?.plate], ["Prix d'achat", money(c.purchasePrice)], ["Dépenses", money(c.expenses)], ["Coût total", money(c.totalCost)], ["Prix de vente", money(c.salePrice)], ["Profit brut", money(c.grossMargin)], ["Profit net", money(c.netMargin)], ["Marge %", `${c.netMarginPct}%`]] });
  const debtClientDetail = (d) => ({ car: d.car, rows: [["Client", `${d.client?.firstName} ${d.client?.lastName}`], ["Véhicule", `${d.car?.brand} ${d.car?.model}`], ["Total", money(d.total)], ["Payé", money(d.paid)], ["Reste", money(d.rest)], ["Date", formatDate(d.date)]] });
  const debtPurchaseDetail = (d) => ({ car: d.car, rows: [["Source", d.source], ["Véhicule", `${d.car?.brand} ${d.car?.model}`], ["Total", money(d.total)], ["Payé", money(d.paid)], ["Reste", money(d.rest)], ["Date", formatDate(d.date)]] });
  const payrollDetail = (p) => ({ rows: [["Employé", p.fullName], ["Rôle", p.role], ["Type", p.paymentType], ["Salaire base", money(p.baseSalary)], ["Acomptes", money(p.advances)], ["Absences", money(p.absences)], ["Net payé", money(p.netPaid)]] });
  const expenseDetail = (e) => ({ rows: [["Nom", e.name], ["Description", e.description || "—"], ["Montant", money(e.amount)], ["Date", formatDate(e.date)]] });
  const prestationDetail = (p) => ({ car: p.car, rows: [["Propriétaire", `${p.client?.firstName || ""} ${p.client?.lastName || ""}`], ["Véhicule", `${p.car?.brand} ${p.car?.model}`], ["Prix de vente", money(p.salePrice)], ["Part showroom", money(p.showroomShare)], ["Dépenses véhicule", money(p.expenses)], ["Gain showroom", p.settled ? money(p.showroomGain) : "En attente de règlement"], ["Réglé", p.settled ? "Oui" : "Non"], ["Date", formatDate(p.date)]] });

  return (
    <div>
      <div className="no-print">
        <PageHeader title="Rapports" />
        <Card className="p-5 mb-6">
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <Field label="Du" className="flex-1"><DateInput value={from} onChange={setFrom} /></Field>
            <Field label="Au" className="flex-1"><DateInput value={to} onChange={setTo} /></Field>
            <motion.button className="btn-primary" onClick={generate} disabled={loading} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
              {loading ? <motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="inline-flex"><Loader2 size={16} /></motion.span> : "Générer"}
            </motion.button>
            {report && (
              <>
                <div className="flex gap-1">
                  <button className={`chip ${view === "cards" ? "chip-active" : ""}`} onClick={() => setView("cards")}><LayoutGrid size={14} /></button>
                  <button className={`chip ${view === "table" ? "chip-active" : ""}`} onClick={() => setView("table")}><TableIcon size={14} /></button>
                </div>
                {can("reports", "print") && <button className="btn-ghost" onClick={doPrint}><Printer size={14} /> Imprimer</button>}
              </>
            )}
          </div>
        </Card>
      </div>

      {!report ? (
        <div className="no-print"><EmptyState icon={FileBarChart} message="Sélectionnez une période et générez le rapport" /></div>
      ) : (
        <div className="print-report">
          <div className="print-only mb-4" style={{ textAlign: "center" }}>
            <h2 style={{ fontWeight: 900 }}>{settings?.name} — Rapport</h2>
            <p>Période : {formatDate(from)} → {formatDate(to)}</p>
          </div>

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

          <Section title="1. Synthèse Globale">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                ["Ventes", `${report.synthese.totalSalesCount} op.`, money(report.synthese.totalSalesAmount), "text-emerald-400"],
                ["Achats", `${report.synthese.totalPurchaseCount} op.`, money(report.synthese.totalPurchaseAmount), "text-violet-400"],
                ["Dépenses véhicules", "", money(report.synthese.totalCarExpenses), "text-amber-400"],
                ["Dépenses showroom", "", money(report.synthese.totalShowroomExpenses), "text-amber-400"],
                ["Bénéfice brut", "", money(report.synthese.grossProfit), "text-emerald-400"],
                ["Bénéfice net", "", money(report.synthese.netProfit), "text-emerald-400"],
              ].map(([label, count, amount, color]) => (
                <motion.div key={label} whileHover={{ scale: 1.03 }} className="glass-card p-3">
                  <p className="label-caps">{label}</p>
                  {count && <p className="text-text-primary text-xs">{count}</p>}
                  <p className={`font-black ${color}`}>{amount}</p>
                </motion.div>
              ))}
            </div>
          </Section>

          <Section title="2. Ventes"><DataBlock cols={salesCols} rows={report.sales} view={view} onRow={(r) => setDetail({ title: "Vente", ...saleDetail(r) })} /></Section>
          <Section title="3. Achats"><DataBlock cols={purchaseCols} rows={report.purchases} view={view} onRow={(r) => setDetail({ title: "Achat", ...purchaseDetail(r) })} /></Section>
          <Section title="4. Analyse par Véhicule"><DataBlock cols={carCols} rows={report.carAnalysis} view={view} onRow={(r) => setDetail({ title: "Analyse véhicule", ...carDetail(r) })} /></Section>
          <Section title="5. Dépenses Showroom"><DataBlock cols={expenseCols} rows={report.showroomExpenses} view={view} onRow={(r) => setDetail({ title: "Dépense", ...expenseDetail(r) })} /></Section>
          <Section title="6. Dettes Clients"><DataBlock cols={debtClientCols} rows={report.clientDebts} view={view} onRow={(r) => setDetail({ title: "Dette client", ...debtClientDetail(r) })} /></Section>
          <Section title="7. Dettes sur Achats"><DataBlock cols={debtPurchaseCols} rows={report.purchaseDebts} view={view} onRow={(r) => setDetail({ title: "Dette", ...debtPurchaseDetail(r) })} /></Section>
          <Section title="8. Employés & Salaires"><DataBlock cols={payrollCols} rows={report.payroll} view={view} onRow={(r) => setDetail({ title: "Salaire", ...payrollDetail(r) })} /></Section>
          <Section title="9. Ventes de Véhicules de Clients"><DataBlock cols={debtPurchaseCols} rows={report.clientSourcedPurchases} view={view} onRow={(r) => setDetail({ title: "Véhicule client", ...debtPurchaseDetail(r) })} /></Section>
          <Section title="10. Ventes Prestation (Gains Showroom)"><DataBlock cols={prestationCols} rows={report.prestationSales} view={view} onRow={(r) => setDetail({ title: "Vente prestation", ...prestationDetail(r) })} /></Section>
        </div>
      )}

      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.title || "Détails"} size="md">
        <DetailView detail={detail} />
      </Modal>
    </div>
  );
}
