import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Eye, Pencil, Trash2, Printer, Phone } from "lucide-react";
import { paymentsApi, carsApi } from "../lib/api.js";
import { useFetch } from "../hooks/useApi.js";
import { useCan } from "../lib/permissions.js";
import { useStore } from "../store/useStore.js";
import { Card, Modal, ConfirmModal, Field, EmptyState, SkeletonGrid, AnimatedGrid, useToast } from "../components/ui.jsx";
import PageHeader from "../components/PageHeader.jsx";
import ActionMenu from "../components/ActionMenu.jsx";
import SearchSelect from "../components/SearchSelect.jsx";
import { CarImage } from "../components/CarCard.jsx";
import { PaymentReceipt } from "../components/PrintTemplates.jsx";
import { usePrintDialog, printInLang } from "../components/PrintChooser.jsx";
import { formatAmount, formatDate, toDateTimeLocal } from "../utils/format.js";
import DateInput from "../components/DateInput.jsx";

export default function Payments() {
  const { t } = useTranslation();
  const can = useCan();
  const { settings } = useStore();
  const toast = useToast();
  const [search, setSearch] = useState("");
  const { data: payments, loading, refetch } = useFetch(() => paymentsApi.list(search), [search]);
  const [showNew, setShowNew] = useState(false);
  const [selectedCar, setSelectedCar] = useState(null);
  const [amount, setAmount] = useState("");
  const [desc, setDesc] = useState("");
  const [date, setDate] = useState(toDateTimeLocal());
  const [createdPrompt, setCreatedPrompt] = useState(null);
  const [viewItem, setViewItem] = useState(null);
  const [editItem, setEditItem] = useState(null);
  const [deleteId, setDeleteId] = useState(null);

  const resetNew = () => { setShowNew(false); setSelectedCar(null); setAmount(""); setDesc(""); setDate(toDateTimeLocal()); };

  const openPrint = usePrintDialog();
  const renderReceipt = (p) => (lang) => <PaymentReceipt payment={p} showroom={settings} lang={lang} />;
  // Print buttons open a French / Arabic chooser first.
  const doPrint = (p) => openPrint(renderReceipt(p));

  const create = async () => {
    if (!selectedCar || !amount) return;
    try {
      const data = await paymentsApi.create({
        carId: selectedCar.id,
        amount: Number(amount),
        description: desc,
        date,
      });
      resetNew();
      refetch();
      setCreatedPrompt(data);
      toast(t("payments.registeredToast"));
    } catch (e) {
      toast(e.message || t("payments.errorToast"), "error");
    }
  };

  const saveEdit = async () => {
    await paymentsApi.update(editItem.id, { amount: Number(editItem.amount), description: editItem.description });
    setEditItem(null); refetch();
  };

  const confirmDelete = async () => {
    await paymentsApi.delete(deleteId);
    setDeleteId(null); refetch();
    toast(t("payments.deletedToast"), "info");
  };

  // Search sold/reserved cars for the new-payment selector
  const mapCars = (cars) => cars.filter((c) => c.status !== "AVAILABLE");

  return (
    <div>
      <PageHeader title={t("payments.title")} action={can("payments", "create") ? () => setShowNew(true) : undefined} actionLabel={t("payments.new")} />

      <input className="input sm:max-w-xs mb-6" placeholder={t("payments.searchPlaceholder")} value={search} onChange={(e) => setSearch(e.target.value)} />

      {loading ? <SkeletonGrid /> : payments?.length === 0 ? (
        <EmptyState message={t("payments.noPayments")} cta={can("payments", "create") ? t("payments.new") : undefined} onCta={() => setShowNew(true)} />
      ) : (
        <AnimatedGrid className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {payments.map((p) => (
            <Card key={p.id} className="p-4 flex gap-4 items-center">
              <div className="w-20 h-14 rounded-lg overflow-hidden shrink-0"><CarImage images={p.car?.images} heightClass="h-14" /></div>
              <div className="flex-1 min-w-0">
                <p className="heading text-sm text-text-primary">{p.car?.brand} {p.car?.model}</p>
                <p className="text-xs text-text-muted">{p.client?.firstName} {p.client?.lastName} · {p.car?.plate}</p>
                <p className="text-xs text-text-muted">{formatDate(p.date)}</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-black text-emerald-400">{formatAmount(p.amount)}</p>
              </div>
              <ActionMenu items={[
                { label: t("common.view"), icon: Eye, onClick: () => setViewItem(p) },
                can("payments", "print") && { label: t("common.print"), icon: Printer, onClick: () => doPrint(p) },
                can("payments", "edit") && { label: t("common.edit"), icon: Pencil, onClick: () => setEditItem({ ...p }) },
                can("payments", "delete") && { label: t("common.delete"), icon: Trash2, danger: true, onClick: () => setDeleteId(p.id) },
              ]} />
            </Card>
          ))}
        </AnimatedGrid>
      )}

      {/* New payment */}
      <Modal open={showNew} onClose={resetNew} title={t("payments.new")} size="md"
        footer={<><button className="btn-ghost" onClick={resetNew}>{t("common.cancel")}</button><button className="btn-primary" onClick={create} disabled={!selectedCar || !amount}>{t("common.save")}</button></>}>
        <div className="space-y-4">
          {!selectedCar ? (
            <div>
              <p className="label-caps">{t("payments.searchSoldCar")}</p>
              <SearchSelect fetcher={(q) => carsApi.list({ search: q })} placeholder={t("payments.searchCarPlaceholder")} mapResults={mapCars} onSelect={setSelectedCar}
                renderItem={(c) => (
                  <div className="flex items-center gap-2">
                    <div className="w-12 h-9 rounded overflow-hidden shrink-0"><CarImage images={c.images} heightClass="h-9" /></div>
                    <div><p className="text-sm text-text-primary">{c.brand} {c.model}</p><p className="text-xs text-text-muted">{c.plate} · {c.sales?.[0]?.client ? `${c.sales[0].client.firstName} ${c.sales[0].client.lastName}` : ""}</p></div>
                  </div>
                )} />
            </div>
          ) : (
            <Card className="p-3">
              <div className="flex items-center gap-3">
                <div className="w-16 h-12 rounded overflow-hidden shrink-0"><CarImage images={selectedCar.images} heightClass="h-12" /></div>
                <div className="flex-1"><p className="text-sm text-text-primary font-bold">{selectedCar.brand} {selectedCar.model}</p><p className="text-xs text-text-muted">{selectedCar.plate}{selectedCar.sales?.[0]?.client && ` · ${selectedCar.sales[0].client.firstName} ${selectedCar.sales[0].client.lastName}`}</p></div>
                <button className="btn-ghost text-xs py-1.5" onClick={() => setSelectedCar(null)}>{t("common.change")}</button>
              </div>
              {selectedCar.sales?.[0] && <p className="text-xs text-text-muted mt-2">{t("payments.remainingDue")} : <span className="text-rose-400 font-bold">{formatAmount(selectedCar.sales[0].amountRest)}</span></p>}
            </Card>
          )}
          <div className="grid grid-cols-2 gap-4">
            <Field label={t("payments.amountToPay")} required><input className="input" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
            <Field label={t("common.date")}><DateInput withTime value={date} onChange={setDate} /></Field>
          </div>
          <Field label={t("common.description")}><input className="input" value={desc} onChange={(e) => setDesc(e.target.value)} /></Field>
        </div>
      </Modal>

      {/* Print prompt */}
      <Modal open={!!createdPrompt} onClose={() => setCreatedPrompt(null)} title={t("payments.registered")} size="sm"
        footer={<>
          <button className="btn-ghost" onClick={() => setCreatedPrompt(null)}>{t("common.skip")}</button>
          <button className="btn-ghost" onClick={() => { printInLang(renderReceipt(createdPrompt), "ar"); setCreatedPrompt(null); }}><Printer size={14} /> {t("common.printAr")}</button>
          <button className="btn-primary" onClick={() => { printInLang(renderReceipt(createdPrompt), "fr"); setCreatedPrompt(null); }}><Printer size={14} /> {t("common.printFr")}</button>
        </>}>
        <p className="text-text-muted">{t("payments.printPrompt")}</p>
      </Modal>

      {/* View */}
      <Modal open={!!viewItem} onClose={() => setViewItem(null)} title={t("payments.detail")} size="sm">
        {viewItem && (
          <div className="space-y-2">
            <div className="rounded-xl overflow-hidden mb-2"><CarImage images={viewItem.car?.images} heightClass="h-36" /></div>
            {Object.entries({ [t("common.vehicle")]: `${viewItem.car?.brand} ${viewItem.car?.model}`, [t("car.plate")]: viewItem.car?.plate, [t("common.client")]: `${viewItem.client?.firstName} ${viewItem.client?.lastName}`, [t("common.amount")]: formatAmount(viewItem.amount), [t("common.date")]: formatDate(viewItem.date), [t("common.description")]: viewItem.description }).map(([k, v]) => <div key={k} className="flex justify-between text-sm border-b border-red-600/10 py-1.5"><span className="text-text-muted">{k}</span><span className="text-text-primary">{v || "—"}</span></div>)}
            <button className="btn-ghost w-full mt-2" onClick={() => doPrint(viewItem)}><Printer size={14} /> {t("common.print")}</button>
          </div>
        )}
      </Modal>

      {/* Edit */}
      <Modal open={!!editItem} onClose={() => setEditItem(null)} title={t("payments.edit")} size="sm"
        footer={<><button className="btn-ghost" onClick={() => setEditItem(null)}>{t("common.cancel")}</button><button className="btn-primary" onClick={saveEdit}>{t("common.save")}</button></>}>
        {editItem && (
          <div className="space-y-4">
            <Field label={t("common.amount")}><input className="input" type="number" value={editItem.amount} onChange={(e) => setEditItem({ ...editItem, amount: e.target.value })} /></Field>
            <Field label={t("common.description")}><input className="input" value={editItem.description || ""} onChange={(e) => setEditItem({ ...editItem, description: e.target.value })} /></Field>
          </div>
        )}
      </Modal>

      <ConfirmModal open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={confirmDelete} />
    </div>
  );
}
