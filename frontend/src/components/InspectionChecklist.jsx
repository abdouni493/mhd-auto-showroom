import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Shield, Wrench, Star, Plus, X, Check } from "lucide-react";

export const DEFAULT_INSPECTION = {
  security: [
    { label: "Freins", active: true },
    { label: "Airbags", active: true },
    { label: "Ceintures de sécurité", active: true },
    { label: "Pneus", active: true },
    { label: "Éclairage", active: true },
  ],
  equipment: [
    { label: "Climatisation", active: true },
    { label: "GPS / Navigation", active: true },
    { label: "Caméra de recul", active: true },
    { label: "Bluetooth", active: true },
  ],
  comfort: [
    { label: "Sièges chauffants", active: true },
    { label: "Toit ouvrant", active: true },
    { label: "Régulateur de vitesse", active: true },
  ],
};

const SECTIONS = [
  { key: "security", titleKey: "inspection.security", icon: Shield, color: "text-red-400", border: "border-red-600/30" },
  { key: "equipment", titleKey: "inspection.equipment", icon: Wrench, color: "text-blue-400", border: "border-blue-500/30" },
  { key: "comfort", titleKey: "inspection.comfort", icon: Star, color: "text-amber-400", border: "border-amber-500/30" },
];

// A stored checklist can be an empty object (`{}` is the column default) — that
// must not render three empty sections when re-opening a record for editing.
// `hasInspectionItems` lets callers fall back to the saved template / defaults.
export function hasInspectionItems(value) {
  return !!value && SECTIONS.some(({ key }) => Array.isArray(value[key]) && value[key].length > 0);
}

// `onPersist` (optional) is called with the full updated checklist whenever an
// item is added or removed, so the master template can be saved to the database
// and reused on the next purchase / sale. Toggling an item on/off is a per-
// vehicle result and is NOT persisted to the template.
export default function InspectionChecklist({ value, onChange, onPersist }) {
  const { t } = useTranslation();
  const data = value || DEFAULT_INSPECTION;

  const toggle = (section, idx) => {
    const next = { ...data, [section]: data[section].map((it, i) => (i === idx ? { ...it, active: !it.active } : it)) };
    onChange(next);
  };
  const remove = (section, idx) => {
    const next = { ...data, [section]: data[section].filter((_, i) => i !== idx) };
    onChange(next);
    onPersist?.(next);
  };
  const add = (section) => {
    const label = prompt(t("inspection.addItem"));
    if (label) {
      const next = { ...data, [section]: [...(data[section] || []), { label, active: true }] };
      onChange(next);
      onPersist?.(next);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {SECTIONS.map(({ key, titleKey, icon: Icon, color, border }) => (
        <div key={key} className={`glass-card p-4 border ${border}`}>
          <div className="flex items-center justify-between mb-3">
            <div className={`flex items-center gap-2 ${color}`}>
              <Icon size={18} />
              <h4 className="heading text-xs">{t(titleKey)}</h4>
            </div>
            <button
              type="button"
              onClick={() => add(key)}
              title={t("inspection.addItemTitle")}
              aria-label={t("inspection.addItemTitle")}
              className={`${color} hover:scale-110 transition`}
            >
              <Plus size={18} />
            </button>
          </div>
          <div className="space-y-1.5">
            <AnimatePresence mode="popLayout">
              {(data[key] || []).map((item, idx) => (
                <motion.div
                  key={item.label + idx}
                  layout
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-center gap-2 group overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => toggle(key, idx)}
                    className={`w-5 h-5 rounded-md flex items-center justify-center border transition shrink-0 ${
                      item.active ? "bg-red-600 border-red-600 text-white" : "border-white/20 text-transparent"
                    }`}
                  >
                    <motion.span animate={{ scale: item.active ? 1 : 0 }} transition={{ type: "spring", stiffness: 500, damping: 25 }}>
                      <Check size={13} />
                    </motion.span>
                  </button>
                  <span className={`text-sm flex-1 ${item.active ? "text-text-primary" : "text-text-muted line-through"}`}>
                    {item.label}
                  </span>
                  <button
                    type="button"
                    onClick={() => remove(key, idx)}
                    title={t("inspection.removeItem")}
                    aria-label={t("inspection.removeItem")}
                    className="shrink-0 rounded-full p-1 text-text-muted border border-white/10 hover:border-rose-400/60 hover:bg-rose-500/10 hover:text-rose-400 transition"
                  >
                    <X size={14} />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
            {(!data[key] || data[key].length === 0) && (
              <p className="text-xs text-text-muted italic">{t("inspection.noItems")}</p>
            )}
            <p className="text-[0.65rem] text-text-muted italic pt-1">{t("inspection.manageHint")}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
