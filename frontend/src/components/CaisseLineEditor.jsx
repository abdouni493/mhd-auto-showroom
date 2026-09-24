import { useState } from "react";
import { Car } from "lucide-react";
import {
  salesApi, purchasesApi, expensesApi, workersApi, settlementsApi, carsApi, computeSaleTotal,
} from "../lib/api.js";
import { Modal, Field, Card, useToast } from "./ui.jsx";
import SearchSelect from "./SearchSelect.jsx";
import DateInput from "./DateInput.jsx";
import PaymentMethodSelect from "./PaymentMethodSelect.jsx";
import { formatAmount, toDateInput, toDateTimeLocal } from "../utils/format.js";

/* ---------------------------------------------------------------------------
 * Edit one line of the Caisse, whatever interface created it. Each category
 * writes back to its own table; the API keeps the linked rows in line (the
 * sale's paid amount follows its versements, an owner règlement follows the
 * sale price and the vehicle expenses, …). The Caisse reloads afterwards so
 * every total is recomputed from the stored data.
 * ------------------------------------------------------------------------- */

const num = (v) => Number(v) || 0;
const iso = (v) => (v ? new Date(v).toISOString() : new Date().toISOString());
const searchCars = (q) => carsApi.list({ search: q.trim() });

// Build the form state for a ledger entry (or a bénéfice record).
function initialForm(item) {
  if (item.kind === "gain") {
    const g = item.gain;
    const s = g.sale || {};
    return {
      date: toDateTimeLocal(s.date || g.date),
      basePrice: String(s.totalBeforeTax ?? g.salePrice ?? ""),
      ownerAmount: String(g.ownerAmount ?? ""),
      purchasePrice: String(g.purchasePrice ?? ""),
    };
  }
  const r = item.entry.raw || {};
  switch (item.entry.category) {
    case "sale":
      return { amount: String(r.amount ?? ""), description: r.description || "", date: toDateTimeLocal(r.date) };
    case "purchase":
      return {
        purchasePrice: String(r.purchasePrice ?? ""), amountPaid: String(r.amountPaid ?? ""),
        remark: r.remark || "", date: toDateTimeLocal(r.date), sourceType: r.sourceType,
      };
    case "expense":
      return {
        name: r.name || "", description: r.description || "", amount: String(r.amount ?? ""),
        date: toDateInput(r.date), type: r.type === "CAR" ? "CAR" : "SHOWROOM",
        car: r.car ? { ...r.car, id: r.carId } : null,
      };
    case "payroll":
      return { amount: String(r.amount ?? ""), date: toDateInput(r.date), month: r.month || "", description: r.description || "" };
    case "settlement":
      return {
        ownerAmount: String(r.ownerAmount ?? ""), paymentMethod: r.paymentMethod || "",
        note: r.note || "", date: toDateTimeLocal(r.date),
      };
    default:
      return {};
  }
}

