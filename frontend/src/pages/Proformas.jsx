import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Eye, Pencil, Trash2, Printer, Search, FileText, LayoutGrid, Table as TableIcon, CalendarDays, Wallet, AlertTriangle, Plus } from "lucide-react";
import { proformasApi } from "../lib/api.js";
import { useFetch } from "../hooks/useApi.js";
import { useCan } from "../lib/permissions.js";
import { useStore } from "../store/useStore.js";
import { Card, Badge, Modal, ConfirmModal, EmptyState, SkeletonGrid, AnimatedGrid, useToast } from "../components/ui.jsx";
import PageHeader from "../components/PageHeader.jsx";
import ActionMenu from "../components/ActionMenu.jsx";
import { CarImage } from "../components/CarCard.jsx";
import SaleWizard, { DocPreview, invoiceTotals } from "../components/SaleWizard.jsx";
import { FactureDocument } from "../components/PrintDocs.jsx";
import { usePrintDialog } from "../components/PrintChooser.jsx";
import { formatAmount, formatDate, formatDateTime, initials } from "../utils/format.js";

const totalsOf = (p) => invoiceTotals({
  basePrice: p.totalBeforeTax, tvaEnabled: p.tvaEnabled, tvaRate: p.tvaRate,
  reductionType: p.reductionType, reductionValue: p.reductionValue,
  stampEnabled: p.stampEnabled, stampRate: p.stampRate, showroomShare: p.showroomShare,
});

const clientName = (c) => `${c?.firstName || ""} ${c?.lastName || ""}`.trim() || "—";
const carName = (c) => [c?.brand, c?.model].filter(Boolean).join(" ") || "—";

