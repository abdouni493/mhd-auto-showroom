import { formatAmount, formatDate, formatDateTime } from "../utils/format.js";
import { PrintLogo } from "./AnimatedLogo.jsx";

/* ============================================================================
 * Professional, single-page print templates (A4 portrait), available in
 * French (lang="fr", LTR) and Arabic (lang="ar", RTL). Every block sits in its
 * own bordered frame with a coloured header band; the whole document fits one
 * page with no large empty gaps.
 * ========================================================================== */

export const ACCENT = "#b91c1c"; // crimson brand colour
export const INK = "#111827";
export const MUTE = "#6b7280";
export const LINE = "#d1d5db";
export const SOFT = "#f3f4f6";

export const exact = { WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" };
// Keep latin text / numbers / amounts / dates rendering left-to-right even inside
// an RTL (Arabic) document, so "4 800 000 DA" never bidi-reverses to "DA 000 800 4".
export const ltr = { direction: "ltr", unicodeBidi: "isolate" };

// ── Bilingual label dictionary ────────────────────────────────────────────
export const L = {
  fr: {
    telPrefix: "Tél :",
    docNo: "N°",
    purchaseTitle: "Bon d'Achat",
    purchaseExtraShowroom: "Achat effectué par le showroom",
    purchaseExtraClient: "Achat auprès d'un client",
    saleTitle: "Facture de Vente",
    saleNormal: "Vente normale",
    saleDeposit: "Dépôt / Réservation",
    receiptTitle: "Reçu de Paiement",
    depositTitle: "Bon de Versement",
    withdrawalTitle: "Bon de Retrait",
    depositExtra: "Versement en caisse",
    withdrawalExtra: "Retrait de caisse",
    operationDetail: "Détail de l'opération",
    amount: "Montant",
    beneficiary: "Bénéficiaire",
    sigBeneficiary: "Signature Bénéficiaire",
    showroomOwner: "Acquéreur (Showroom)",
    client: "Client",
    clientSeller: "Client (vendeur)",
    vehicle: "Véhicule",
    companyName: "Raison sociale",
    phone: "Téléphone",
    phone2: "Tél. secondaire",
    address: "Adresse",
    article: "Article",
    fullName: "Nom complet",
    profession: "Profession",
    idDoc: "Pièce d'identité",
    deliveredOn: "Délivrée le",
    expiresOn: "Expire le",
    brand: "Marque", model: "Modèle", plate: "Immatriculation", year: "Année",
    color: "Couleur", energy: "Énergie", gearbox: "Boîte", seats: "Places",
    mileage: "Kilométrage", keys: "Nombre de clés", vin: "VIN / N° de châssis", documents: "Documents",
    financialInfo: "Informations financières",
    financialDetail: "Détail financier",
    paymentDetail: "Détail du paiement",
    purchasePrice: "Prix d'achat",
    amountPaid: "Montant versé",
    rest: "Reste à payer",
    basePrice: "Prix de base",
    tva: "TVA",
    totalTTC: "Total TTC",
    reduction: "Réduction",
    deposit: "Acompte versé",
    totalToPay: "Total à payer",
    description: "Description",
    paymentHistory: "Historique des paiements",
    inspectionReport: "Rapport d'inspection",
    security: "Sécurité", equipment: "Équipements", comfort: "Confort",
    sigShowroomBuyer: "Signature Acquéreur",
    sigSeller: "Signature Vendeur",
    sigClient: "Signature Client",
    sigShowroom: "Signature & Cachet Showroom",
    thanks: "Merci de votre confiance.",
    generatedOn: "Document généré le",
    energyLabels: { ESSENCE: "Essence", DIESEL: "Diesel", HYBRID: "Hybride", ELECTRIC: "Électrique" },
    gearboxLabels: { MANUAL: "Manuelle", AUTO: "Automatique" },
    kmUnit: "km",
    // Expenses period report
    expensesTitle: "Rapport des Dépenses",
    expensesScopeAll: "Toutes les dépenses (véhicules + showroom)",
    expensesScopeCar: "Dépenses véhicules",
    expensesScopeShowroom: "Dépenses showroom",
    period: "Période",
    summary: "Récapitulatif de la période",
    countLabel: "Nombre de dépenses",
    carExpensesTotal: "Total dépenses véhicules",
    showroomExpensesTotal: "Total dépenses showroom",
    grandTotal: "Total général",
    detailTitle: "Détail des dépenses",
    monthlyRecap: "Récapitulatif par mois",
    colNo: "N°",
    colDate: "Date",
    colName: "Désignation",
    colDesc: "Description",
    colCategory: "Véhicule / Catégorie",
    colAmount: "Montant",
    colMonth: "Mois",
    colOps: "Opérations",
    showroomCat: "Showroom",
    noExpenses: "Aucune dépense enregistrée pour cette période.",
    preparedBy: "Établi par",
    // New: deposit conditions
    depositConditionsTitle: "CONDITION RELATIVE AUX ARRHES",
    depositConditionsText: `Le montant versé par le client à la réservation du véhicule est expressément considéré comme des ARRHES DE RÉSERVATION.
En cas de désistement, d’annulation ou de refus du client de finaliser l’achat du véhicule de son propre fait, les arrhes versées restent acquises à FIFOU AUTO et ne donnent lieu à aucun remboursement, sous réserve des dispositions légales impératives applicables.
Le client reconnaît avoir été informé de cette condition avant le versement des arrhes, l’avoir lue, comprise et acceptée.`,
    depositManualMention: `Mention manuscrite du client : « Lu et approuvé, bon pour accord. »`,
  },
  ar: {
    telPrefix: "الهاتف :",
    docNo: "رقم",
    purchaseTitle: "وصل شراء",
    purchaseExtraShowroom: "شراء قام به المعرض",
    purchaseExtraClient: "شراء من عميل",
    saleTitle: "فاتورة بيع",
    saleNormal: "بيع عادي",
    saleDeposit: "عربون / حجز",
    receiptTitle: "وصل دفع",
    depositTitle: "وصل إيداع",
    withdrawalTitle: "وصل سحب",
    depositExtra: "إيداع في الصندوق",
    withdrawalExtra: "سحب من الصندوق",
    operationDetail: "تفاصيل العملية",
    amount: "المبلغ",
    beneficiary: "المستفيد",
    sigBeneficiary: "توقيع المستفيد",
    showroomOwner: "المشتري (المعرض)",
    client: "العميل",
    clientSeller: "العميل (البائع)",
    vehicle: "المركبة",
    companyName: "التسمية التجارية",
    phone: "الهاتف",
    phone2: "هاتف ثانوي",
    address: "العنوان",
    article: "المادة",
    fullName: "الاسم الكامل",
    profession: "المهنة",
    idDoc: "وثيقة الهوية",
    deliveredOn: "صادرة في",
    expiresOn: "تنتهي في",
    brand: "الماركة", model: "الطراز", plate: "رقم التسجيل", year: "السنة",
    color: "اللون", energy: "الطاقة", gearbox: "علبة السرعة", seats: "المقاعد",
    mileage: "المسافة المقطوعة", keys: "عدد المفاتيح", vin: "رقم الهيكل", documents: "الوثائق",
    financialInfo: "المعلومات المالية",
    financialDetail: "التفاصيل المالية",
    paymentDetail: "تفاصيل الدفع",
    purchasePrice: "سعر الشراء",
    amountPaid: "المبلغ المدفوع",
    rest: "المبلغ المتبقي",
    basePrice: "السعر الأساسي",
    tva: "الرسم على القيمة المضافة",
    totalTTC: "الإجمالي مع الرسم",
    reduction: "تخفيض",
    deposit: "الدفعة المقدمة",
    totalToPay: "المبلغ الإجمالي",
    description: "الوصف",
    paymentHistory: "سجل الدفعات",
    inspectionReport: "تقرير الفحص",
    security: "الأمان", equipment: "التجهيزات", comfort: "الراحة",
    sigShowroomBuyer: "توقيع المشتري",
    sigSeller: "توقيع البائع",
    sigClient: "توقيع العميل",
    sigShowroom: "التوقيع وختم المعرض",
    thanks: "شكراً لثقتكم.",
    generatedOn: "حُرّر هذا المستند في",
    energyLabels: { ESSENCE: "بنزين", DIESEL: "ديزل", HYBRID: "هجين", ELECTRIC: "كهربائي" },
    gearboxLabels: { MANUAL: "يدوية", AUTO: "أوتوماتيكية" },
    kmUnit: "كم",
    // Expenses period report
    expensesTitle: "تقرير المصاريف",
    expensesScopeAll: "جميع المصاريف (المركبات + المعرض)",
    expensesScopeCar: "مصاريف المركبات",
    expensesScopeShowroom: "مصاريف المعرض",
    period: "الفترة",
    summary: "ملخص الفترة",
    countLabel: "عدد المصاريف",
    carExpensesTotal: "إجمالي مصاريف المركبات",
    showroomExpensesTotal: "إجمالي مصاريف المعرض",
    grandTotal: "الإجمالي العام",
    detailTitle: "تفاصيل المصاريف",
    monthlyRecap: "ملخص شهري",
    colNo: "الرقم",
    colDate: "التاريخ",
    colName: "التسمية",
    colDesc: "الوصف",
    colCategory: "المركبة / الصنف",
    colAmount: "المبلغ",
    colMonth: "الشهر",
    colOps: "العمليات",
    showroomCat: "المعرض",
    noExpenses: "لا توجد مصاريف مسجلة خلال هذه الفترة.",
    preparedBy: "أعدّه",
    // New: deposit conditions (Arabic translation)
    depositConditionsTitle: "شروط متعلقة بالعربون",
    depositConditionsText: `المبلغ المدفوع من قبل العميل عند حجز المركبة يُعتَبر صراحةً عربونًا للحجز.
في حالة تراجع العميل أو إلغاءه أو امتناعه عن إتمام شراء المركبة لسبب يعود إليه، يظل العربون المدفوع محقّقًا لشركة FIFOU AUTO ولا يرد، مع مراعاة الأحكام القانونية الملزمة السارية.
يقر العميل بأنه تم إعلامه بهذه الشروط قبل دفع العربون، وأنه قرأها وفهمها وقبلها.`,
    depositManualMention: `إشارة بخط اليد من العميل: «اطلعت ووافقت، صالح للموافقة.»`,
  },
};

export const tr = (lang) => L[lang] || L.fr;
export const isAr = (lang) => lang === "ar";

export function sheetStyle(lang) {
  return {
    fontFamily: isAr(lang)
      ? "'Segoe UI', Tahoma, Arial, sans-serif"
      : "Inter, Arial, sans-serif",
    color: INK,
    background: "#fff",
    width: "190mm",
    margin: "0 auto",
    padding: "0",
    fontSize: "11px",
    lineHeight: 1.4,
    direction: isAr(lang) ? "rtl" : "ltr",
    textAlign: isAr(lang) ? "right" : "left",
    ...exact,
  };
}

// ── Small building blocks ────────────────────────────────────────────────
export function Frame({ title, children, style }) {
  return (
    <div style={{ border: `1px solid ${LINE}`, borderRadius: 6, overflow: "hidden", breakInside: "avoid", ...style }}>
      <div
        style={{
          background: ACCENT,
          color: "#fff",
          padding: "4px 9px",
          fontWeight: 800,
          fontSize: "9.5px",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          ...exact,
        }}
      >
        {title}
      </div>
      <div style={{ padding: "7px 9px" }}>{children}</div>
    </div>
  );
}

export function Row({ label, value, strong, last, lang }) {
  const v = value == null || value === "" ? "—" : value;
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 10,
        padding: "2.5px 0",
        borderBottom: last ? "none" : `1px dotted ${LINE}`,
      }}
    >
      <span style={{ color: MUTE, whiteSpace: "nowrap" }}>{label}</span>
      <span style={{ fontWeight: strong ? 800 : 600, textAlign: isAr(lang) ? "left" : "right", ...ltr }}>{v}</span>
    </div>
  );
}

