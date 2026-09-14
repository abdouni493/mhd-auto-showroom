import { useState, useEffect, useRef, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Check, ChevronDown, Plus, Search, X } from "lucide-react";

/**
 * Picker for a short reference list (vehicle colour, vehicle year, ...) that
 * also lets the user add a value that is not in the list yet, without leaving
 * the form.
 *
 * props
 *   value      current value (string or number, "" when nothing is selected)
 *   onChange   (value) => void
 *   options    [{ id, label, value }]
 *   onCreate   async (typedText) => created option — omit to make the list closed
 *   numeric    filter the search box to digits and validate a year-like value
 */
export default function CreatableSelect({
  value,
  onChange,
  options = [],
  onCreate,
  placeholder,
  numeric = false,
  disabled = false,
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const boxRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const onClickAway = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickAway);
    return () => document.removeEventListener("mousedown", onClickAway);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setError("");
      // let the panel mount before stealing the focus
      const id = setTimeout(() => inputRef.current?.focus(), 30);
      return () => clearTimeout(id);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => String(o.label).toLowerCase().includes(q));
  }, [options, query]);

  // "Create" is offered as soon as what was typed is not already in the list.
  const typed = query.trim();
  const exists = options.some((o) => String(o.label).toLowerCase() === typed.toLowerCase());
  const canCreate = !!onCreate && typed.length > 0 && !exists && (!numeric || /^\d{4}$/.test(typed));

  const pick = (option) => {
    onChange(option.value);
    setOpen(false);
  };

  const create = async () => {
    if (!canCreate || creating) return;
    setCreating(true);
    setError("");
    try {
      const created = await onCreate(typed);
      onChange(created?.value ?? typed);
      setOpen(false);
    } catch (e) {
      setError(e?.message || t("common.error"));
    } finally {
      setCreating(false);
    }
  };

  const selected = options.find((o) => String(o.value) === String(value));
  const shown = selected?.label ?? (value === "" || value == null ? "" : String(value));

  return (
    <div className="relative" ref={boxRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="input flex items-center justify-between gap-2 text-left rtl:text-right disabled:opacity-50"
      >
        <span className={shown ? "text-text-primary truncate" : "text-text-muted truncate"}>
          {shown || placeholder || t("common.select")}
        </span>
        <span className="flex items-center gap-1 shrink-0">
          {shown && !disabled && (
            <span
              role="button"
              tabIndex={-1}
              title={t("common.clear")}
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
              }}
              className="text-text-muted hover:text-red-400"
            >
              <X size={13} />
            </span>
          )}
          <motion.span animate={{ rotate: open ? 180 : 0 }} className="inline-flex text-red-500/70">
            <ChevronDown size={15} />
          </motion.span>
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scaleY: 0.96 }}
            animate={{ opacity: 1, y: 0, scaleY: 1 }}
            exit={{ opacity: 0, y: -6, scaleY: 0.96 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            className="absolute z-40 mt-1 w-full glass-panel p-2 origin-top"
          >
            <div className="relative mb-2">
              <Search
                className="absolute left-2.5 rtl:left-auto rtl:right-2.5 top-1/2 -translate-y-1/2 text-text-muted"
                size={14}
              />
              <input
                ref={inputRef}
                className="input !py-2 pl-8 rtl:pl-3 rtl:pr-8 text-sm"
                inputMode={numeric ? "numeric" : "text"}
                placeholder={onCreate ? t("common.searchOrCreate") : t("common.search")}
                value={query}
                onChange={(e) => setQuery(numeric ? e.target.value.replace(/\D/g, "").slice(0, 4) : e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (canCreate) create();
                    else if (filtered.length === 1) pick(filtered[0]);
                  }
                  if (e.key === "Escape") setOpen(false);
                }}
              />
            </div>

            {canCreate && (
              <button
                type="button"
                onClick={create}
                disabled={creating}
                className="w-full flex items-center gap-2 px-2.5 py-2 mb-1 rounded-lg bg-red-600/12 border border-red-600/40 text-sm text-text-primary hover:bg-red-600/20 transition disabled:opacity-60"
              >
                <Plus size={14} className="text-red-400 shrink-0" />
                <span className="truncate">{creating ? "..." : t("common.createValue", { value: typed })}</span>
              </button>
            )}
            {error && <p className="text-red-400 text-xs px-1 pb-1">{error}</p>}

            <div className="max-h-52 overflow-y-auto space-y-0.5">
              {filtered.map((o) => {
                const active = String(o.value) === String(value);
                return (
                  <button
                    key={o.id ?? o.value}
                    type="button"
                    onClick={() => pick(o)}
                    className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-sm text-left rtl:text-right transition ${
                      active ? "bg-red-600/15 text-text-primary" : "text-text-muted hover:bg-red-600/8 hover:text-text-primary"
                    }`}
                  >
                    <span className="truncate">{o.label}</span>
                    {active && <Check size={14} className="text-red-400 shrink-0" />}
                  </button>
                );
              })}
              {filtered.length === 0 && !canCreate && (
                <p className="text-xs text-text-muted italic p-2">{t("common.noResult")}</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
