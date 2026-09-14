import { useTranslation } from "react-i18next";
import { Field } from "./ui.jsx";
import { SingleImageUpload } from "./ImageUpload.jsx";
import { BUCKETS } from "../lib/supabase.js";
import { toDateInput } from "../utils/format.js";
import DateInput from "./DateInput.jsx";

const DOC_TYPES = ["Permis Biométrique", "Carte d'Identité", "Passeport"];

// Controlled client form. value = client object, onChange(field, val) or onChange(newObject)
export default function ClientForm({ value, onChange, errors = {} }) {
  const { t } = useTranslation();
  const c = value || {};
  const set = (field) => (e) => {
    const v = e?.target ? e.target.value : e;
    onChange({ ...c, [field]: v });
  };

  return (
    <div className="space-y-5">
      <SingleImageUpload value={c.photo} onChange={(url) => onChange({ ...c, photo: url })} label={t("client.photo")} bucket={BUCKETS.clientPhotos} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label={t("client.firstName")} required error={errors.firstName}>
          <input className="input" value={c.firstName || ""} onChange={set("firstName")} />
        </Field>
        <Field label={t("client.lastName")} required error={errors.lastName}>
          <input className="input" value={c.lastName || ""} onChange={set("lastName")} />
        </Field>
        <Field label={t("client.birthDate")}>
          <DateInput value={toDateInput(c.birthDate)} onChange={set("birthDate")} />
        </Field>
        <Field label={t("client.birthPlace")}>
          <input className="input" value={c.birthPlace || ""} onChange={set("birthPlace")} />
        </Field>
        <Field label={t("client.gender")}>
          <select className="input" value={c.gender || ""} onChange={set("gender")}>
            <option value="">—</option>
            <option value="M">{t("client.male")}</option>
            <option value="F">{t("client.female")}</option>
          </select>
        </Field>
        <Field label={t("common.address")} className="sm:col-span-2">
          <input className="input" value={c.address || ""} onChange={set("address")} />
        </Field>
        <Field label={t("client.phonePrimary")} required error={errors.phonePrimary}>
          <input className="input" value={c.phonePrimary || ""} onChange={set("phonePrimary")} />
        </Field>
        <Field label={t("client.phoneSecondary")}>
          <input className="input" value={c.phoneSecondary || ""} onChange={set("phoneSecondary")} />
        </Field>
        <Field label={t("common.email")} className="sm:col-span-2">
          <input className="input" value={c.email || ""} onChange={set("email")} />
        </Field>
      </div>

      <div>
        <div className="flex items-center gap-3 my-2">
          <span className="label-caps !mb-0">{t("client.idDoc")}</span>
          <div className="flex-1 h-px bg-red-600/20" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label={t("client.docType")}>
            <select className="input" value={c.docType || ""} onChange={set("docType")}>
              <option value="">—</option>
              {DOC_TYPES.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </Field>
          <Field label={t("client.docNumber")}>
            <input className="input" value={c.docNumber || ""} onChange={set("docNumber")} />
          </Field>
          <Field label={t("client.docDeliveryDate")}>
            <DateInput value={toDateInput(c.docDeliveryDate)} onChange={set("docDeliveryDate")} />
          </Field>
          <Field label={t("client.docExpiry")}>
            <DateInput value={toDateInput(c.docExpiry)} onChange={set("docExpiry")} />
          </Field>
          <Field label={t("client.docDeliveryAddress")} className="sm:col-span-2">
            <input className="input" value={c.docDeliveryAddress || ""} onChange={set("docDeliveryAddress")} />
          </Field>
        </div>
      </div>

      <div>
        <div className="flex items-center gap-3 my-2">
          <span className="label-caps !mb-0">{t("client.company")}</span>
          <div className="flex-1 h-px bg-red-600/20" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Field label="NIF"><input className="input" value={c.nif || ""} onChange={set("nif")} /></Field>
          <Field label="RC"><input className="input" value={c.rc || ""} onChange={set("rc")} /></Field>
          <Field label="NIS"><input className="input" value={c.nis || ""} onChange={set("nis")} /></Field>
          <Field label="ART"><input className="input" value={c.art || ""} onChange={set("art")} /></Field>
        </div>
      </div>
    </div>
  );
}

export function validateClient(c) {
  const errors = {};
  if (!c.firstName?.trim()) errors.firstName = "!";
  if (!c.lastName?.trim()) errors.lastName = "!";
  if (!c.phonePrimary?.trim()) errors.phonePrimary = "!";
  return errors;
}