export const grid2 = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "9px" };

// ── Header (full logo, no frame) + showroom legal block ───────────────────
export function Header({ showroom, lang }) {
  const x = tr(lang);
  // Render each contact segment as its own isolated run so latin numbers/emails
  // never bidi-reverse next to the Arabic "الهاتف :" label.
  const contactItems = [];
  if (showroom?.address) contactItems.push(<span style={ltr}>{showroom.address}</span>);
  if (showroom?.phone) contactItems.push(<span>{x.telPrefix} <span style={ltr}>{showroom.phone}</span></span>);
  if (showroom?.email) contactItems.push(<span style={ltr}>{showroom.email}</span>);
  const legal = [
    ["NIF", showroom?.nif],
    ["NIS", showroom?.nis],
    ["Art", showroom?.article],
    ["RC", showroom?.rc],
  ].filter(([, v]) => v);
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        borderBottom: `2.5px solid ${ACCENT}`,
        paddingBottom: 9,
        marginBottom: 10,
        ...exact,
      }}
    >
      <div style={{ display: "flex", gap: 12, alignItems: "center", minWidth: 0 }}>
        <PrintLogo src={showroom?.logo} size={58} />
        <div style={{ minWidth: 0, textAlign: isAr(lang) ? "right" : "left" }}>
          <div style={{ fontWeight: 900, fontSize: 17, textTransform: "uppercase", color: ACCENT, letterSpacing: "0.02em", ...ltr }}>
            {showroom?.name || "Showroom"}
          </div>
          {showroom?.description && <div style={{ color: MUTE, fontSize: 9.5, ...ltr }}>{showroom.description}</div>}
          {contactItems.length > 0 && (
            <div style={{ color: MUTE, fontSize: 9.5, marginTop: 2 }}>
              {contactItems.map((el, i) => (
                <span key={i}>{i > 0 ? "   ·   " : ""}{el}</span>
              ))}
            </div>
          )}
        </div>
      </div>
      {legal.length > 0 && (
        <div style={{ textAlign: isAr(lang) ? "left" : "right", fontSize: 9, color: MUTE, lineHeight: 1.5, whiteSpace: "nowrap", ...ltr }}>
          {legal.map(([k, v]) => (
            <div key={k}>
              {k} : <b style={{ color: INK }}>{v}</b>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Document title band ───────────────────────────────────────────────────
export function TitleBar({ title, reference, date, extra, lang }) {
  const x = tr(lang);
  const accentSide = isAr(lang) ? { borderRight: `4px solid ${ACCENT}` } : { borderLeft: `4px solid ${ACCENT}` };
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        background: SOFT,
        border: `1px solid ${LINE}`,
        ...accentSide,
        borderRadius: 6,
        padding: "7px 12px",
        marginBottom: 10,
        ...exact,
      }}
    >
      <div>
        <div style={{ fontWeight: 900, fontSize: 14, textTransform: "uppercase", color: ACCENT, letterSpacing: "0.03em" }}>
          {title}
        </div>
        {extra && <div style={{ fontSize: 9.5, color: MUTE, marginTop: 1 }}>{extra}</div>}
      </div>
      <div style={{ textAlign: isAr(lang) ? "left" : "right", fontSize: 10 }}>
        <div style={{ fontSize: 12 }}>
          {x.docNo} <b style={ltr}>{reference}</b>
        </div>
        <div style={{ color: MUTE, ...ltr, textAlign: isAr(lang) ? "left" : "right" }}>{date}</div>
      </div>
    </div>
  );
}

// ── Party blocks (all available details) ──────────────────────────────────
export function ClientBlock({ client, title, lang }) {
  const x = tr(lang);
  const c = client || {};
  const doc = [c.docType, c.docNumber].filter(Boolean).join(" ");
  return (
    <Frame title={title || x.client}>
      <Row lang={lang} label={x.fullName} value={`${c.firstName || ""} ${c.lastName || ""}`.trim()} strong />
      <Row lang={lang} label={x.phone} value={c.phonePrimary} />
      {c.phoneSecondary && <Row lang={lang} label={x.phone2} value={c.phoneSecondary} />}
      <Row lang={lang} label={x.address} value={c.address} />
      {c.profession && <Row lang={lang} label={x.profession} value={c.profession} />}
      <Row lang={lang} label={x.idDoc} value={doc || "—"} />
      {c.docDeliveryDate && <Row lang={lang} label={x.deliveredOn} value={formatDate(c.docDeliveryDate)} />}
      {c.docExpiry && <Row lang={lang} label={x.expiresOn} value={formatDate(c.docExpiry)} />}
      {c.nif && <Row lang={lang} label="NIF" value={c.nif} />}
      {c.rc && <Row lang={lang} label="RC" value={c.rc} last />}
    </Frame>
  );
}

// The showroom itself as the buying party — printed on a purchase the owner
// made on his own behalf (source "SHOWROOM").
export function ShowroomPartyBlock({ showroom, lang }) {
  const x = tr(lang);
  const s = showroom || {};
  return (
    <Frame title={x.showroomOwner}>
      <Row lang={lang} label={x.companyName} value={s.name} strong />
      <Row lang={lang} label={x.phone} value={s.phone} />
      <Row lang={lang} label={x.address} value={s.address} />
      {s.nif && <Row lang={lang} label="NIF" value={s.nif} />}
      {s.nis && <Row lang={lang} label="NIS" value={s.nis} />}
      {s.rc && <Row lang={lang} label="RC" value={s.rc} last />}
    </Frame>
  );
}

export function CarBlock({ car, lang }) {
  const x = tr(lang);
  const c = car || {};
  const docs = c.documents || [];
  return (
    <Frame title={x.vehicle}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 14px" }}>
        <Row lang={lang} label={x.brand} value={c.brand} strong />
        <Row lang={lang} label={x.model} value={c.model} strong />
        <Row lang={lang} label={x.plate} value={c.plate} />
        <Row lang={lang} label={x.year} value={c.year} />
        <Row lang={lang} label={x.color} value={c.color} />
        <Row lang={lang} label={x.energy} value={x.energyLabels[c.energy]} />
        <Row lang={lang} label={x.gearbox} value={x.gearboxLabels[c.gearbox]} />
        <Row lang={lang} label={x.seats} value={c.seats} />
        <Row lang={lang} label={x.mileage} value={c.mileage != null ? formatAmount(c.mileage, x.kmUnit) : "—"} />
        <Row lang={lang} label={x.keys} value={c.keysCount != null ? c.keysCount : "—"} />
      </div>
      <Row lang={lang} label={x.vin} value={c.vin} last={docs.length === 0} />
      {docs.length > 0 && <Row lang={lang} label={x.documents} value={docs.map((d) => d.type).join(", ")} last />}
    </Frame>
  );
}

// ── Financial frame ───────────────────────────────────────────────────────
export function MoneyFrame({ title, lines, total, rest, lang }) {
  return (
    <Frame title={title}>
      {lines.map((l, i) => (
        <Row key={i} lang={lang} label={l.label} value={l.value} strong={l.strong} />
      ))}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: 6,
          padding: "6px 9px",
          background: SOFT,
          borderRadius: 5,
          border: `1px solid ${LINE}`,
          ...exact,
        }}
      >
        <span style={{ fontWeight: 800, textTransform: "uppercase", fontSize: 10 }}>{total.label}</span>
        <span style={{ fontWeight: 900, fontSize: 15, color: ACCENT, ...ltr }}>{total.value}</span>
      </div>
      {rest && (
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5, padding: "0 2px" }}>
          <span style={{ fontWeight: 700, color: MUTE }}>{rest.label}</span>
          <span style={{ fontWeight: 900, color: rest.danger ? ACCENT : "#047857", ...ltr }}>{rest.value}</span>
        </div>
      )}
    </Frame>
  );
}