export default function CaisseLineEditor({ item, onClose, onSaved }) {
  const toast = useToast();
  const [f, setF] = useState(() => initialForm(item));
  const [saving, setSaving] = useState(false);
  const set = (patch) => setF((x) => ({ ...x, ...patch }));

  const isGain = item.kind === "gain";
  const category = isGain ? "gain" : item.entry.category;
  const raw = isGain ? null : item.entry.raw || {};

  const save = async () => {
    setSaving(true);
    try {
      switch (category) {
        case "sale":
          if (num(f.amount) <= 0) throw new Error("Montant requis");
          await salesApi.updateVersement(item.entry.rawId, { amount: num(f.amount), description: f.description, date: iso(f.date) });
          break;
        case "purchase":
          await purchasesApi.update(item.entry.rawId, {
            purchasePrice: num(f.purchasePrice), amountPaid: num(f.amountPaid), remark: f.remark, date: iso(f.date),
          });
          break;
        case "expense":
          if (!f.name || num(f.amount) <= 0) throw new Error("Nom et montant requis");
          if (f.type === "CAR" && !f.car) throw new Error("Sélectionnez un véhicule");
          await expensesApi.update(item.entry.rawId, {
            name: f.name, description: f.description, amount: num(f.amount), date: f.date,
            type: f.type, carId: f.type === "CAR" ? f.car?.id : null,
          });
          break;
        case "payroll":
          if (num(f.amount) <= 0) throw new Error("Montant requis");
          await workersApi.updatePayment(item.entry.rawId, { amount: num(f.amount), date: f.date, month: f.month, description: f.description });
          break;
        case "settlement":
          await settlementsApi.update(item.entry.rawId, {
            ownerAmount: num(f.ownerAmount), paymentMethod: f.paymentMethod, note: f.note, date: iso(f.date),
          });
          break;
        case "gain": {
          const g = item.gain;
          const newTotal = saleTotal;
          const payload = { basePrice: num(f.basePrice), date: iso(f.date) };
          if (g.kind === "PRESTATION") payload.showroomShare = newTotal - num(f.ownerAmount) - num(g.carExpenses);
          await salesApi.update(g.saleId, payload);
          const purchaseId = g.sale?.car?.purchases?.[0]?.id;
          if (g.kind !== "PRESTATION" && purchaseId && num(f.purchasePrice) !== num(g.purchasePrice)) {
            await purchasesApi.update(purchaseId, { purchasePrice: num(f.purchasePrice) });
          }
          break;
        }
        default:
          break;
      }
      toast("Ligne modifiée — les montants liés ont été recalculés");
      onSaved();
    } catch (e) {
      toast(e?.message || "Erreur lors de l'enregistrement", "error");
    } finally {
      setSaving(false);
    }
  };

  // ── Live previews ─────────────────────────────────────────────────────────
  const sale = isGain ? item.gain.sale || {} : null;
  const saleTotal = isGain
    ? computeSaleTotal({
        basePrice: f.basePrice, tvaEnabled: sale.tvaEnabled, tvaRate: sale.tvaRate,
        reductionType: sale.reductionType, reductionValue: sale.reductionValue,
      })
    : 0;
  const settlementShare = category === "settlement"
    ? num(raw.salePrice) - num(f.ownerAmount) - num(raw.expensesTotal)
    : 0;

  const recap = (rowsList) => (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {rowsList.map(([label, value, cls = "text-text-primary"]) => (
        <Card key={label} className="p-2.5">
          <p className="label-caps !mb-0.5">{label}</p>
          <p className={`text-sm font-black ${cls}`}>{value}</p>
        </Card>
      ))}
    </div>
  );

  let body = null;
  if (category === "sale") {
    body = (
      <>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Montant du versement" required><input className="input" type="number" value={f.amount} onChange={(e) => set({ amount: e.target.value })} /></Field>
          <Field label="Date"><DateInput withTime value={f.date} onChange={(v) => set({ date: v })} /></Field>
        </div>
        <Field label="Observation"><textarea className="input" rows={2} value={f.description} onChange={(e) => set({ description: e.target.value })} /></Field>
        <p className="text-xs text-text-muted">Le montant payé et le reste de la vente sont recalculés automatiquement.</p>
      </>
    );
  } else if (category === "purchase") {
    const showroom = f.sourceType === "SHOWROOM";
    body = (
      <>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Prix d'achat" required><input className="input" type="number" value={f.purchasePrice} onChange={(e) => set({ purchasePrice: e.target.value })} /></Field>
          <Field label="Montant payé">
            <input className="input" type="number" value={showroom ? f.purchasePrice : f.amountPaid} disabled={showroom} onChange={(e) => set({ amountPaid: e.target.value })} />
          </Field>
          <Field label="Date"><DateInput withTime value={f.date} onChange={(v) => set({ date: v })} /></Field>
        </div>
        <Field label="Remarque"><textarea className="input" rows={2} value={f.remark} onChange={(e) => set({ remark: e.target.value })} /></Field>
        {recap([["Reste à payer", formatAmount(Math.max(0, num(f.purchasePrice) - num(showroom ? f.purchasePrice : f.amountPaid))), "text-rose-300"]])}
      </>
    );
  } else if (category === "expense") {
    body = (
      <>
        <div className="flex gap-2">
          {[["CAR", "Véhicule"], ["SHOWROOM", "Showroom"]].map(([k, label]) => (
            <button key={k} type="button" className={`chip ${f.type === k ? "chip-active" : ""}`} onClick={() => set({ type: k })}>{label}</button>
          ))}
        </div>
        {f.type === "CAR" && (
          f.car ? (
            <Card className="p-2 flex items-center gap-3">
              <CarThumb car={f.car} />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-text-primary truncate">{f.car.brand} {f.car.model}</p>
                <p className="text-xs text-text-muted font-mono truncate">Châssis : {f.car.vin || "—"}</p>
              </div>
              <button type="button" className="btn-ghost text-xs py-1" onClick={() => set({ car: null })}>Changer</button>
            </Card>
          ) : (
            <div><p className="label-caps">Véhicule</p>
              <SearchSelect fetcher={searchCars} placeholder="Nom du véhicule ou N° de châssis..." onSelect={(c) => set({ car: c })}
                renderItem={(c) => (
                  <div className="flex items-center gap-3">
                    <CarThumb car={c} />
                    <div className="min-w-0">
                      <p className="text-sm text-text-primary truncate">{c.brand} {c.model}</p>
                      <p className="text-xs text-text-muted font-mono truncate">Châssis : {c.vin || "—"}</p>
                    </div>
                  </div>
                )} />
            </div>
          )
        )}
        <Field label="Nom de la dépense" required><input className="input" value={f.name} onChange={(e) => set({ name: e.target.value })} /></Field>
        <Field label="Description"><input className="input" value={f.description} onChange={(e) => set({ description: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Montant" required><input className="input" type="number" value={f.amount} onChange={(e) => set({ amount: e.target.value })} /></Field>
          <Field label="Date"><DateInput value={f.date} onChange={(v) => set({ date: v })} /></Field>
        </div>
        <p className="text-xs text-text-muted">Le bénéfice du véhicule et, s'il existe, le règlement de son propriétaire sont recalculés.</p>
      </>
    );
  } else if (category === "payroll") {
    body = (
      <>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Montant" required><input className="input" type="number" value={f.amount} onChange={(e) => set({ amount: e.target.value })} /></Field>
          <Field label="Date"><DateInput value={f.date} onChange={(v) => set({ date: v })} /></Field>
          <Field label="Mois (AAAA-MM)"><input className="input" value={f.month} placeholder="2026-09" onChange={(e) => set({ month: e.target.value })} /></Field>
        </div>
        <Field label="Description"><textarea className="input" rows={2} value={f.description} onChange={(e) => set({ description: e.target.value })} /></Field>
      </>
    );
  } else if (category === "settlement") {
    body = (
      <>
        {recap([
          ["Prix de vente", formatAmount(raw.salePrice)],
          ["Dépenses", `- ${formatAmount(raw.expensesTotal)}`, "text-amber-400"],
          ["Part propriétaire", formatAmount(num(f.ownerAmount)), "text-emerald-400"],
          ["Part showroom", formatAmount(settlementShare), settlementShare >= 0 ? "text-red-400" : "text-rose-400"],
        ])}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Part du propriétaire" required><input className="input" type="number" value={f.ownerAmount} onChange={(e) => set({ ownerAmount: e.target.value })} /></Field>
          <Field label="Mode de paiement"><PaymentMethodSelect value={f.paymentMethod} onChange={(v) => set({ paymentMethod: v })} /></Field>
          <Field label="Date"><DateInput withTime value={f.date} onChange={(v) => set({ date: v })} /></Field>
        </div>
        <Field label="Note"><textarea className="input" rows={2} value={f.note} onChange={(e) => set({ note: e.target.value })} /></Field>
        <p className="text-xs text-text-muted">La part du showroom est calculée : prix de vente − part du propriétaire − dépenses. La vente est mise à jour avec elle.</p>
      </>
    );
  } else if (category === "gain") {
    const g = item.gain;
    const prestation = g.kind === "PRESTATION";
    const share = saleTotal - num(f.ownerAmount) - num(g.carExpenses);
    const gain = prestation ? share - num(g.carExpenses) : saleTotal - num(f.purchasePrice) - num(g.carExpenses);
    body = (
      <>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label={sale.tvaEnabled || (sale.reductionType && sale.reductionType !== "NONE") ? "Prix de base (avant TVA / remise)" : "Prix de vente"} required>
            <input className="input" type="number" value={f.basePrice} onChange={(e) => set({ basePrice: e.target.value })} />
          </Field>
          <Field label="Date de la vente"><DateInput withTime value={f.date} onChange={(v) => set({ date: v })} /></Field>
          {prestation ? (
            <Field label="Part du propriétaire" required><input className="input" type="number" value={f.ownerAmount} onChange={(e) => set({ ownerAmount: e.target.value })} /></Field>
          ) : (
            <Field label="Prix d'achat"><input className="input" type="number" value={f.purchasePrice} onChange={(e) => set({ purchasePrice: e.target.value })} /></Field>
          )}
        </div>
        {recap([
          ["Prix de vente", formatAmount(saleTotal)],
          ["Dépenses véhicule", `- ${formatAmount(g.carExpenses)}`, "text-amber-400"],
          prestation ? ["Part showroom", formatAmount(share), "text-red-400"] : ["Prix d'achat", formatAmount(num(f.purchasePrice))],
          ["Bénéfice", formatAmount(gain), gain >= 0 ? "text-emerald-400" : "text-rose-400"],
        ])}
        <p className="text-xs text-text-muted">
          La vente{prestation ? ", sa part showroom et le règlement du propriétaire" : " et l'achat du véhicule"} sont mis à jour ; le reste à payer est recalculé.
        </p>
      </>
    );
  }

  const title = isGain ? "Modifier le bénéfice" : `Modifier — ${item.entry.label}`;

  return (
    <Modal open onClose={onClose} title={title} size="md"
      footer={<><button className="btn-ghost" onClick={onClose}>Annuler</button><button className="btn-primary" onClick={save} disabled={saving}>{saving ? "..." : "Enregistrer"}</button></>}>
      <div className="space-y-4">{body}</div>
    </Modal>
  );
}

function CarThumb({ car }) {
  return (
    <div className="w-9 h-9 rounded-full overflow-hidden shrink-0 border border-red-600/30 bg-white/5 flex items-center justify-center">
      {car?.images?.[0]
        ? <img src={car.images[0]} alt="" className="w-full h-full object-cover" loading="lazy" />
        : <Car size={16} className="text-text-muted" />}
    </div>
  );
}
