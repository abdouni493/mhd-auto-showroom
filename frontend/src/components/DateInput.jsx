import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { CalendarDays } from "lucide-react";

// Date entry the way the showroom writes dates: jj/mm/aaaa (and jj/mm/aaaa hh:mm
// when a time is needed). The native <input type="date"> was showing whatever
// order the browser locale happened to use and was painful to type into, so the
// field below is a plain masked text box. A calendar button still opens the
// native picker for anyone who prefers clicking.
//
// The value contract is unchanged, so call sites keep working as before:
//   withTime=false -> "YYYY-MM-DD"
//   withTime=true  -> "YYYY-MM-DDTHH:mm"
// onChange receives that string directly (not an event).

const pad = (n) => String(n).padStart(2, "0");

// "2026-09-15T14:30" -> "15/09/2026 14:30"
export function isoToText(iso, withTime = false) {
  if (!iso) return "";
  const [datePart, timePart = ""] = String(iso).split("T");
  const [y, m, d] = datePart.split("-");
  if (!y || !m || !d) return "";
  const text = `${d}/${m}/${y}`;
  if (!withTime) return text;
  const [hh = "00", mi = "00"] = timePart.split(":");
  return `${text} ${hh.slice(0, 2)}:${mi.slice(0, 2)}`;
}

// "15/09/2026 14:30" -> "2026-09-15T14:30", or "" while still incomplete/invalid
export function textToIso(text, withTime = false) {
  const digits = String(text || "").replace(/\D/g, "");
  if (digits.length < 8) return "";
  const d = Number(digits.slice(0, 2));
  const m = Number(digits.slice(2, 4));
  const y = Number(digits.slice(4, 8));
  if (m < 1 || m > 12 || d < 1 || y < 1000) return "";
  // day 0 of the next month = last day of this one, so 31/02 is rejected
  if (d > new Date(y, m, 0).getDate()) return "";
  const iso = `${y}-${pad(m)}-${pad(d)}`;
  if (!withTime) return iso;
  const hh = Math.min(23, Number(digits.slice(8, 10) || 0));
  const mi = Math.min(59, Number(digits.slice(10, 12) || 0));
  return `${iso}T${pad(hh)}:${pad(mi)}`;
}

// A lone digit between separators is a shorthand: "1/2/2026" -> "01/02/2026"
const padGroups = (raw) => raw.replace(/(?:^|(?<=[/ :]))(\d)(?=[/ :])/g, "0$1");

// Re-inserts the separators as the user types
function mask(raw, withTime) {
  const digits = padGroups(String(raw)).replace(/\D/g, "").slice(0, withTime ? 12 : 8);
  let out = digits.slice(0, 2);
  if (digits.length > 2) out += `/${digits.slice(2, 4)}`;
  if (digits.length > 4) out += `/${digits.slice(4, 8)}`;
  if (withTime && digits.length > 8) out += ` ${digits.slice(8, 10)}`;
  if (withTime && digits.length > 10) out += `:${digits.slice(10, 12)}`;
  return out;
}

export default function DateInput({ value, onChange, withTime = false, className = "", placeholder, ...rest }) {
  const { t } = useTranslation();
  const hint = placeholder || t(withTime ? "common.dateTimePlaceholder" : "common.datePlaceholder");
  const [text, setText] = useState(() => isoToText(value, withTime));
  const native = useRef(null);

  // Follow the value when it is changed from the outside (edit mode, reset…),
  // but never fight the half-typed date the user is in the middle of entering.
  useEffect(() => {
    if (textToIso(text, withTime) !== (value || "")) setText(isoToText(value, withTime));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, withTime]);

  const handle = (raw) => {
    const next = mask(raw, withTime);
    setText(next);
    const iso = textToIso(next, withTime);
    // An empty box clears the value; an incomplete one is left alone until it parses.
    if (iso || next === "") onChange?.(iso);
  };

  const openPicker = () => {
    const el = native.current;
    if (!el) return;
    if (typeof el.showPicker === "function") { try { el.showPicker(); return; } catch { /* not allowed here */ } }
    el.focus();
    el.click();
  };

  return (
    <div className={`relative ${className}`}>
      <input
        type="text"
        inputMode="numeric"
        dir="ltr"
        className="input pr-10"
        placeholder={hint}
        value={text}
        onChange={(e) => handle(e.target.value)}
        onBlur={() => setText(isoToText(textToIso(text, withTime), withTime))}
        {...rest}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={openPicker}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-red-400/70 hover:text-red-400 transition"
        aria-label={hint}
      >
        <CalendarDays size={16} />
      </button>
      <input
        ref={native}
        type={withTime ? "datetime-local" : "date"}
        tabIndex={-1}
        aria-hidden="true"
        className="absolute right-2 top-1/2 w-px h-px opacity-0 pointer-events-none"
        value={String(value || "").slice(0, withTime ? 16 : 10)}
        onChange={(e) => { setText(isoToText(e.target.value, withTime)); onChange?.(e.target.value); }}
      />
    </div>
  );
}