// ── Inspection (compact, 3 columns) ───────────────────────────────────────
export function InspectionBlock({ inspection, lang }) {
  if (!inspection) return null;
  const x = tr(lang);
  const cats = [
    [x.security, inspection.security],
    [x.equipment, inspection.equipment],
    [x.comfort, inspection.comfort],
  ];
  const hasAny = cats.some(([, arr]) => arr && arr.length);
  if (!hasAny) return null;
  return (
    <Frame title={x.inspectionReport} style={{ marginTop: 10 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0 14px" }}>
        {cats.map(([label, arr]) => (
          <div key={label}>
            <div style={{ fontWeight: 800, textTransform: "uppercase", fontSize: 9, color: ACCENT, borderBottom: `1px solid ${LINE}`, paddingBottom: 2, marginBottom: 3 }}>
              {label}
            </div>
            {!arr || arr.length === 0 ? (
              <div style={{ color: MUTE }}>—</div>
            ) : (
              arr.map((it, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 4, padding: "1px 0" }}>
                  <span style={{ fontWeight: 900, fontFamily: "monospace", color: it.active ? "#047857" : ACCENT, ...exact }}>
                    {it.active ? "✓" : "✗"}
                  </span>
                  <span style={{ textDecoration: it.active ? "none" : "line-through", color: it.active ? INK : MUTE, fontSize: 10 }}>
                    {it.label}
                  </span>
                </div>
              ))
            )}
          </div>
        ))}
      </div>
    </Frame>
  );
}

