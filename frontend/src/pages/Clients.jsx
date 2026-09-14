import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Eye, Pencil, Trash2, History, Phone, Users, Mail, HandCoins, Printer,
  Car as CarIcon, ChevronRight,
} from "lucide-react";
import { clientsApi, settlementsApi, salesApi } from "../lib/api.js";
import { useFetch } from "../hooks/useApi.js";
import { useCan } from "../lib/permissions.js";
import { useStore } from "../store/useStore.js";
import { Card, Badge, Modal, ConfirmModal, EmptyState, SkeletonGrid, AnimatedGrid, Field, useToast } from "../components/ui.jsx";
import PageHeader from "../components/PageHeader.jsx";
import ActionMenu from "../components/ActionMenu.jsx";
import ClientForm, { validateClient } from "../components/ClientForm.jsx";
import { CarImage } from "../components/CarCard.jsx";
import { SettlementReceipt } from "../components/PrintDocs.jsx";
import PrintHub from "../components/PrintHub.jsx";
import { formatAmount, formatDate, initials, toDateTimeLocal } from "../utils/format.js";
import DateInput from "../components/DateInput.jsx";

/* ---------------------------------------------------------------------------
 * Règlement propriétaire
 * When a vehicle left at the showroom by a client ("Prestation / Dépôt client")
 * is sold, the owner is owed:
 *      prix de vente − part du showroom − dépenses engagées sur le véhicule
 * Until the règlement is created an alert is shown on the dashboard, on the top
 * bar, on the sidebar Clients entry and here.
 * ------------------------------------------------------------------------- */
