import { useTranslation } from "react-i18next";

/* ---------------------------------------------------------------------------
 * Payment method picker (Mode de paiement / طريقة الدفع)
 *
 * Every payment-method field of the application uses this single dropdown so a
 * mode is chosen from a fixed list instead of typed by hand. The value that is
 * stored — and printed on every document — is the French label, keeping legacy
 * free-text records consistent; only the option text shown follows the current
 * interface language.
 * ------------------------------------------------------------------------- */
export const PAYMENT_METHODS = [
  { value: "Espèces", ar: "نقداً" },
  { value: "Chèque", ar: "شيك" },
  { value: "Virement", ar: "تحويل بنكي" },
  { value: "Versement bancaire", ar: "دفع بنكي" },
  { value: "Carte bancaire (TPE)", ar: "بطاقة بنكية (TPE)" },
  { value: "CCP / BaridiMob", ar: "CCP / بريدي موب" },
  { value: "Autre", ar: "أخرى" },
];

export default function PaymentMethodSelect({
  value,
  onChange,
  className = "input",
  allowEmpty = true,
  placeholder,
}) {
  const { t, i18n } = useTranslation();
  const ar = i18n.language === "ar";
  const known = PAYMENT_METHODS.some((m) => m.value === value);

  return (
    <select className={className} value={value || ""} onChange={(e) => onChange(e.target.value)}>
      {allowEmpty && <option value="">{placeholder ?? t("common.select")}</option>}
      {PAYMENT_METHODS.map((m) => (
        <option key={m.value} value={m.value}>
          {ar ? m.ar : m.value}
        </option>
      ))}
      {/* Keep any legacy free-text value selectable so old records still show. */}
      {value && !known && <option value={value}>{value}</option>}
    </select>
  );
}