// ── Conditions block (compact bilingual-ready) ────────────────────────────
export function ConditionsBlock({ lang }) {
  const x = tr(lang);
  // Compact, small-font framed block to keep the page single-sheet friendly.
  return (
    <div style={{ marginTop: 8, breakInside: "avoid" }}>
      <Frame title={x.depositConditionsTitle} style={{ padding: 0 }}>
        <div style={{ fontSize: 10, color: INK, whiteSpace: "pre-line", lineHeight: 1.25 }}>
          <div style={{ marginBottom: 6 }}>{x.depositConditionsText}</div>
          <div style={{ fontWeight: 800 }}>{x.depositManualMention}</div>
        </div>
      </Frame>
    </div>
  );
}

// ── Signatures + footer ───────────────────────────────────────────────────
export function Signatures({ left, right }) {
  const box = {
    border: `1px solid ${LINE}`,
    borderRadius: 6,
    height: 64,
    display: "flex",
    flexDirection: "column",
    justifyContent: "flex-end",
    padding: "6px 9px",
  };
  const cap = { borderTop: `1px solid ${MUTE}`, paddingTop: 3, textAlign: "center", fontSize: 9.5, color: MUTE, textTransform: "uppercase", fontWeight: 700 };
  return (
    <div style={{ ...grid2, marginTop: 12, breakInside: "avoid" }}>
      <div style={box}><div style={cap}>{left}</div></div>
      <div style={box}><div style={cap}>{right}</div></div>
    </div>
  );
}

