import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Printer, X, ChevronDown, Check } from "lucide-react";
import { printNode } from "../hooks/usePrint.jsx";
import { toDateTimeLocal } from "../utils/format.js";

/**
 * "Impressions" hub — one modal that lists every printable document of a
 * record, asks for the options a document needs (date & heure, prix de vente…)
 * and finally asks the language (Français / العربية) before printing.
 *
 * docs: [{
 *   key, label, desc, icon,
 *   options?: [{ name, label, type: "datetime"|"number"|"text", default }],
 *   render: (lang, options) => <ReactNode />,
 * }]
 */
export default function PrintHub({ open, onClose, title, docs = [], footer }) {
  const { t } = useTranslation();
  const [openKey, setOpenKey] = useState(null);
  const [values, setValues] = useState({});

  // Seed each document's options with their default value the first time the
  // hub opens, so "Imprimer" works without touching the fields.
  useEffect(() => {
    if (!open) return;
    const seed = {};
    for (const d of docs) {
      if (!d.options) continue;
      seed[d.key] = Object.fromEntries(
        d.options.map((o) => [
          o.name,
          o.default ?? (o.type === "datetime" ? toDateTimeLocal() : ""),
        ])
      );
    }
    setValues(seed);
    setOpenKey(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const setOption = (docKey, name, value) =>
    setValues((v) => ({ ...v, [docKey]: { ...(v[docKey] || {}), [name]: value } }));

  const doPrint = (doc, lang) => {
    const node = doc.render(lang, values[doc.key] || {});
    onClose();
    if (node) printNode(node);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[65] flex items-start justify-center overflow-y-auto bg-black/80 backdrop-blur-sm p-4 no-print"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          onClick={onClose}
        >
          <motion.div
            className="glass-panel w-full max-w-2xl my-8"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ type: "spring", stiffness: 300, damping: 26 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-red-600/20">
              <h3 className="heading text-lg text-text-primary flex items-center gap-2">
                <Printer size={18} className="text-red-400" /> {title || t("print.hubTitle")}
              </h3>
              <button onClick={onClose} className="text-text-muted hover:text-text-primary transition">
                <X size={22} />
              </button>
            </div>

            <div className="p-5 max-h-[70vh] overflow-y-auto space-y-2.5">
              <p className="text-xs text-text-muted -mt-1 mb-3">{t("print.hubHelp")}</p>

              {docs.map((doc) => {
                const expanded = openKey === doc.key;
                const Icon = doc.icon;
                return (
                  <div
                    key={doc.key}
                    className={`glass-card !rounded-xl overflow-hidden border transition ${
                      expanded ? "border-red-600/60" : "border-red-600/20"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setOpenKey(expanded ? null : doc.key)}
                      className="w-full flex items-center gap-3 p-3.5 text-left rtl:text-right hover:bg-red-600/8 transition"
                    >
                      <span className="p-2 rounded-lg bg-red-600/15 text-red-400 shrink-0">
                        {Icon ? <Icon size={17} /> : <Printer size={17} />}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-bold text-text-primary truncate">{doc.label}</span>
                        {doc.desc && <span className="block text-xs text-text-muted truncate">{doc.desc}</span>}
                      </span>
                      <motion.span animate={{ rotate: expanded ? 180 : 0 }} className="text-text-muted shrink-0">
                        <ChevronDown size={17} />
                      </motion.span>
                    </button>

                    <AnimatePresence initial={false}>
                      {expanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="px-3.5 pb-3.5 pt-1 space-y-3 border-t border-red-600/15">
                            {(doc.options || []).length > 0 && (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3">
                                {doc.options.map((o) => (
                                  <div key={o.name}>
                                    <label className="label-caps">{o.label}</label>
                                    <input
                                      className="input"
                                      type={o.type === "datetime" ? "datetime-local" : o.type === "number" ? "number" : "text"}
                                      value={values[doc.key]?.[o.name] ?? ""}
                                      onChange={(e) => setOption(doc.key, o.name, e.target.value)}
                                    />
                                    {o.hint && <p className="text-[0.65rem] text-text-muted mt-1">{o.hint}</p>}
                                  </div>
                                ))}
                              </div>
                            )}

                            <div>
                              <p className="label-caps">{t("print.chooseLang")}</p>
                              <div className="grid grid-cols-2 gap-3">
                                <motion.button
                                  whileHover={{ scale: 1.02 }}
                                  whileTap={{ scale: 0.97 }}
                                  onClick={() => doPrint(doc, "fr")}
                                  className="flex items-center justify-center gap-2 rounded-xl py-3 border border-red-600/40 bg-red-600/10 hover:bg-red-600/20 transition text-sm font-bold text-text-primary"
                                >
                                  <span className="text-lg">🇫🇷</span> Français
                                </motion.button>
                                <motion.button
                                  whileHover={{ scale: 1.02 }}
                                  whileTap={{ scale: 0.97 }}
                                  onClick={() => doPrint(doc, "ar")}
                                  className="flex items-center justify-center gap-2 rounded-xl py-3 border border-red-600/40 bg-red-600/10 hover:bg-red-600/20 transition text-sm font-bold text-text-primary"
                                >
                                  <span className="text-lg">🇩🇿</span> العربية
                                </motion.button>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}

              {docs.length === 0 && (
                <p className="text-text-muted text-sm text-center py-6">{t("print.noDocs")}</p>
              )}
            </div>

            {footer && <div className="p-5 border-t border-red-600/20">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Multi-select list of the same documents, used by "Envoyer par email".
 * value = array of selected doc keys.
 */
export function DocPicker({ docs, value = [], onChange }) {
  const toggle = (key) =>
    onChange(value.includes(key) ? value.filter((k) => k !== key) : [...value, key]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {docs.map((doc) => {
        const checked = value.includes(doc.key);
        const Icon = doc.icon;
        return (
          <button
            key={doc.key}
            type="button"
            onClick={() => toggle(doc.key)}
            className={`glass-card !rounded-xl p-3 flex items-center gap-2.5 border text-left rtl:text-right transition ${
              checked ? "border-red-600/70 bg-red-600/10" : "border-white/10"
            }`}
          >
            <span
              className={`w-5 h-5 rounded-md flex items-center justify-center border shrink-0 transition ${
                checked ? "bg-red-600 border-red-600 text-white" : "border-white/20 text-transparent"
              }`}
            >
              <Check size={13} />
            </span>
            {Icon && <Icon size={15} className="text-red-400 shrink-0" />}
            <span className="text-sm text-text-primary truncate">{doc.label}</span>
          </button>
        );
      })}
    </div>
  );
}