export default function Proformas() {
  const { t } = useTranslation();
  const can = useCan();
  const toast = useToast();
  const { settings, user } = useStore();
  const openPrint = usePrintDialog();
  const { data: proformas, loading, refetch } = useFetch(() => proformasApi.list(), []);
  const [search, setSearch] = useState("");
  const [view, setView] = useState("cards");
  const [viewItem, setViewItem] = useState(null);
  const [editItem, setEditItem] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const canEdit = can("proformas", "edit") || can("pos", "edit");
  const canDelete = can("proformas", "delete");
  const canPrint = can("proformas", "print") || can("proformas", "view");

  const q = search.trim().toLowerCase();
  const list = (proformas || []).filter((p) => !q || [
    p.reference, clientName(p.client), p.client?.phonePrimary, carName(p.car), p.car?.plate, p.car?.vin,
  ].some((v) => String(v || "").toLowerCase().includes(q)));

  const now = new Date();
  const thisMonth = (proformas || []).filter((p) => {
    const d = new Date(p.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const totalAmount = list.reduce((a, p) => a + totalsOf(p).grandTotal, 0);
  const hasLocal = (proformas || []).some((p) => p.local);

  const print = (p) => openPrint((lang) => (
    <FactureDocument sale={p} showroom={settings} lang={lang} proforma invoiceNumber={p.reference} />
  ));

  const confirmDelete = async () => {
    if (!deleteItem) return;
    setDeleting(true);
    try {
      await proformasApi.delete(deleteItem.id, { local: deleteItem.local });
      toast(t("proforma.deletedToast"), "info");
      setDeleteItem(null);
      if (viewItem?.id === deleteItem.id) setViewItem(null);
      refetch();
    } catch (e) {
      toast(e?.message || t("proforma.saveError"), "error");
    } finally {
      setDeleting(false);
    }
  };

  const menuItems = (p) => [
    { label: t("common.view"), icon: Eye, onClick: () => setViewItem(p) },
    canEdit && { label: t("common.edit"), icon: Pencil, onClick: () => setEditItem(p) },
    canPrint && { label: t("proforma.print"), icon: Printer, onClick: () => print(p) },
    canDelete && { label: t("common.delete"), icon: Trash2, danger: true, onClick: () => setDeleteItem(p) },
  ];

  return (
    <div>
      <PageHeader title={t("proforma.historyTitle")}>
        {(can("pos", "create") || can("proformas", "create")) && (
          <Link to="/app/pos" className="btn-primary text-sm"><Plus size={15} /> {t("proforma.newFromPos")}</Link>
        )}
      </PageHeader>

      {hasLocal && user?.isAdmin && (
        <Card className="p-3 mb-5 border border-amber-500/40 bg-amber-500/5 flex gap-2 items-start text-sm">
          <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
          <span className="text-text-muted">{t("proforma.localWarning")}</span>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {[
          { icon: FileText, label: t("proforma.statCount"), value: (proformas || []).length, cls: "text-text-primary", grad: "from-red-600/30 to-red-900/10" },
          { icon: CalendarDays, label: t("proforma.statMonth"), value: thisMonth.length, cls: "text-amber-400", grad: "from-amber-500/25 to-red-900/10" },
          { icon: Wallet, label: t("proforma.statTotal"), value: formatAmount(totalAmount), cls: "text-emerald-400", grad: "from-emerald-500/20 to-red-900/10" },
        ].map((s) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card className={`p-4 flex items-center gap-3 bg-gradient-to-br ${s.grad}`}>
              <div className="w-11 h-11 rounded-xl bg-black/40 border border-red-600/30 flex items-center justify-center"><s.icon size={19} className="text-red-400" /></div>
              <div className="min-w-0">
                <p className="label-caps !mb-0">{s.label}</p>
                <p className={`text-xl font-black truncate ${s.cls}`}>{s.value}</p>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6 sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
          <input className="input pl-9 rtl:pl-3 rtl:pr-9" placeholder={t("proforma.searchPlaceholder")} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2">
          <button className={`chip ${view === "cards" ? "chip-active" : ""}`} onClick={() => setView("cards")}><LayoutGrid size={13} /></button>
          <button className={`chip ${view === "table" ? "chip-active" : ""}`} onClick={() => setView("table")}><TableIcon size={13} /></button>
        </div>
      </div>

      {loading ? <SkeletonGrid /> : list.length === 0 ? (
        <EmptyState icon={FileText} message={t("proforma.empty")} />
      ) : view === "cards" ? (
        <AnimatedGrid className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {list.map((p) => {
            const tot = totalsOf(p);
            return (
              <Card key={`${p.local ? "l" : "d"}-${p.id}`} className="p-4 flex gap-4 border border-amber-500/20 hover:border-amber-500/40 transition-colors">
                <div className="w-24 h-[72px] rounded-lg overflow-hidden shrink-0"><CarImage images={p.car?.images} heightClass="h-[72px]" fit="cover" /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0">
                      <p className="heading text-sm text-text-primary truncate">{clientName(p.client)}</p>
                      <p className="text-xs text-text-muted"><span className="font-mono text-amber-300">{p.reference}</span> · {formatDate(p.date)}</p>
                    </div>
                    <ActionMenu items={menuItems(p)} />
                  </div>
                  <p className="text-xs text-text-muted my-1 truncate">{carName(p.car)}{p.car?.plate ? ` · ${p.car.plate}` : ""}</p>
                  <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-red-600/10">
                    <div className="flex gap-1.5 flex-wrap">
                      <Badge color="warning"><FileText size={10} /> {t("proforma.badge")}</Badge>
                      {p.tvaEnabled && <Badge color="muted">TVA {p.tvaRate}%</Badge>}
                    </div>
                    <span className="text-emerald-400 font-black">{formatAmount(tot.grandTotal)}</span>
                  </div>
                </div>
              </Card>
            );
          })}
        </AnimatedGrid>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left rtl:text-right bg-red-600/10 border-b border-red-600/30">
                {["N°", t("common.client"), t("common.vehicle"), t("proforma.totalHT"), t("proforma.totalTTC"), t("common.date"), ""].map((h, i) => (
                  <th key={i} className="p-3.5 label-caps !text-red-300/80 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((p, i) => {
                const tot = totalsOf(p);
                return (
                  <motion.tr
                    key={`${p.local ? "l" : "d"}-${p.id}`}
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                    className={`border-b border-red-600/10 hover:bg-red-600/8 ${i % 2 ? "bg-white/[0.015]" : ""}`}
                  >
                    <td className="p-3 font-mono text-xs text-amber-300">{p.reference}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-500 to-red-800 text-white flex items-center justify-center text-[0.6rem] font-black shrink-0">{initials(clientName(p.client))}</div>
                        <span className="text-text-primary">{clientName(p.client)}</span>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className="w-10 h-7 rounded overflow-hidden shrink-0"><CarImage images={p.car?.images} heightClass="h-7" fit="cover" /></div>
                        <span className="text-text-muted">{carName(p.car)}</span>
                      </div>
                    </td>
                    <td className="p-3 text-text-primary">{formatAmount(tot.base)}</td>
                    <td className="p-3 text-emerald-400 font-black">{formatAmount(tot.grandTotal)}</td>
                    <td className="p-3 text-text-muted whitespace-nowrap">{formatDate(p.date)}</td>
                    <td className="p-3"><ActionMenu items={menuItems(p)} /></td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {/* Details */}
      <Modal open={!!viewItem} onClose={() => setViewItem(null)} title={`${t("proforma.detail")} — ${viewItem?.reference || ""}`} size="lg">
        {viewItem && (() => {
          const tot = totalsOf(viewItem);
          return (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Card className="p-3.5">
                  <p className="label-caps">{t("common.client")}</p>
                  <p className="text-text-primary font-bold">{clientName(viewItem.client)}</p>
                  <p className="text-xs text-text-muted">{viewItem.client?.phonePrimary || "—"}</p>
                  {viewItem.client?.address && <p className="text-xs text-text-muted">{viewItem.client.address}</p>}
                </Card>
                <Card className="p-3.5">
                  <p className="label-caps">{t("common.vehicle")}</p>
                  <p className="text-text-primary font-bold">{carName(viewItem.car)} {viewItem.car?.year || ""}</p>
                  <p className="text-xs text-text-muted">{[viewItem.car?.plate, viewItem.car?.color].filter(Boolean).join(" · ") || "—"}</p>
                  {viewItem.car?.vin && <p className="text-xs text-text-muted font-mono">{viewItem.car.vin}</p>}
                </Card>
              </div>
              <div className="glass-card p-3.5 rounded-xl border border-red-600/20 bg-gradient-to-r from-red-950/30 via-black/40 to-red-950/20">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  {[
                    [t("proforma.totalHT"), formatAmount(tot.base), "text-text-primary"],
                    [`${t("pos.tva")} ${tot.rate}%`, formatAmount(tot.tva), "text-text-primary"],
                    [t("pos.reduction"), tot.reduction ? `- ${formatAmount(tot.reduction)}` : "—", "text-amber-400"],
                    [`${t("proforma.stamp")} ${tot.sRate}%`, formatAmount(tot.stamp), "text-text-primary"],
                    [t("pos.showroomShare"), formatAmount(tot.part), "text-red-300"],
                    [t("proforma.paymentMethod"), viewItem.paymentMethod || "—", "text-text-primary"],
                    [t("common.date"), formatDateTime(viewItem.date), "text-text-primary"],
                    [t("proforma.totalTTC"), formatAmount(tot.grandTotal), "text-emerald-400 font-black text-sm"],
                  ].map(([k, v, cls]) => (
                    <div key={k} className="bg-white/5 p-2 rounded-lg border border-white/5">
                      <p className="text-text-muted text-[10px]">{k}</p>
                      <p className={`font-bold mt-0.5 ${cls}`}>{v}</p>
                    </div>
                  ))}
                </div>
              </div>
              <DocPreview maxHeight={520}>
                <FactureDocument sale={viewItem} showroom={settings} lang="fr" proforma invoiceNumber={viewItem.reference} />
              </DocPreview>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {canEdit && <button className="btn-ghost" onClick={() => { setEditItem(viewItem); setViewItem(null); }}><Pencil size={14} /> {t("common.edit")}</button>}
                {canPrint && <button className="btn-primary" onClick={() => print(viewItem)}><Printer size={14} /> {t("proforma.print")}</button>}
                {canDelete && <button className="btn-ghost !text-rose-400" onClick={() => setDeleteItem(viewItem)}><Trash2 size={14} /> {t("common.delete")}</button>}
              </div>
            </div>
          );
        })()}
      </Modal>

      <AnimatePresence>
        {editItem && (
          <SaleWizard
            mode="proforma"
            proforma={editItem}
            car={editItem.car || {}}
            onClose={() => setEditItem(null)}
            onDone={() => { setEditItem(null); toast(t("proforma.updatedToast")); refetch(); }}
          />
        )}
      </AnimatePresence>

      <ConfirmModal
        open={!!deleteItem}
        onClose={() => setDeleteItem(null)}
        onConfirm={confirmDelete}
        loading={deleting}
        title={t("proforma.deleteTitle")}
        message={t("proforma.deleteMessage", { ref: deleteItem?.reference || "" })}
      />
    </div>
  );
}