export function Footer({ showroom, lang }) {
  const x = tr(lang);
  return (
    <div style={{ marginTop: 10, paddingTop: 6, borderTop: `1px solid ${LINE}`, display: "flex", justifyContent: "space-between", fontSize: 8.5, color: MUTE }}>
      <span><span style={ltr}>{showroom?.name || "Showroom"}</span> — {x.thanks}</span>
      <span>{x.generatedOn} <span style={ltr}>{formatDate(new Date())}</span></span>
    </div>
  );
}

// ============================================================================
// Purchase Invoice
// ============================================================================
export function PurchaseInvoice({ purchase, showroom, lang = "fr" }) {
  const x = tr(lang);
  const isClient = purchase.sourceType === "CLIENT";
  return (
    <div style={sheetStyle(lang)}>
      <Header showroom={showroom} lang={lang} />
      <TitleBar
        lang={lang}
        title={x.purchaseTitle}
        reference={purchase.reference || purchase.id}
        date={formatDateTime(purchase.date)}
        extra={isClient ? x.purchaseExtraClient : x.purchaseExtraShowroom}
      />
      <div style={grid2}>
        {isClient
          ? <ClientBlock client={purchase.client} title={x.clientSeller} lang={lang} />
          : <ShowroomPartyBlock showroom={showroom} lang={lang} />}
        <CarBlock car={purchase.car} lang={lang} />
      </div>

      <div style={{ marginTop: 10 }}>
        <MoneyFrame
          lang={lang}
          title={x.financialInfo}
          lines={[
            { label: x.purchasePrice, value: formatAmount(purchase.purchasePrice), strong: true },
            { label: x.amountPaid, value: formatAmount(purchase.amountPaid) },
          ]}
          total={{ label: x.purchasePrice, value: formatAmount(purchase.purchasePrice) }}
          rest={{ label: x.rest, value: formatAmount(purchase.amountRest), danger: purchase.amountRest > 0 }}
        />
      </div>

      <InspectionBlock inspection={purchase.inspection} lang={lang} />
      <Signatures left={isClient ? x.sigSeller : x.sigShowroomBuyer} right={x.sigShowroom} />
      <Footer showroom={showroom} lang={lang} />
    </div>
  );
}

