/* ============================================================================
 * Amount spelled out in words — used by the invoices:
 *   « Arrêter la présente facture à la somme de : Quatre millions cinq cent
 *     mille Dinars Algériens »
 *   « أوقفت هذه الفاتورة على مبلغ : أربعة ملايين وخمسمائة ألف دينار جزائري »
 * ========================================================================== */

// ── French ──────────────────────────────────────────────────────────────────
const FR_UNITS = [
  "zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf",
  "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize",
  "dix-sept", "dix-huit", "dix-neuf",
];
const FR_TENS = {
  20: "vingt", 30: "trente", 40: "quarante", 50: "cinquante",
  60: "soixante", 80: "quatre-vingt",
};

// `multiplier` = the number is followed by mille / million / milliard, where
// "cent" and "quatre-vingt" stay invariable ("quatre-vingt mille", not "quatre-vingts mille").
function frBelow100(n, multiplier = false) {
  if (n < 20) return FR_UNITS[n];
  // 70-79 = soixante-dix…, 90-99 = quatre-vingt-dix…
  const base = n < 70 ? Math.floor(n / 10) * 10 : n < 80 ? 60 : 80;
  const rest = n - base;
  const word = FR_TENS[base];
  if (rest === 0) return base === 80 && !multiplier ? "quatre-vingts" : word;
  if (rest === 1 && (base === 20 || base === 30 || base === 40 || base === 50 || base === 60)) {
    return `${word} et un`;
  }
  if (rest === 11 && base === 60) return "soixante et onze";
  return `${word}-${FR_UNITS[rest]}`;
}

function frBelow1000(n, multiplier = false) {
  if (n < 100) return frBelow100(n, multiplier);
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const head = hundreds === 1 ? "cent" : `${FR_UNITS[hundreds]} cent`;
  if (rest === 0) return hundreds === 1 || multiplier ? head : `${head}s`;
  return `${head} ${frBelow100(rest)}`;
}

const FR_SCALES = [
  { value: 1e9, one: "milliard", many: "milliards" },
  { value: 1e6, one: "million", many: "millions" },
  { value: 1e3, one: "mille", many: "mille" }, // "mille" is invariable
];

function frNumber(n) {
  if (n === 0) return "zéro";
  const parts = [];
  let rest = n;
  for (const scale of FR_SCALES) {
    const count = Math.floor(rest / scale.value);
    if (count > 0) {
      const label = count === 1 ? scale.one : scale.many;
      // "mille" (not "un mille"); "un million" keeps its "un"
      parts.push(count === 1 && scale.value === 1e3 ? label : `${frBelow1000(count, true)} ${label}`);
      rest -= count * scale.value;
    }
  }
  if (rest > 0) parts.push(frBelow1000(rest));
  return parts.join(" ");
}

// ── Arabic ──────────────────────────────────────────────────────────────────
const AR_UNITS = [
  "", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة",
  "عشرة", "أحد عشر", "اثنا عشر", "ثلاثة عشر", "أربعة عشر", "خمسة عشر",
  "ستة عشر", "سبعة عشر", "ثمانية عشر", "تسعة عشر",
];
const AR_TENS = ["", "", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"];
const AR_HUNDREDS = [
  "", "مائة", "مائتان", "ثلاثمائة", "أربعمائة", "خمسمائة",
  "ستمائة", "سبعمائة", "ثمانمائة", "تسعمائة",
];

function arBelow1000(n) {
  const out = [];
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  if (hundreds) out.push(AR_HUNDREDS[hundreds]);
  if (rest) {
    if (rest < 20) out.push(AR_UNITS[rest]);
    else {
      const u = rest % 10;
      const t = Math.floor(rest / 10);
      out.push(u ? `${AR_UNITS[u]} و${AR_TENS[t]}` : AR_TENS[t]);
    }
  }
  return out.join(" و");
}

const AR_SCALES = [
  { value: 1e9, one: "مليار", two: "ملياران", many: "مليارات" },
  { value: 1e6, one: "مليون", two: "مليونان", many: "ملايين" },
  { value: 1e3, one: "ألف", two: "ألفان", many: "آلاف" },
];

function arNumber(n) {
  if (n === 0) return "صفر";
  const parts = [];
  let rest = n;
  for (const scale of AR_SCALES) {
    const count = Math.floor(rest / scale.value);
    if (count > 0) {
      if (count === 1) parts.push(scale.one);
      else if (count === 2) parts.push(scale.two);
      else if (count <= 10) parts.push(`${arBelow1000(count)} ${scale.many}`);
      else parts.push(`${arBelow1000(count)} ${scale.one}`);
      rest -= count * scale.value;
    }
  }
  if (rest > 0) parts.push(arBelow1000(rest));
  return parts.join(" و");
}

/**
 * Spell an amount in words, with the currency.
 * numberToWords(4500000, "fr") -> "Quatre millions cinq cent mille Dinars Algériens"
 * numberToWords(4500000, "ar") -> "أربعة ملايين وخمسمائة ألف دينار جزائري"
 */
export function numberToWords(value, lang = "fr") {
  const n = Math.abs(Math.round(Number(value) || 0));
  if (lang === "ar") {
    return `${arNumber(n)} دينار جزائري`.replace(/\s+/g, " ").trim();
  }
  const words = frNumber(n).replace(/\s+/g, " ").trim();
  const capitalised = words.charAt(0).toUpperCase() + words.slice(1);
  return `${capitalised} Dinars Algériens`;
}

export default numberToWords;