function SettlementForm({ pending, onClose, onCreated }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [share, setShare] = useState(String(pending.showroomShare ?? 0));
  const [paymentMethod, setPaymentMethod] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(toDateTimeLocal());
  const [saving, setSaving] = useState(false);

  const salePrice = Number(pending.salePrice) || 0;
  const expensesTotal = Number(pending.expensesTotal) || 0;
  const showroomShare = Number(share) || 0;
  const ownerAmount = salePrice - showroomShare - expensesTotal;

  const submit = async () => {
    setSaving(true);
    try {
      // The share can be corrected here; keep the sale in sync with it.
      if (showroomShare !== Number(pending.showroomShare || 0)) {
        await salesApi.update(pending.saleId, { showroomShare });
      }
      const created = await settlementsApi.create({
        clientId: pending.clientId,
        carId: pending.carId,
        saleId: pending.saleId,
        purchaseId: pending.purchaseId,
        salePrice,
        showroomShare,
        expensesTotal,
        ownerAmount,
        expenses: pending.expenses,
        paymentMethod,
        note,
        date: new Date(date).toISOString(),
      });
      toast(t("settlements.createdToast"));
      onCreated(created);
    } catch (e) {
      alert(e?.message || t("common.error"));
    } finally {
      setSaving(false);
    }
  };

  const car = pending.car || {};

  return (
    <Modal
      open
      onClose={onClose}
      title={t("settlements.newTitle")}
      size="lg"
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>{t("common.cancel")}</button>
          <button className="btn-primary" onClick={submit} disabled={saving}>
            {saving ? "..." : <><HandCoins size={14} /> {t("settlements.create")}</>}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Vehicle + owner */}
        <div className="flex items-center gap-3 glass-card p-3 !rounded-xl">
          <div className="w-20 h-14 rounded-lg overflow-hidden shrink-0"><CarImage images={car.images} heightClass="h-14" /></div>
          <div className="min-w-0 flex-1">
            <p className="heading text-sm text-text-primary truncate">{car.brand} {car.model}</p>
            <p className="text-xs text-text-muted truncate">
              {car.plate || "—"} · {t("settlements.saleRef")} {pending.sale?.reference} · {formatDate(pending.date)}
            </p>
          </div>
          <Badge color="warning">{t("pos.depositCar")}</Badge>
        </div>

        {/* Money recap */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <Card className="p-3">
            <p className="label-caps">{t("settlements.salePrice")}</p>
            <p className="text-base font-black text-text-primary">{formatAmount(salePrice)}</p>
          </Card>
          <Card className="p-3">
            <p className="label-caps">{t("pos.showroomShare")}</p>
            <p className="text-base font-black text-red-400">- {formatAmount(showroomShare)}</p>
          </Card>
          <Card className="p-3">
            <p className="label-caps">{t("settlements.expensesTotal")}</p>
            <p className="text-base font-black text-amber-400">- {formatAmount(expensesTotal)}</p>
          </Card>
          <Card className="p-3 border border-emerald-500/40">
            <p className="label-caps">{t("settlements.ownerAmount")}</p>
            <p className={`text-base font-black ${ownerAmount >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
              {formatAmount(ownerAmount)}
            </p>
          </Card>
        </div>

        {/* Expense list */}
        <div>
          <p className="label-caps">{t("settlements.expensesList")}</p>
          {pending.expenses.length === 0 ? (
            <p className="text-sm text-text-muted italic">{t("settlements.noExpense")}</p>
          ) : (
            <div className="space-y-1.5">
              {pending.expenses.map((e, i) => (
                <div key={e.id ?? i} className="flex items-center justify-between text-sm border-b border-red-600/10 py-1.5">
                  <div className="min-w-0">
                    <p className="text-text-primary truncate">{e.name}</p>
                    <p className="text-xs text-text-muted truncate">{formatDate(e.date)}{e.description ? ` · ${e.description}` : ""}</p>
                  </div>
                  <span className="text-amber-400 font-bold shrink-0">{formatAmount(e.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Editable fields */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label={t("pos.showroomShare")}>
            <input className="input" type="number" value={share} onChange={(e) => setShare(e.target.value)} />
          </Field>
          <Field label={t("settlements.paymentMethod")}>
            <input className="input" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} placeholder={t("settlements.paymentMethodHint")} />
          </Field>
          <Field label={t("common.datetime")}>
            <DateInput withTime value={date} onChange={setDate} />
          </Field>
        </div>
        <Field label={t("settlements.note")}>
          <textarea className="input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

export default function Clients() {
  const { t } = useTranslation();
  const can = useCan();
  const { settings, refreshSettlements } = useStore();
  const [params, setParams] = useSearchParams();

  const { data: clients, loading, refetch } = useFetch(() => clientsApi.list(), []);
  const { data: pendingMap, refetch: refetchPending } = useFetch(() => settlementsApi.pendingByClient(), []);

  const [form, setForm] = useState(null);
  const [editId, setEditId] = useState(null);
  const [errors, setErrors] = useState({});
  const [view, setView] = useState(null);
  const [historyOf, setHistoryOf] = useState(null);
  const [history, setHistory] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [saving, setSaving] = useState(false);

  // settlement flow
  const [settleClient, setSettleClient] = useState(null); // client whose pending list is open
  const [settleTarget, setSettleTarget] = useState(null); // the pending sale being settled
  const [printSettlement, setPrintSettlement] = useState(null);

  const pendingOf = (clientId) => (pendingMap || {})[clientId] || [];
  const pendingTotal = Object.values(pendingMap || {}).reduce((a, list) => a + list.length, 0);

  // Arriving from the dashboard / top bar alert: open the first owner to settle.
  useEffect(() => {
    if (params.get("settle") !== "1" || !pendingMap) return;
    const firstId = Object.keys(pendingMap)[0];
    if (firstId && clients) {
      const c = clients.find((x) => String(x.id) === String(firstId));
      if (c) setSettleClient(c);
    }
    params.delete("settle");
    setParams(params, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingMap, clients]);

  const openNew = () => { setForm({}); setEditId(null); setErrors({}); };
  const openEdit = (c) => { setForm({ ...c }); setEditId(c.id); setErrors({}); };

  const save = async () => {
    const errs = validateClient(form);
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true);
    try {
      if (editId) await clientsApi.update(editId, form);
      else await clientsApi.create(form);
      setForm(null);
      refetch();
    } catch (e) {
      alert(e.message || t("common.error"));
    } finally {
      setSaving(false);
    }
  };

  const openHistory = async (c) => {
    setHistoryOf(c);
    setHistory(null);
    setHistory(await clientsApi.history(c.id));
  };

  const confirmDelete = async () => {
    await clientsApi.delete(deleteId);
    setDeleteId(null);
    refetch();
  };

  const afterSettlement = (created) => {
    setSettleTarget(null);
    setSettleClient(null);
    refetchPending();
    refreshSettlements();
    refetch();
    setPrintSettlement(created);
  };

  const settlementDocs = (st) =>
    st
      ? [
          {
            key: "reglement",
            label: t("print.settlement"),
            desc: t("print.settlementDesc"),
            icon: HandCoins,
            render: (lang) => <SettlementReceipt settlement={st} showroom={settings} lang={lang} />,
          },
        ]
      : [];

  const menuItems = (c) => [
    { label: t("common.view"), icon: Eye, onClick: () => setView(c) },
    can("clients", "edit") && { label: t("common.edit"), icon: Pencil, onClick: () => openEdit(c) },
    { label: t("common.history"), icon: History, onClick: () => openHistory(c) },
    // Only the owners who left a vehicle at the showroom can be settled.
    c.hasDepositCars && can("settlements", "create") && {
      label: t("settlements.action"),
      icon: HandCoins,
      onClick: () => setSettleClient(c),
    },
    can("clients", "delete") && { label: t("common.delete"), icon: Trash2, danger: true, onClick: () => setDeleteId(c.id) },
  ];

  return (
    <div>
      <PageHeader title={t("clients.title")} action={can("clients", "create") ? openNew : undefined} actionLabel={t("clients.new")} />

      {/* Global alert: owners waiting for their règlement */}
      {pendingTotal > 0 && (
        <Card className="p-4 mb-5 border border-amber-500/40 bg-amber-500/5">
          <div className="flex items-start gap-3">
            <span className="p-2 rounded-xl bg-amber-500/15 text-amber-400 shrink-0"><HandCoins size={20} /></span>
            <div className="flex-1 min-w-0">
              <p className="heading text-sm text-amber-400">{t("settlements.alertTitle")}</p>
              <p className="text-xs text-text-muted mt-0.5">{t("settlements.alertDesc", { count: pendingTotal })}</p>
              <div className="flex flex-wrap gap-2 mt-3">
                {Object.entries(pendingMap || {}).map(([clientId, list]) => {
                  const c = (clients || []).find((x) => String(x.id) === String(clientId));
                  if (!c) return null;
                  return (
                    <button
                      key={clientId}
                      onClick={() => setSettleClient(c)}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 text-xs font-bold text-amber-400 hover:bg-amber-500/20 transition"
                    >
                      {c.firstName} {c.lastName}
                      <span className="min-w-[1.1rem] h-4 px-1 rounded-full bg-amber-500 text-black flex items-center justify-center text-[0.6rem]">
                        {list.length}
                      </span>
                      <ChevronRight size={13} />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </Card>
      )}

      {loading ? (
        <SkeletonGrid />
      ) : clients?.length === 0 ? (
        <EmptyState icon={Users} message={t("clients.none")} cta={can("clients", "create") ? t("clients.new") : undefined} onCta={openNew} />
      ) : (
        <AnimatedGrid className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {clients.map((c) => {
            const pending = pendingOf(c.id);
            return (
              <Card key={c.id} className={`p-5 ${pending.length ? "border border-amber-500/40" : ""}`}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {c.photo ? (
                      <img src={c.photo} className="w-11 h-11 rounded-full object-cover" alt="" />
                    ) : (
                      <div className="w-11 h-11 rounded-full bg-blue-600/20 text-blue-400 flex items-center justify-center font-black">
                        {initials(`${c.firstName} ${c.lastName}`)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="heading text-sm text-text-primary truncate">{c.firstName} {c.lastName}</p>
                      <p className="text-xs text-text-muted flex items-center gap-1"><Phone size={11} /> {c.phonePrimary}</p>
                    </div>
                  </div>
                  <ActionMenu items={menuItems(c)} />
                </div>

                <div className="flex gap-1.5 mb-3 flex-wrap">
                  {c.email && <Badge color="muted"><Mail size={10} /> {c.email}</Badge>}
                  {c.docType && <Badge color="info">{c.docType}</Badge>}
                  {c.hasDepositCars && <Badge color="warning"><CarIcon size={10} /> {t("settlements.depositBadge", { count: c.stats.depositCars })}</Badge>}
                </div>

                {/* Per-client alert with the direct action */}
                {pending.length > 0 && can("settlements", "create") && (
                  <button
                    onClick={() => setSettleClient(c)}
                    className="w-full flex items-center gap-2 px-3 py-2 mb-3 rounded-xl border border-amber-500/40 bg-amber-500/10 text-xs font-bold text-amber-400 hover:bg-amber-500/20 transition"
                  >
                    <HandCoins size={14} />
                    <span className="flex-1 text-left rtl:text-right">{t("settlements.pendingFor", { count: pending.length })}</span>
                    <ChevronRight size={14} />
                  </button>
                )}

                <div className="grid grid-cols-3 gap-2 pt-3 border-t border-red-600/15 text-center">
                  <div><p className="text-xs text-blue-400 font-black">{c.stats.totalPurchases}</p><p className="label-caps">{t("clients.purchases")}</p></div>
                  <div><p className="text-xs text-emerald-400 font-black">{c.stats.totalSales}</p><p className="label-caps">{t("clients.sales")}</p></div>
                  <div><p className="text-xs text-rose-400 font-black">{formatAmount(c.stats.saleRest)}</p><p className="label-caps">{t("clients.balanceDue")}</p></div>
                </div>
              </Card>
            );
          })}
        </AnimatedGrid>
      )}

      {/* Form */}
      <Modal
        open={!!form}
        onClose={() => setForm(null)}
        title={editId ? t("clients.editTitle") : t("clients.newTitle")}
        size="lg"
        footer={
          <>
            <button className="btn-ghost" onClick={() => setForm(null)}>{t("common.cancel")}</button>
            <button className="btn-primary" onClick={save} disabled={saving}>{saving ? "..." : t("common.save")}</button>
          </>
        }
      >
        {form && <ClientForm value={form} onChange={setForm} errors={errors} />}
      </Modal>

      {/* View */}
      <Modal open={!!view} onClose={() => setView(null)} title={view ? `${view.firstName} ${view.lastName}` : ""}>
        {view && (
          <div className="space-y-1.5">
            {view.photo && <img src={view.photo} className="w-24 h-24 rounded-xl object-cover mb-3" alt="" />}
            {Object.entries({
              [t("common.phone")]: view.phonePrimary,
              [t("client.phoneSecondary")]: view.phoneSecondary,
              [t("common.email")]: view.email,
              [t("common.address")]: view.address,
              [t("client.birthPlace")]: view.birthPlace,
              [t("client.birthDate")]: view.birthDate && formatDate(view.birthDate),
              [t("client.docType")]: view.docType,
              [t("client.docNumber")]: view.docNumber,
              [t("client.docDeliveryDate")]: view.docDeliveryDate && formatDate(view.docDeliveryDate),
              [t("client.docExpiry")]: view.docExpiry && formatDate(view.docExpiry),
              NIF: view.nif,
              RC: view.rc,
            }).map(([k, v]) => (
              <div key={k} className="flex justify-between text-sm border-b border-red-600/10 py-1.5">
                <span className="text-text-muted">{k}</span>
                <span className="text-text-primary text-right rtl:text-left">{v || "—"}</span>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* History */}
      <Modal
        open={!!historyOf}
        onClose={() => setHistoryOf(null)}
        title={`${t("clients.historyTitle")} — ${historyOf?.firstName || ""} ${historyOf?.lastName || ""}`}
        size="lg"
      >
        {!history ? (
          <p className="text-text-muted text-center py-6">{t("common.loading")}</p>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
              <Card className="p-3 text-center"><p className="text-base font-black text-blue-400">{formatAmount(history.stats.totalPurchaseAmount)}</p><p className="label-caps">{t("clients.purchases")}</p></Card>
              <Card className="p-3 text-center"><p className="text-base font-black text-emerald-400">{formatAmount(history.stats.totalSaleAmount)}</p><p className="label-caps">{t("clients.sales")}</p></Card>
              <Card className="p-3 text-center"><p className="text-base font-black text-emerald-400">{formatAmount(history.stats.totalPaid)}</p><p className="label-caps">{t("clients.paid")}</p></Card>
              <Card className="p-3 text-center"><p className="text-base font-black text-rose-400">{formatAmount(history.stats.totalRest)}</p><p className="label-caps">{t("clients.restDue")}</p></Card>
              <Card className="p-3 text-center"><p className="text-base font-black text-amber-400">{formatAmount(history.stats.totalSettled)}</p><p className="label-caps">{t("settlements.title")}</p></Card>
            </div>

            <h4 className="heading text-xs text-text-primary mb-2">{t("clients.salesList")}</h4>
            <div className="space-y-2 mb-4">
              {history.sales.length === 0 && <p className="text-text-muted text-sm">{t("clients.noSale")}</p>}
              {history.sales.map((s) => (
                <div key={s.id} className="flex items-center gap-3 glass-card p-2">
                  <div className="w-14 h-10 rounded overflow-hidden shrink-0"><CarImage images={s.car?.images} heightClass="h-10" /></div>
                  <div className="flex-1 min-w-0"><p className="text-sm text-text-primary truncate">{s.car?.brand} {s.car?.model}</p><p className="text-xs text-text-muted">{formatDate(s.date)}</p></div>
                  <div className="text-right rtl:text-left text-sm">
                    <p className="text-text-primary">{formatAmount(s.totalAfterReduction)}</p>
                    {s.amountRest > 0 && <p className="text-xs text-rose-400">{t("clients.restDue")} {formatAmount(s.amountRest)}</p>}
                  </div>
                </div>
              ))}
            </div>

            <h4 className="heading text-xs text-text-primary mb-2">{t("clients.purchasesList")}</h4>
            <div className="space-y-2 mb-4">
              {history.purchases.length === 0 && <p className="text-text-muted text-sm">{t("clients.noPurchase")}</p>}
              {history.purchases.map((p) => (
                <div key={p.id} className="flex items-center gap-3 glass-card p-2">
                  <div className="w-14 h-10 rounded overflow-hidden shrink-0"><CarImage images={p.car?.images} heightClass="h-10" /></div>
                  <div className="flex-1 min-w-0"><p className="text-sm text-text-primary truncate">{p.car?.brand} {p.car?.model}</p><p className="text-xs text-text-muted">{formatDate(p.date)}</p></div>
                  <p className="text-sm text-text-primary">{formatAmount(p.purchasePrice)}</p>
                </div>
              ))}
            </div>

            {/* Règlements propriétaire */}
            <h4 className="heading text-xs text-text-primary mb-2">{t("settlements.historyTitle")}</h4>
            <div className="space-y-2">
              {history.settlements.length === 0 && <p className="text-text-muted text-sm">{t("settlements.none")}</p>}
              {history.settlements.map((st) => (
                <div key={st.id} className="flex items-center gap-3 glass-card p-2 border border-amber-500/20">
                  <div className="w-14 h-10 rounded overflow-hidden shrink-0"><CarImage images={st.car?.images} heightClass="h-10" /></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text-primary truncate">{st.car?.brand} {st.car?.model}</p>
                    <p className="text-xs text-text-muted truncate">
                      {st.reference} · {formatDate(st.date)} · {t("pos.showroomShare")} {formatAmount(st.showroomShare)} · {t("settlements.expensesTotal")} {formatAmount(st.expensesTotal)}
                    </p>
                  </div>
                  <div className="text-right rtl:text-left shrink-0">
                    <p className="text-sm font-black text-emerald-400">{formatAmount(st.ownerAmount)}</p>
                    <button
                      className="text-[0.65rem] text-red-400 hover:text-red-300 font-bold uppercase tracking-wider flex items-center gap-1"
                      onClick={() => setPrintSettlement(st)}
                    >
                      <Printer size={11} /> {t("common.print")}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Modal>

      {/* Pending règlements of one owner */}
      <Modal
        open={!!settleClient && !settleTarget}
        onClose={() => setSettleClient(null)}
        title={`${t("settlements.action")} — ${settleClient?.firstName || ""} ${settleClient?.lastName || ""}`}
      >
        {settleClient && (
          <div className="space-y-3">
            {pendingOf(settleClient.id).length === 0 ? (
              <div className="text-center py-6">
                <p className="text-text-muted text-sm">{t("settlements.nonePending")}</p>
              </div>
            ) : (
              pendingOf(settleClient.id).map((pending) => (
                <button
                  key={pending.saleId}
                  onClick={() => setSettleTarget(pending)}
                  className="w-full flex items-center gap-3 glass-card p-3 !rounded-xl border border-amber-500/30 hover:border-amber-500/70 transition text-left rtl:text-right"
                >
                  <div className="w-16 h-12 rounded-lg overflow-hidden shrink-0"><CarImage images={pending.car?.images} heightClass="h-12" /></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-text-primary truncate">{pending.car?.brand} {pending.car?.model}</p>
                    <p className="text-xs text-text-muted truncate">
                      {pending.sale?.reference} · {formatDate(pending.date)} · {formatAmount(pending.salePrice)}
                    </p>
                  </div>
                  <div className="text-right rtl:text-left shrink-0">
                    <p className="text-[0.6rem] text-text-muted uppercase">{t("settlements.ownerAmount")}</p>
                    <p className="text-sm font-black text-emerald-400">{formatAmount(pending.ownerAmount)}</p>
                  </div>
                  <ChevronRight size={16} className="text-amber-400 shrink-0" />
                </button>
              ))
            )}
          </div>
        )}
      </Modal>

      {/* Create the règlement */}
      {settleTarget && (
        <SettlementForm
          pending={settleTarget}
          onClose={() => setSettleTarget(null)}
          onCreated={afterSettlement}
        />
      )}

      {/* Print the règlement receipt */}
      <PrintHub
        open={!!printSettlement}
        onClose={() => setPrintSettlement(null)}
        title={t("print.settlement")}
        docs={settlementDocs(printSettlement)}
      />

      <ConfirmModal open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={confirmDelete} />
    </div>
  );
}