// ============================================================================
// Sale Invoice
// ============================================================================
export function SaleInvoice({ sale, showroom, lang = "fr" }) {
  const x = tr(lang);
  const lines = [{ label: x.basePrice, value: formatAmount(sale.totalBeforeTax), strong: true }];
  if (sale.tvaEnabled) {
    lines.push({ label: `${x.tva} (${sale.tvaRate}%)`, value: formatAmount(sale.totalAfterTax - sale.totalBeforeTax) });
    lines.push({ label: x.totalTTC, value: formatAmount(sale.totalAfterTax) });
  }
  if (sale.reductionType && sale.reductionType !== "NONE") {
    const label = sale.reductionType === "PERCENT" ? `${sale.reductionValue}%` : formatAmount(sale.reductionValue);
    lines.push({ label: `${x.reduction} (${label})`, value: `- ${formatAmount(sale.totalAfterTax - sale.totalAfterReduction)}` });
  }
  lines.push({ label: x.deposit, value: formatAmount(sale.amountPaid) });

  return (
    <div style={sheetStyle(lang)}>
      <Header showroom={showroom} lang={lang} />
      <TitleBar
        lang={lang}
        title={x.saleTitle}
        reference={sale.reference || sale.id}
        date={formatDateTime(sale.date)}
        extra={sale.saleType === "DEPOSIT" ? x.saleDeposit : x.saleNormal}
      />
      <div style={grid2}>
        <ClientBlock client={sale.client} lang={lang} />
        <CarBlock car={sale.car} lang={lang} />
      </div>

      <div style={{ marginTop: 10 }}>
        <MoneyFrame
          lang={lang}
          title={x.financialDetail}
          lines={lines}
          total={{ label: x.totalToPay, value: formatAmount(sale.totalAfterReduction) }}
          rest={{ label: x.rest, value: formatAmount(sale.amountRest), danger: sale.amountRest > 0 }}
        />
      </div>

      <InspectionBlock inspection={sale.inspection} lang={lang} />

      {/* New: deposit/arrhes conditions */}
      <ConditionsBlock lang={lang} />

      <Signatures left={x.sigClient} right={x.sigShowroom} />
      <Footer showroom={showroom} lang={lang} />
    </div>
  );
}

// ============================================================================
// Payment Receipt
// ============================================================================
export function PaymentReceipt({ payment, showroom, history = [], lang = "fr" }) {
  const x = tr(lang);
  return (
    <div style={sheetStyle(lang)}>
      <Header showroom={showroom} lang={lang} />
      <TitleBar lang={lang} title={x.receiptTitle} reference={payment.id} date={formatDateTime(payment.date)} />
      <div style={grid2}>
        <ClientBlock client={payment.client} lang={lang} />
        <CarBlock car={payment.car} lang={lang} />
      </div>

      <div style={{ marginTop: 10 }}>
        <MoneyFrame
          lang={lang}
          title={x.paymentDetail}
          lines={payment.description ? [{ label: x.description, value: payment.description }] : []}
          total={{ label: x.amountPaid, value: formatAmount(payment.amount) }}
        />
      </div>

      {history.length > 0 && (
        <Frame title={x.paymentHistory} style={{ marginTop: 10 }}>
          {history.map((p, i) => (
            <Row key={i} lang={lang} label={formatDate(p.date)} value={formatAmount(p.amount)} last={i === history.length - 1} />
          ))}
        </Frame>
      )}

      <Signatures left={x.sigClient} right={x.sigShowroom} />
      <Footer showroom={showroom} lang={lang} />
    </div>
  );
}

// ============================================================================
// Expenses Report (period) — multi-page friendly table document
// ============================================================================
const monthKeyOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

// Summary tile used by the report header strip
export function StatBox({ label, value, accent }) {
  return (
    <div
      style={{
        border: `1px solid ${accent ? ACCENT : LINE}`,
        borderRadius: 6,
        padding: "6px 9px",
        background: accent ? ACCENT : SOFT,
        color: accent ? "#fff" : INK,
        ...exact,
      }}
    >
      <div style={{ fontSize: 8.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: accent ? "rgba(255,255,255,0.85)" : MUTE }}>
        {label}
      </div>
      <div style={{ fontWeight: 900, fontSize: 13, marginTop: 1, ...ltr, textAlign: "inherit" }}>{value}</div>
    </div>
  );
}

export function ExpensesReport({ expenses = [], showroom, from, to, scope = "ALL", lang = "fr" }) {
  const x = tr(lang);
  const ar = isAr(lang);
  const alignStart = ar ? "right" : "left";
  const alignEnd = ar ? "left" : "right";

  // oldest → newest reads best on a period statement
  const list = [...expenses].sort((a, b) => new Date(a.date) - new Date(b.date));
  const amountOf = (e) => Number(e.amount) || 0;
  const carTotal = list.filter((e) => e.type === "CAR").reduce((a, e) => a + amountOf(e), 0);
  const showroomTotal = list.filter((e) => e.type !== "CAR").reduce((a, e) => a + amountOf(e), 0);
  const total = carTotal + showroomTotal;

  // month buckets for the recap table (only useful when the period spans several months)
  const monthly = [];
  const mIdx = {};
  for (const e of list) {
    const d = new Date(e.date);
    if (isNaN(d)) continue;
    const key = monthKeyOf(d);
    if (!(key in mIdx)) {
      mIdx[key] = monthly.length;
      monthly.push({
        key,
        label: d.toLocaleDateString(ar ? "ar-DZ" : "fr-FR", { month: "long", year: "numeric" }),
        count: 0,
        amount: 0,
      });
    }
    monthly[mIdx[key]].count += 1;
    monthly[mIdx[key]].amount += amountOf(e);
  }

  const scopeLabel =
    scope === "CAR" ? x.expensesScopeCar : scope === "SHOWROOM" ? x.expensesScopeShowroom : x.expensesScopeAll;

  const th = {
    background: ACCENT,
    color: "#fff",
    padding: "5px 7px",
    fontSize: 9,
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    border: `1px solid ${ACCENT}`,
    textAlign: alignStart,
    ...exact,
  };
  const td = {
    padding: "4px 7px",
    border: `1px solid ${LINE}`,
    fontSize: 10,
    verticalAlign: "top",
    textAlign: alignStart,
  };
  const tf = { ...td, background: SOFT, fontWeight: 900, fontSize: 11, border: `1px solid ${LINE}`, ...exact };

  return (
    <div style={sheetStyle(lang)}>
      <Header showroom={showroom} lang={lang} />

      {/* Title band — period statement instead of a document number */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          background: SOFT,
          border: `1px solid ${LINE}`,
          ...(ar ? { borderRight: `4px solid ${ACCENT}` } : { borderLeft: `4px solid ${ACCENT}` }),
          borderRadius: 6,
          padding: "7px 12px",
          marginBottom: 10,
          ...exact,
        }}
      >
        <div>
          <div style={{ fontWeight: 900, fontSize: 14, textTransform: "uppercase", color: ACCENT, letterSpacing: "0.03em" }}>
            {x.expensesTitle}
          </div>
          <div style={{ fontSize: 9.5, color: MUTE, marginTop: 1 }}>{scopeLabel}</div>
        </div>
        <div style={{ textAlign: alignEnd, fontSize: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 800 }}>
            {x.period} :{" "}
            <span style={ltr}>
              {formatDate(from)} — {formatDate(to)}
            </span>
          </div>
          <div style={{ color: MUTE }}>
            {x.countLabel} : <span style={ltr}>{list.length}</span>
          </div>
        </div>
      </div>

      {/* Summary strip */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 7, marginBottom: 10, breakInside: "avoid" }}>
        <StatBox label={x.countLabel} value={String(list.length)} />
        <StatBox label={x.carExpensesTotal} value={formatAmount(carTotal)} />
        <StatBox label={x.showroomExpensesTotal} value={formatAmount(showroomTotal)} />
        <StatBox label={x.grandTotal} value={formatAmount(total)} accent />
      </div>

      {/* Detail table */}
      <div style={{ fontWeight: 900, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em", color: ACCENT, marginBottom: 4 }}>
        {x.detailTitle}
      </div>

      {list.length === 0 ? (
        <div style={{ border: `1px solid ${LINE}`, borderRadius: 6, padding: "14px 10px", textAlign: "center", color: MUTE }}>
          {x.noExpenses}
        </div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: "6%" }} />
            <col style={{ width: "13%" }} />
            <col style={{ width: "24%" }} />
            <col style={{ width: "24%" }} />
            <col style={{ width: "17%" }} />
            <col style={{ width: "16%" }} />
          </colgroup>
          {/* thead repeats automatically on every printed page */}
          <thead style={{ display: "table-header-group" }}>
            <tr>
              <th style={th}>{x.colNo}</th>
              <th style={th}>{x.colDate}</th>
              <th style={th}>{x.colName}</th>
              <th style={th}>{x.colDesc}</th>
              <th style={th}>{x.colCategory}</th>
              <th style={{ ...th, textAlign: alignEnd }}>{x.colAmount}</th>
            </tr>
          </thead>
          <tbody>
            {list.map((e, i) => {
              const car = e.car;
              const category =
                e.type === "CAR"
                  ? [car?.brand, car?.model].filter(Boolean).join(" ") || x.vehicle
                  : x.showroomCat;
              return (
                <tr key={e.id ?? i} style={{ breakInside: "avoid", background: i % 2 ? SOFT : "#fff", ...exact }}>
                  <td style={{ ...td, color: MUTE, ...ltr, textAlign: alignStart }}>{i + 1}</td>
                  <td style={{ ...td, whiteSpace: "nowrap", ...ltr, textAlign: alignStart }}>{formatDate(e.date)}</td>
                  <td style={{ ...td, fontWeight: 700 }}>{e.name || "—"}</td>
                  <td style={{ ...td, color: MUTE }}>{e.description || "—"}</td>
                  <td style={{ ...td, fontSize: 9.5 }}>
                    <div>{category}</div>
                    {e.type === "CAR" && car?.plate && <div style={{ color: MUTE, ...ltr }}>{car.plate}</div>}
                  </td>
                  <td style={{ ...td, textAlign: alignEnd, fontWeight: 800, whiteSpace: "nowrap", ...ltr }}>
                    {formatAmount(amountOf(e))}
                  </td>
                </tr>
              );
            })}
            {/* Grand total closes the list — kept in <tbody> so it prints once,
                at the very end, instead of repeating on every page. */}
            <tr style={{ breakInside: "avoid" }}>
              <td style={{ ...tf, textTransform: "uppercase" }} colSpan={5}>
                {x.grandTotal}
              </td>
              <td style={{ ...tf, textAlign: alignEnd, color: ACCENT, whiteSpace: "nowrap", ...ltr }}>{formatAmount(total)}</td>
            </tr>
          </tbody>
        </table>
      )}

      {/* Monthly recap — only when the period actually covers several months */}
      {monthly.length > 1 && (
        <Frame title={x.monthlyRecap} style={{ marginTop: 10 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ display: "table-header-group" }}>
              <tr>
                <th style={{ ...th, background: SOFT, color: INK, border: `1px solid ${LINE}` }}>{x.colMonth}</th>
                <th style={{ ...th, background: SOFT, color: INK, border: `1px solid ${LINE}`, textAlign: "center" }}>{x.colOps}</th>
                <th style={{ ...th, background: SOFT, color: INK, border: `1px solid ${LINE}`, textAlign: alignEnd }}>{x.colAmount}</th>
              </tr>
            </thead>
            <tbody>
              {monthly.map((m) => (
                <tr key={m.key} style={{ breakInside: "avoid" }}>
                  <td style={{ ...td, textTransform: "capitalize" }}>{m.label}</td>
                  <td style={{ ...td, textAlign: "center", ...ltr }}>{m.count}</td>
                  <td style={{ ...td, textAlign: alignEnd, fontWeight: 800, ...ltr }}>{formatAmount(m.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Frame>
      )}

      <Signatures left={x.preparedBy} right={x.sigShowroom} />
      <Footer showroom={showroom} lang={lang} />
    </div>
  );
}

// ============================================================================
// Cash Register Receipt (Caisse — deposit / withdrawal)
// ============================================================================
export function CashTransactionInvoice({ transaction, showroom, lang = "fr" }) {
  const x = tr(lang);
  const t = transaction || {};
  const isWithdrawal = t.type === "WITHDRAWAL";
  // Deposit party — prefer the linked client record, otherwise the typed name/phone.
  const c = t.client || {};
  const partyName = `${c.firstName || ""} ${c.lastName || ""}`.trim() || t.clientName;

  return (
    <div style={sheetStyle(lang)}>
      <Header showroom={showroom} lang={lang} />
      <TitleBar
        lang={lang}
        title={isWithdrawal ? x.withdrawalTitle : x.depositTitle}
        reference={t.reference || t.id}
        date={formatDateTime(t.date)}
        extra={isWithdrawal ? x.withdrawalExtra : x.depositExtra}
      />

      {!isWithdrawal && (partyName || t.clientPhone) && (
        <Frame title={x.client} style={{ marginBottom: 10 }}>
          <Row lang={lang} label={x.fullName} value={partyName} strong />
          <Row lang={lang} label={x.phone} value={t.clientPhone || c.phonePrimary} last />
        </Frame>
      )}

      <MoneyFrame
        lang={lang}
        title={x.operationDetail}
        lines={t.description ? [{ label: x.description, value: t.description }] : []}
        total={{ label: x.amount, value: formatAmount(t.amount) }}
      />

      <Signatures left={isWithdrawal ? x.sigBeneficiary : x.sigClient} right={x.sigShowroom} />
      <Footer showroom={showroom} lang={lang} />
    </div>
  );
}
