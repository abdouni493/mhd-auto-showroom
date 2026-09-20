import {
  ACCENT, INK, MUTE, LINE, SOFT, exact, ltr, grid2,
  sheetStyle, tr, isAr, Frame, Row, Header, TitleBar,
  ClientBlock, CarBlock, InspectionBlock, Signatures, Footer,
} from "./PrintTemplates.jsx";
import { formatAmount, formatDate, formatDateTime } from "../utils/format.js";
import { numberToWords } from "../utils/numberToWords.js";

/* ============================================================================
 * Additional A4 print templates, bilingual (fr / ar), built from the paper
 * documents the showroom already uses:
 *
 *   BonEntree        Bon d'entrée + rapport d'inspection (date/heure au choix)
 *   EngagementDepot  Contrat de dépôt — عقد ايداع السيارات
 *   ReceptionForm    Formulaire réception véhicule (date/heure au choix)
 *   FicheTechnique   Fiche technique (prix de vente modifiable)
 *   BonVersement     Bon de versement (encaissement sur une vente)
 *   BonEntreeSortie  Bon de sortie du véhicule (date/heure au choix)
 *   FactureDocument  Facture proforma & facture finale
 *   SettlementReceipt Règlement du propriétaire d'un véhicule en dépôt
 *
 * They share the header / frames / signature blocks of PrintTemplates.jsx so
 * every document of the application looks like it belongs to the same set.
 * ========================================================================== */

// ── Extra bilingual labels (merged over the shared dictionary) ──────────────
const D = {
  fr: {
    // Bon d'entrée
    entryTitle: "Bon d'Entrée",
    entryExtra: "Réception d'un véhicule en stock",
    entryNo: "N° Bon d'entrée",
    clientCode: "Code client",
    showroomCode: "Code interne",
    vehicleDescription: "Description du véhicule",
    stopSumVoucher: "Arrêté le présent bon à la somme de :",
    bonDate: "Date du bon",
    colCarCode: "Code véhicule",
    colBrand: "Marque",
    colVehicle: "Véhicule",
    colPlate: "Immat.",
    colSerial: "Série / N° de châssis",
    colMileage: "Kilométrage",
    colPurchasePrice: "Prix d'achat",
    colBoughtOn: "Acheté le",
    total: "Total",
    remark: "Remarque",
    sigAgency: "Signature et cachet de l'Agence",
    sigShowroomPrint: "Empreinte et signature du Showroom",
    owner: "Propriétaire",
    // Engagement
    engagementTitle: "Contrat de Dépôt de Véhicule",
    engagementExtra: "Dépôt pour exposition et commercialisation",
    engagementBody:
      "Je soussigné(e), Monsieur / Madame {name}, titulaire de la carte nationale d'identité n° {doc}, délivrée le {docDate} à {docPlace},\n\natteste avoir déposé le véhicule de type {car}, portant le numéro de châssis {vin} et le numéro d'immatriculation {plate},\n\nà l'effet de son exposition et de sa commercialisation pour le compte du propriétaire, au siège du showroom {showroom}.",
    engagementPrice: "Prix de vente convenu",
    engagementNote:
      "Le véhicule reste la propriété du déposant jusqu'à sa vente. Le showroom en assure la garde, l'exposition et la commercialisation. Le produit de la vente est reversé au propriétaire après déduction de la part du showroom et des frais engagés sur le véhicule.",
    sigOwner: "Signature du propriétaire du véhicule",
    sigShowroomOwner: "Signature du propriétaire du showroom",
    madeAt: "Fait à",
    on: "le",
    // Réception
    receptionTitle: "Formulaire Réception Véhicule",
    receptionExtra: "État du véhicule et accessoires remis",
    sourceLabel: "Source du véhicule",
    brandLabel: "Marque du véhicule",
    chassisLabel: "Numéro de châssis",
    mileageLabel: "Kilométrage",
    dateTimeLabel: "Date et heure",
    accessories: "Accessoires & documents remis",
    exitDate: "Date de sortie",
    handedTo: "À (M. / Mme)",
    phoneNo: "N° de téléphone",
    // Fiche technique
    ficheTitle: "Fiche Technique",
    specification: "Spécification",
    engine: "Moteur",
    power: "Puissance",
    gearboxSpec: "Boîte",
    fuel: "Carburant",
    transmission: "Transmission",
    consumption: "Consommation",
    wheelbase: "Empattement",
    trunk: "Volume coffre",
    weight: "Poids à vide",
    tank: "Capacité réservoir",
    dimensions: "Dimensions (L x l x H)",
    seatsSpec: "Nombre de places",
    mileageSpec: "Kilométrage",
    priceLabel: "Prix",
    // Bon de versement
    versementTitle: "Bon de Versement",
    versementExtra: "Encaissement sur vente de véhicule",
    saleRef: "Vente n°",
    saleTotal: "Total de la vente",
    alreadyPaid: "Déjà versé",
    thisPayment: "Versement de ce jour",
    remainingAfter: "Reste à payer",
    paymentMode: "Mode de paiement",
    // Relevé de versements (statement)
    versementsTitle: "Versements",
    versementsExtra: "Relevé des versements sur la vente",
    dateLabel: "Date",
    montantLabel: "Montant",
    remiseLabel: "Remise",
    versementLabel: "Versement",
    colVersementNo: "N° de versements",
    colBonNo: "N° du bon",
    colVersements: "Versements",
    colVersementDate: "Date de versements",
    colObservation: "Observation",
    totalPaidLabel: "Total",
    restToPay: "Reste à payer",
    sigAgencyStamp: "Signature et cachet de l'Agence",
    sigClientPrint: "Empreinte et signature du client",
    // Bon d'entrée / sortie
    inOutTitle: "Bon de Sortie",
    inOutExtra: "Sortie du véhicule du parc showroom",
    outDateTime: "Date et heure de sortie",
    deliveredDocs: "Documents et accessoires remis au client",
    vehicleState: "État du véhicule à la sortie",
    sigDriver: "Signature du client (réception du véhicule)",
    // Factures
    proformaTitle: "Facture Proforma",
    finalTitle: "Facture",
    invoiceNo: "Facture N°",
    madeAtCity: "Faite à",
    clientBlock: "Client",
    ref: "Réf",
    designation: "Désignation",
    qty: "Quantité",
    unitPrice: "P.U.",
    lineTotal: "Total",
    totalHT: "Total HT",
    tvaLine: "TVA",
    stampLine: "Timbre",
    totalTTC: "Total TTC",
    reductionLine: "Réduction",
    stopSum: "Arrêter la présente facture à la somme de :",
    paymentModeLine: "Mode de paiement :",
    proformaNote:
      "Facture proforma — document non comptable, valable 15 jours. Elle ne constitue pas une facture de vente.",
    sigStamp: "Signature & cachet",
    chassis: "N° châssis",
    // Règlement propriétaire
    settlementTitle: "Règlement Propriétaire",
    settlementExtra: "Vente d'un véhicule déposé par un client",
    settlementDetail: "Décompte du règlement",
    salePrice: "Prix de vente du véhicule",
    showroomShare: "Part du showroom",
    showroomPartHT: "Part du showroom (HT)",
    showroomPartTva: "TVA sur part du showroom",
    showroomPartTTC: "Part du showroom (TTC)",
    expensesTotal: "Total des dépenses",
    ownerAmount: "Net à verser au propriétaire",
    expensesList: "Détail des dépenses engagées",
    noExpense: "Aucune dépense engagée sur ce véhicule.",
    sigOwnerReceipt: "Signature du propriétaire (pour acquit)",
    settledOn: "Réglé le",
    note: "Observation",
    yes: "Oui",
    no: "Non",
    // Fiche de bénéfice (Caisse → Bénéfice)
    beneficeTitle: "Fiche de Bénéfice",
    totalCostLabel: "Coût total du véhicule",
    beneficeNormal: "Vente normale — marge réalisée par le showroom",
    beneficePrestation: "Prestation — véhicule déposé par un client",
    beneficeDetail: "Décompte du bénéfice",
    beneficeNet: "Bénéfice net du showroom",
    beneficeMargin: "Marge sur le prix de vente",
    buyerBlock: "Acheteur",
    ownerBlock: "Propriétaire du véhicule",
    saleDateLabel: "Date de la vente",
    saleTypeLabel: "Type de vente",
    collected: "Encaissé",
    settlementState: "Règlement du propriétaire",
    settlementDone: "Effectué",
    settlementPending: "En attente",
    colExpense: "Dépense",
    colExpenseDate: "Date",
    colExpenseAmount: "Montant",
    stopSumBenefice: "Arrêté le présent bénéfice à la somme de :",
    sigAccounting: "Visa de la comptabilité",
    beneficeNoteNormal:
      "Bénéfice = prix de vente − prix d'achat du véhicule − dépenses engagées sur le véhicule.",
    beneficeNotePrestation:
      "Bénéfice = part revenant au showroom − dépenses engagées sur le véhicule. Le reste du prix de vente est reversé au propriétaire.",
  },
  ar: {
    entryTitle: "وصل دخول",
    entryExtra: "استلام مركبة في المخزون",
    entryNo: "رقم وصل الدخول",
    clientCode: "رمز العميل",
    showroomCode: "الرمز الداخلي",
    vehicleDescription: "وصف المركبة",
    stopSumVoucher: "أوقف هذا الوصل على مبلغ :",
    bonDate: "تاريخ الوصل",
    colCarCode: "رمز المركبة",
    colBrand: "الماركة",
    colVehicle: "المركبة",
    colPlate: "رقم التسجيل",
    colSerial: "رقم الهيكل",
    colMileage: "المسافة المقطوعة",
    colPurchasePrice: "سعر الشراء",
    colBoughtOn: "تاريخ الشراء",
    total: "المجموع",
    remark: "ملاحظة",
    sigAgency: "توقيع وختم الوكالة",
    sigShowroomPrint: "بصمة وتوقيع المعرض",
    owner: "المالك",
    engagementTitle: "عقد إيداع السيارات",
    engagementExtra: "إيداع لغرض العرض و التسويق",
    engagementBody:
      "أنا الممضي أسفله السيد(ة) {name}، الحامل لبطاقة التعريف الوطني رقم {doc}، الصادرة بتاريخ {docDate} في {docPlace}،\n\nأشهد أنني أودعت السيارة من نوع {car}، ذات رقم الهيكل {vin} ورقم لوحة الترقيم {plate}،\n\nلغرض العرض و التسويق لحساب المالك في مقر المعرض {showroom}.",
    engagementPrice: "سعر البيع المتفق عليه",
    engagementNote:
      "تبقى المركبة ملكاً للمودع إلى غاية بيعها. يتكفل المعرض بحراستها وعرضها وتسويقها. يُسلَّم ناتج البيع للمالك بعد خصم حصة المعرض والمصاريف المنفقة على المركبة.",
    sigOwner: "إمضاء صاحب السيارة",
    sigShowroomOwner: "إمضاء صاحب المعرض",
    madeAt: "حرر ب",
    on: "في",
    receptionTitle: "استمارة استلام المركبة",
    receptionExtra: "حالة المركبة و الملحقات المسلّمة",
    sourceLabel: "مصدر المركبة",
    brandLabel: "ماركة المركبة",
    chassisLabel: "رقم الهيكل",
    mileageLabel: "المسافة المقطوعة",
    dateTimeLabel: "التاريخ و الساعة",
    accessories: "الملحقات و الوثائق المسلّمة",
    exitDate: "تاريخ الخروج",
    handedTo: "إلى السيد(ة)",
    phoneNo: "رقم الهاتف",
    ficheTitle: "البطاقة التقنية",
    specification: "المواصفات",
    engine: "المحرك",
    power: "القوة",
    gearboxSpec: "علبة السرعة",
    fuel: "الوقود",
    transmission: "ناقل الحركة",
    consumption: "الاستهلاك",
    wheelbase: "قاعدة العجلات",
    trunk: "حجم الصندوق",
    weight: "الوزن الفارغ",
    tank: "سعة الخزان",
    dimensions: "الأبعاد (ط × ع × ا)",
    seatsSpec: "عدد المقاعد",
    mileageSpec: "المسافة المقطوعة",
    priceLabel: "السعر",
    versementTitle: "وصل دفع",
    versementExtra: "تحصيل على بيع مركبة",
    saleRef: "البيع رقم",
    saleTotal: "إجمالي البيع",
    alreadyPaid: "المدفوع سابقاً",
    thisPayment: "دفعة اليوم",
    remainingAfter: "المبلغ المتبقي",
    paymentMode: "طريقة الدفع",
    // كشف الدفعات
    versementsTitle: "الدفعات",
    versementsExtra: "كشف الدفعات على البيع",
    dateLabel: "التاريخ",
    montantLabel: "المبلغ",
    remiseLabel: "تخفيض",
    versementLabel: "الدفعة",
    colVersementNo: "رقم الدفعة",
    colBonNo: "رقم الوصل",
    colVersements: "الدفعات",
    colVersementDate: "تاريخ الدفعة",
    colObservation: "ملاحظة",
    totalPaidLabel: "المجموع",
    restToPay: "المبلغ المتبقي",
    sigAgencyStamp: "توقيع و ختم الوكالة",
    sigClientPrint: "بصمة و توقيع العميل",
    inOutTitle: "وصل خروج",
    inOutExtra: "خروج المركبة من حظيرة المعرض",
    outDateTime: "تاريخ و ساعة الخروج",
    deliveredDocs: "الوثائق و الملحقات المسلّمة للعميل",
    vehicleState: "حالة المركبة عند الخروج",
    sigDriver: "توقيع العميل (استلام المركبة)",
    proformaTitle: "فاتورة أولية",
    finalTitle: "فاتورة",
    invoiceNo: "فاتورة رقم",
    madeAtCity: "حررت ب",
    clientBlock: "العميل",
    ref: "الرقم",
    designation: "التعيين",
    qty: "الكمية",
    unitPrice: "السعر الوحدوي",
    lineTotal: "المجموع",
    totalHT: "المجموع دون الرسم",
    tvaLine: "الرسم على القيمة المضافة",
    stampLine: "الطابع",
    totalTTC: "المجموع مع الرسم",
    reductionLine: "تخفيض",
    stopSum: "أوقفت هذه الفاتورة على مبلغ :",
    paymentModeLine: "طريقة الدفع :",
    proformaNote: "فاتورة أولية — وثيقة غير محاسبية، صالحة لمدة 15 يوماً. لا تُعتبر فاتورة بيع.",
    sigStamp: "التوقيع و الختم",
    chassis: "رقم الهيكل",
    settlementTitle: "تسوية المالك",
    settlementExtra: "بيع مركبة مودعة من طرف عميل",
    settlementDetail: "كشف التسوية",
    salePrice: "سعر بيع المركبة",
    showroomShare: "حصة المعرض",
    showroomPartHT: "حصة المعرض (دون الرسم)",
    showroomPartTva: "الرسم على حصة المعرض",
    showroomPartTTC: "حصة المعرض (مع الرسم)",
    expensesTotal: "إجمالي المصاريف",
    ownerAmount: "الصافي المستحق للمالك",
    expensesList: "تفصيل المصاريف المنفقة",
    noExpense: "لا توجد مصاريف على هذه المركبة.",
    sigOwnerReceipt: "توقيع المالك (بالاستلام)",
    settledOn: "سُوِّيت في",
    note: "ملاحظة",
    yes: "نعم",
    no: "لا",
    // بطاقة الربح
    beneficeTitle: "بطاقة الربح",
    totalCostLabel: "التكلفة الإجمالية للمركبة",
    beneficeNormal: "بيع عادي — الهامش المحقق من طرف المعرض",
    beneficePrestation: "خدمة — مركبة مودعة من طرف عميل",
    beneficeDetail: "كشف الربح",
    beneficeNet: "الربح الصافي للمعرض",
    beneficeMargin: "نسبة الربح من سعر البيع",
    buyerBlock: "المشتري",
    ownerBlock: "مالك المركبة",
    saleDateLabel: "تاريخ البيع",
    saleTypeLabel: "نوع البيع",
    collected: "المحصَّل",
    settlementState: "تسوية المالك",
    settlementDone: "تمت",
    settlementPending: "في الانتظار",
    colExpense: "المصروف",
    colExpenseDate: "التاريخ",
    colExpenseAmount: "المبلغ",
    stopSumBenefice: "أوقف هذا الربح على مبلغ :",
    sigAccounting: "تأشيرة المحاسبة",
    beneficeNoteNormal:
      "الربح = سعر البيع − سعر شراء المركبة − المصاريف المنفقة على المركبة.",
    beneficeNotePrestation:
      "الربح = حصة المعرض − المصاريف المنفقة على المركبة. ما تبقى من سعر البيع يُسلَّم للمالك.",
  },
};

// merged dictionary: shared labels + the ones above
const x2 = (lang) => ({ ...tr(lang), ...(D[lang] || D.fr) });

const dash = (v) => (v === null || v === undefined || v === "" ? "—" : v);
const carName = (c) => [c?.brand, c?.model].filter(Boolean).join(" ") || "—";

// ── Small shared pieces ────────────────────────────────────────────────────
function tableStyles(lang) {
  const ar = isAr(lang);
  const start = ar ? "right" : "left";
  const end = ar ? "left" : "right";
  return {
    start,
    end,
    th: {
      background: ACCENT, color: "#fff", padding: "7px 9px", fontSize: 10.5,
      fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em",
      border: `1px solid ${ACCENT}`, textAlign: start, ...exact,
    },
    td: {
      padding: "7px 9px", border: `1px solid ${LINE}`, fontSize: 11.5,
      verticalAlign: "middle", textAlign: start,
    },
    tf: {
      padding: "8px 9px", border: `1px solid ${LINE}`, background: SOFT,
      fontWeight: 900, fontSize: 12.5, ...exact,
    },
  };
}

// Filled blank inside a contract sentence, e.g. "Monsieur __Ali Ben__"
function Blank({ children }) {
  return (
    <span
      style={{
        fontWeight: 800, color: ACCENT, borderBottom: `1px dotted ${ACCENT}`,
        padding: "0 4px", ...ltr,
      }}
    >
      {children || "..............................."}
    </span>
  );
}

// A labelled box on the reception form
function FormLine({ label, value, lang, width = "100%" }) {
  return (
    <div style={{ width, marginBottom: 8 }}>
      <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", color: MUTE, letterSpacing: "0.05em" }}>
        {label}
      </div>
      <div
        style={{
          borderBottom: `1px solid ${LINE}`, minHeight: 20, paddingBottom: 3,
          fontWeight: 700, fontSize: 12.5, textAlign: isAr(lang) ? "right" : "left", ...ltr,
        }}
      >
        {dash(value)}
      </div>
    </div>
  );
}

// Printed tick box
function CheckBox({ checked, label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 0" }}>
      <span
        style={{
          width: 14, height: 14, border: `1.5px solid ${checked ? ACCENT : MUTE}`,
          borderRadius: 2, display: "inline-flex", alignItems: "center", justifyContent: "center",
          background: checked ? ACCENT : "#fff", color: "#fff", fontSize: 10,
          fontWeight: 900, lineHeight: 1, ...exact,
        }}
      >
        {checked ? "✓" : ""}
      </span>
      <span style={{ fontSize: 11.5, fontWeight: checked ? 700 : 500, color: checked ? INK : MUTE }}>
        {label}
      </span>
    </div>
  );
}

// ============================================================================
// 1. BON D'ENTRÉE  (+ rapport d'inspection intégré)
// ============================================================================
export function BonEntree({ purchase, showroom, lang = "fr", dateTime }) {
  const x = x2(lang);
  const s = tableStyles(lang);
  const car = purchase?.car || {};
  const when = dateTime || purchase?.date;
  const isClient = purchase?.sourceType === "CLIENT";
  const sourceName = isClient
    ? `${purchase?.client?.firstName || ""} ${purchase?.client?.lastName || ""}`.trim()
    : showroom?.name;
  const sourceLabel = isClient ? x.owner : x.showroomCat;
  const codeLabel = isClient ? x.clientCode : x.showroomCode;
  const code = isClient ? purchase?.clientId : purchase?.reference;

  return (
    <div style={sheetStyle(lang, true)}>
      <Header showroom={showroom} lang={lang} />
      <TitleBar
        lang={lang}
        title={x.entryTitle}
        reference={purchase?.entryNumber || purchase?.reference}
        date={formatDateTime(when)}
        extra={x.entryExtra}
      />

      {/* Source strip */}
      <div
        style={{
          display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 9,
          border: `1px solid ${LINE}`, borderRadius: 6, padding: "7px 10px",
          background: SOFT, marginBottom: 10, ...exact,
        }}
      >
        <div>
          <div style={{ fontSize: 8.5, fontWeight: 800, color: MUTE, textTransform: "uppercase" }}>{sourceLabel}</div>
          <div style={{ fontWeight: 900, fontSize: 12 }}>{dash(sourceName)}</div>
        </div>
        <div>
          <div style={{ fontSize: 8.5, fontWeight: 800, color: MUTE, textTransform: "uppercase" }}>{codeLabel}</div>
          <div style={{ fontWeight: 900, fontSize: 12, ...ltr }}>{dash(code)}</div>
        </div>
        <div>
          <div style={{ fontSize: 8.5, fontWeight: 800, color: MUTE, textTransform: "uppercase" }}>{x.bonDate}</div>
          <div style={{ fontWeight: 900, fontSize: 12, ...ltr }}>{formatDateTime(when)}</div>
        </div>
      </div>

      {/* Vehicle line — a bon d'entrée records the vehicle, never its price */}
      <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed", marginBottom: 10 }}>
        <colgroup>
          <col style={{ width: "9%" }} />
          <col style={{ width: "15%" }} />
          <col style={{ width: "17%" }} />
          <col style={{ width: "14%" }} />
          <col style={{ width: "24%" }} />
          <col style={{ width: "10%" }} />
          <col style={{ width: "11%" }} />
        </colgroup>
        <thead>
          <tr>
            {[x.colCarCode, x.colBrand, x.colVehicle, x.colPlate, x.colSerial, x.colMileage, x.colBoughtOn].map((h, i) => (
              <th key={i} style={{ ...s.th, fontSize: 8, padding: "5px 5px", lineHeight: 1.25, overflowWrap: "anywhere" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ ...s.td, ...ltr, textAlign: s.start }}>{dash(car.id)}</td>
            <td style={{ ...s.td, fontWeight: 800 }}>{dash(car.brand)}</td>
            <td style={{ ...s.td }}>{dash(car.model)}</td>
            <td style={{ ...s.td, ...ltr, textAlign: s.start }}>{car.plate || "SANS"}</td>
            <td style={{ ...s.td, ...ltr, textAlign: s.start, wordBreak: "break-all" }}>{dash(car.vin)}</td>
            <td style={{ ...s.td, ...ltr, textAlign: s.start }}>{car.mileage != null ? car.mileage : 0}</td>
            <td style={{ ...s.td, ...ltr, textAlign: s.start, whiteSpace: "nowrap" }}>{formatDate(purchase?.date)}</td>
          </tr>
        </tbody>
      </table>

      {/* Inspection integrated into the bon d'entrée */}
      <InspectionBlock inspection={purchase?.inspection || purchase?.car?.inspection} lang={lang} />

      {/* Keys + documents recap */}
      <Frame title={x.accessories} style={{ marginTop: 10 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0 12px" }}>
          <Row lang={lang} label={x.keys} value={car.keysCount != null ? car.keysCount : "—"} last />
          {(car.documents || []).map((d, i) => (
            <div key={i}><CheckBox checked={!!d.type} label={d.type} /></div>
          ))}
        </div>
      </Frame>

      {/* Remark */}
      <Frame title={x.remark} style={{ marginTop: 10 }}>
        <div style={{ minHeight: 24, fontSize: 10.5 }}>{purchase?.remark || ""}</div>
      </Frame>

      <Signatures left={x.sigAgency} right={isClient ? x.sigOwner : x.sigShowroomPrint} />
      <Footer showroom={showroom} lang={lang} />
    </div>
  );
}

// ============================================================================
// 2. ENGAGEMENT — contrat de dépôt de véhicule
// ============================================================================
export function EngagementDepot({ purchase, showroom, lang = "fr" }) {
  const x = x2(lang);
  const car = purchase?.car || {};
  const c = purchase?.client || {};
  const ownerName = `${c.firstName || ""} ${c.lastName || ""}`.trim();

  // The contract sentence is one template string with highlighted blanks.
  const parts = x.engagementBody.split(/(\{name\}|\{doc\}|\{docDate\}|\{docPlace\}|\{car\}|\{vin\}|\{plate\}|\{showroom\})/g);
  const fill = {
    "{name}": ownerName,
    "{doc}": c.docNumber,
    "{docDate}": c.docDeliveryDate ? formatDate(c.docDeliveryDate) : "",
    "{docPlace}": c.docDeliveryAddress,
    "{car}": carName(car),
    "{vin}": car.vin,
    "{plate}": car.plate,
    "{showroom}": showroom?.name,
  };

  return (
    <div style={sheetStyle(lang, true)}>
      <Header showroom={showroom} lang={lang} />
      <TitleBar
        lang={lang}
        title={x.engagementTitle}
        reference={purchase?.reference}
        date={formatDate(purchase?.date)}
        extra={x.engagementExtra}
      />

      <div
        style={{
          border: `1px solid ${LINE}`, borderRadius: 6, padding: "16px 18px",
          fontSize: 12, lineHeight: 2.1, whiteSpace: "pre-line", marginBottom: 12,
        }}
      >
        {parts.map((p, i) =>
          fill[p] !== undefined ? <Blank key={i}>{fill[p]}</Blank> : <span key={i}>{p}</span>
        )}
      </div>

      <div style={grid2}>
        <ClientBlock client={purchase?.client} title={x.owner} lang={lang} />
        <CarBlock car={car} lang={lang} />
      </div>

      {purchase?.sellingPrice > 0 && (
        <div
          style={{
            marginTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center",
            border: `1px solid ${ACCENT}`, borderRadius: 6, padding: "8px 12px", background: SOFT, ...exact,
          }}
        >
          <span style={{ fontWeight: 800, textTransform: "uppercase", fontSize: 10 }}>{x.engagementPrice}</span>
          <span style={{ fontWeight: 900, fontSize: 16, color: ACCENT, ...ltr }}>{formatAmount(purchase.sellingPrice)}</span>
        </div>
      )}

      <div style={{ marginTop: 10, fontSize: 9.5, color: MUTE, lineHeight: 1.5, border: `1px dashed ${LINE}`, borderRadius: 6, padding: "7px 9px" }}>
        {x.engagementNote}
      </div>

      <div style={{ marginTop: 10, fontSize: 10, color: MUTE }}>
        {x.madeAt} <b style={{ color: INK }}>{showroom?.address ? String(showroom.address).split(",").pop().trim() : "—"}</b>{" "}
        {x.on} <b style={{ color: INK, ...ltr }}>{formatDate(purchase?.date || new Date())}</b>
      </div>

      <Signatures left={x.sigOwner} right={x.sigShowroomOwner} />
      <Footer showroom={showroom} lang={lang} />
    </div>
  );
}

// ============================================================================
// 3. FORMULAIRE RÉCEPTION VÉHICULE
// ============================================================================
export function ReceptionForm({ purchase, showroom, lang = "fr", dateTime, receivedPhone, docTypes = [] }) {
  const x = x2(lang);
  const car = purchase?.car || {};
  const attached = new Set((car.documents || []).map((d) => d.type));
  // every known document type is printed; the ones held for this car are ticked
  const list = docTypes.length ? docTypes : Array.from(attached);
  const isClient = purchase?.sourceType === "CLIENT";
  const sourceName = isClient && purchase?.client
    ? `${purchase.client.firstName || ""} ${purchase.client.lastName || ""}`.trim()
    : showroom?.name;

  return (
    <div style={sheetStyle(lang, true)}>
      <Header showroom={showroom} lang={lang} />
      <TitleBar
        lang={lang}
        title={x.receptionTitle}
        reference={purchase?.reference}
        date={formatDateTime(dateTime || purchase?.receivedAt || purchase?.date)}
        extra={x.receptionExtra}
      />

      <Frame title={x.vehicle}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 18px" }}>
          <FormLine lang={lang} label={x.sourceLabel} value={sourceName} />
          <FormLine lang={lang} label={x.brandLabel} value={carName(car)} />
          <FormLine lang={lang} label={x.chassisLabel} value={car.vin} />
          <FormLine lang={lang} label={x.plate} value={car.plate} />
          <FormLine lang={lang} label={x.mileageLabel} value={car.mileage != null ? formatAmount(car.mileage, x.kmUnit) : "00"} />
          <FormLine lang={lang} label={x.dateTimeLabel} value={formatDateTime(dateTime || purchase?.receivedAt || purchase?.date)} />
        </div>
      </Frame>

      <Frame title={x.accessories} style={{ marginTop: 10 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0 14px" }}>
          {list.map((name, i) => (
            <CheckBox key={i} checked={attached.has(name)} label={name} />
          ))}
          <CheckBox checked={(car.keysCount || 0) > 0} label={`${x.keys} : ${car.keysCount != null ? car.keysCount : "—"}`} />
        </div>
      </Frame>

      <Frame title={x.remark} style={{ marginTop: 10 }}>
        <div style={{ minHeight: 26, fontSize: 11.5, fontWeight: 700 }}>{purchase?.remark || ""}</div>
      </Frame>

      <div style={{ ...grid2, marginTop: 10 }}>
        <Frame title={x.exitDate}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>
            <FormLine lang={lang} label={x.exitDate} value="" />
            <FormLine lang={lang} label={x.dateTimeLabel} value="" />
          </div>
        </Frame>
        <Frame title={x.handedTo}>
          <FormLine lang={lang} label={x.handedTo} value={purchase?.receivedBy} />
          {/* Phone is only printed when the user typed one in the print hub;
              it is never auto-filled from the client/showroom record. */}
          <FormLine lang={lang} label={x.phoneNo} value={receivedPhone || ""} />
        </Frame>
      </div>

      <Signatures left={x.sigAgency} right={isClient ? x.sigOwner : x.sigShowroomPrint} />
      <Footer showroom={showroom} lang={lang} />
    </div>
  );
}

// ============================================================================
// 4. FICHE TECHNIQUE — branded spec sheet with an editable price
//    Same paper as every other document of the set (showroom header, title
//    band, framed blocks, footer), no vehicle photo, and every piece of
//    information set large and bold so the sheet reads from a distance on the
//    windscreen of the vehicle. Printed as ONE full A4 page: the sheet is a
//    flex column that stretches to the whole printable height
//    (sheetStyle(lang, true)); printNode() scales it down if a very long
//    description ever pushes it past a single page.
// ============================================================================
export function FicheTechnique({ car, showroom, lang = "fr", price }) {
  const x = x2(lang);
  const ar = isAr(lang);
  const sp = car?.specs || {};
  const shownPrice = price !== undefined && price !== null && price !== "" ? Number(price) : Number(car?.price || 0);

  const specs = [
    [x.engine, sp.engine],
    [x.power, sp.power],
    [x.gearboxSpec, sp.gearbox || x.gearboxLabels[car?.gearbox]],
    [x.fuel, sp.fuel || x.energyLabels[car?.energy]],
    [x.transmission, sp.transmission],
    [x.consumption, sp.consumption],
    [x.wheelbase, sp.wheelbase],
    [x.trunk, sp.trunk],
    [x.weight, sp.weight],
    [x.tank, sp.tank],
    [x.dimensions, sp.dimensions],
    [x.seatsSpec, car?.seats],
    [x.mileageSpec, car?.mileage != null ? formatAmount(car.mileage, x.kmUnit) : null],
    [x.color, car?.color],
    [x.vin, car?.vin],
    [x.plate, car?.plate],
  ].filter(([, v]) => v !== undefined && v !== null && v !== "");

  // Specs laid out three per row — a stacked label over a big bold value —
  // exactly like the windscreen fiche technique the showroom prints.
  const rows = [];
  for (let i = 0; i < specs.length; i += 3) rows.push(specs.slice(i, i + 3));

  return (
    <div style={{ ...sheetStyle(lang, true), fontSize: "14px" }}>
      <div style={{ flexShrink: 0 }}>
        <Header showroom={showroom} lang={lang} />
        <TitleBar
          lang={lang}
          title={x.ficheTitle}
          reference={car?.plate || car?.vin || car?.id}
          date={formatDate(new Date())}
          extra={x.specification}
        />
      </div>

      {/* Vehicle identity — red band with the car name, like the windscreen sheet */}
      <div
        style={{
          flexShrink: 0, textAlign: "center", background: ACCENT,
          borderRadius: 10, padding: "18px 20px", ...exact,
        }}
      >
        <div style={{ fontWeight: 900, fontStyle: "italic", fontSize: 42, lineHeight: 1.05, textTransform: "uppercase", letterSpacing: "0.01em", color: "#fff", ...ltr }}>
          {carName(car)}
        </div>
        {(car?.year || car?.plate) && (
          <div
            style={{
              display: "inline-block", marginTop: 10, background: "#fff", color: ACCENT,
              fontWeight: 900, fontSize: 18, padding: "5px 16px", borderRadius: 999,
              letterSpacing: "0.06em", ...ltr, ...exact,
            }}
          >
            {[car?.year, car?.plate].filter(Boolean).join("   ·   ")}
          </div>
        )}
      </div>

      {/* SPÉCIFICATION — underlined heading, centered, like the printed sheet */}
      <div style={{ flexShrink: 0, textAlign: "center", margin: "10px 0 2px" }}>
        <span
          style={{
            display: "inline-block", fontSize: 24, fontWeight: 900, color: INK,
            textTransform: "uppercase", letterSpacing: "0.08em",
            borderBottom: `3px solid ${INK}`, paddingBottom: 5,
          }}
        >
          {x.specification}
        </span>
      </div>

      {/* Spec grid — stacked label over a big bold value, three per row */}
      <div style={{ flex: "1 1 auto", minHeight: 0, display: "flex", flexDirection: "column", justifyContent: "center", padding: "8px 0" }}>
        <div>
          {rows.map((row, ri) => (
            <div
              key={ri}
              style={{
                display: "flex",
                borderBottom: ri === rows.length - 1 ? "none" : `1px solid ${LINE}`,
              }}
            >
              {row.map(([label, value], ci) => (
                <div
                  key={ci}
                  style={{ flex: "1 1 0", minWidth: 0, padding: "13px 16px", textAlign: ar ? "right" : "left" }}
                >
                  <div style={{ fontSize: 16, fontWeight: 900, color: INK, textTransform: "uppercase", letterSpacing: "0.02em", lineHeight: 1.15 }}>
                    {label}
                  </div>
                  <div style={{ marginTop: 5, fontSize: 21, fontWeight: 800, color: INK, lineHeight: 1.2, wordBreak: "break-word", ...ltr }}>
                    {dash(value)}
                  </div>
                </div>
              ))}
              {row.length < 3 &&
                Array.from({ length: 3 - row.length }).map((_, k) => (
                  <div key={`pad-${k}`} style={{ flex: "1 1 0", minWidth: 0 }} />
                ))}
            </div>
          ))}
        </div>

        {car?.fiche && (
          <div style={{ marginTop: 12 }}>
            <Frame title={x.vehicleDescription}>
              <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.45, whiteSpace: "pre-line" }}>{car.fiche}</div>
            </Frame>
          </div>
        )}
      </div>

      {/* Price banner */}
      <div
        style={{
          flexShrink: 0, background: ACCENT, color: "#fff", borderRadius: 10,
          padding: "16px 26px", textAlign: "center", fontWeight: 900,
          fontSize: 38, letterSpacing: "0.03em", ...exact,
        }}
      >
        <span style={{ fontSize: 18, textTransform: "uppercase", letterSpacing: "0.18em", opacity: 0.92 }}>
          {x.priceLabel} :{" "}
        </span>
        <span style={ltr}>{formatAmount(shownPrice)}</span>
      </div>

      <div style={{ flexShrink: 0 }}>
        <Footer showroom={showroom} lang={lang} fontSize={12.5} />
      </div>
    </div>
  );
}

// ============================================================================
// 5. BON DE VERSEMENT
// ============================================================================
export function BonVersement({ sale, showroom, lang = "fr", payment, amount }) {
  const x = x2(lang);
  const total = Number(sale?.totalAfterReduction) || 0;
  const thisPayment =
    amount !== undefined && amount !== null && amount !== ""
      ? Number(amount)
      : Number(payment?.amount ?? sale?.amountPaid ?? 0);
  // `amountPaid` is the running total of the sale, this voucher covers only the
  // payment being printed, so what came before is the difference.
  const previous = Math.max(0, Number(sale?.amountPaid || 0) - thisPayment);
  const rest = Math.max(0, total - previous - thisPayment);

  const lines = [
    [x.saleTotal, formatAmount(total), false],
    [x.alreadyPaid, formatAmount(previous), false],
    [x.thisPayment, formatAmount(thisPayment), true],
  ];

  return (
    <div style={sheetStyle(lang, true)}>
      <Header showroom={showroom} lang={lang} />
      <TitleBar
        lang={lang}
        title={x.versementTitle}
        reference={payment?.reference || sale?.reference}
        date={formatDateTime(payment?.date || sale?.date)}
        extra={x.versementExtra}
      />

      <div style={grid2}>
        <ClientBlock client={sale?.client} lang={lang} />
        <CarBlock car={sale?.car} lang={lang} />
      </div>

      <Frame title={x.paymentDetail} style={{ marginTop: 10 }}>
        <Row lang={lang} label={x.saleRef} value={sale?.reference} />
        {lines.map(([label, value, strong], i) => (
          <Row key={i} lang={lang} label={label} value={value} strong={strong} />
        ))}
        {(payment?.description || sale?.paymentMethod) && (
          <Row lang={lang} label={x.paymentMode} value={payment?.description || sale?.paymentMethod} />
        )}
        <div
          style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            marginTop: 8, padding: "8px 11px", borderRadius: 6,
            background: ACCENT, color: "#fff", ...exact,
          }}
        >
          <span style={{ fontWeight: 800, textTransform: "uppercase", fontSize: 10.5 }}>{x.thisPayment}</span>
          <span style={{ fontWeight: 900, fontSize: 17, ...ltr }}>{formatAmount(thisPayment)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, padding: "0 2px" }}>
          <span style={{ fontWeight: 700, color: MUTE }}>{x.remainingAfter}</span>
          <span style={{ fontWeight: 900, color: rest > 0 ? ACCENT : "#047857", ...ltr }}>{formatAmount(rest)}</span>
        </div>
      </Frame>

      <div style={{ marginTop: 10, fontSize: 10, color: MUTE, border: `1px dashed ${LINE}`, borderRadius: 6, padding: "7px 9px" }}>
        <span style={{ fontWeight: 800, color: INK }}>{x.stopSumVoucher} </span>
        <span style={{ fontWeight: 700 }}>{numberToWords(thisPayment, lang)}</span>
      </div>

      <Signatures left={x.sigClient} right={x.sigShowroom} />
      <Footer showroom={showroom} lang={lang} />
    </div>
  );
}

// ============================================================================
// 6. BON DE SORTIE DU VÉHICULE
// ============================================================================
export function BonEntreeSortie({ sale, showroom, lang = "fr", dateTime, docTypes = [] }) {
  const x = x2(lang);
  const car = sale?.car || {};
  const attached = new Set((car.documents || []).map((d) => d.type));
  const list = docTypes.length ? docTypes : Array.from(attached);

  return (
    <div style={sheetStyle(lang, true)}>
      <Header showroom={showroom} lang={lang} />
      <TitleBar
        lang={lang}
        title={x.inOutTitle}
        reference={sale?.reference}
        date={formatDateTime(dateTime || sale?.date)}
        extra={x.inOutExtra}
      />

      <div style={grid2}>
        <ClientBlock client={sale?.client} lang={lang} />
        <CarBlock car={car} lang={lang} />
      </div>

      <Frame title={x.outDateTime} style={{ marginTop: 10 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 18px" }}>
          <FormLine lang={lang} label={x.outDateTime} value={formatDateTime(dateTime || sale?.date)} />
          <FormLine lang={lang} label={x.mileageLabel} value={car.mileage != null ? formatAmount(car.mileage, x.kmUnit) : "—"} />
        </div>
      </Frame>

      <Frame title={x.deliveredDocs} style={{ marginTop: 10 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0 14px" }}>
          {list.map((name, i) => (
            <CheckBox key={i} checked={attached.has(name)} label={name} />
          ))}
          <CheckBox checked={(car.keysCount || 0) > 0} label={`${x.keys} : ${car.keysCount != null ? car.keysCount : "—"}`} />
        </div>
      </Frame>

      <InspectionBlock inspection={sale?.inspection} lang={lang} />

      <Frame title={x.remark} style={{ marginTop: 10 }}>
        <div style={{ minHeight: 22, fontSize: 10.5 }} />
      </Frame>

      <Signatures left={x.sigDriver} right={x.sigAgency} />
      <Footer showroom={showroom} lang={lang} />
    </div>
  );
}

// ============================================================================
// 7. FACTURE PROFORMA / FACTURE FINALE
//    Built on the paper model: legal header, client block, item table,
//    HT / TVA / Timbre / TTC recap, amount in words, payment mode, stamp.
// ============================================================================
export function FactureDocument({ sale, showroom, lang = "fr", proforma = false, invoiceNumber }) {
  const x = x2(lang);
  const s = tableStyles(lang);
  const ar = isAr(lang);
  const car = sale?.car || {};
  const c = sale?.client || {};

  const base = Number(sale?.totalBeforeTax) || 0;
  const tvaRate = sale?.tvaEnabled ? Number(sale.tvaRate) || 0 : 0;
  const tva = Math.round((base * tvaRate) / 100);
  const afterTax = base + tva;
  const totalAfterReduction = Number(sale?.totalAfterReduction) || afterTax;
  const reduction = Math.max(0, afterTax - totalAfterReduction);
  const stampRate = sale?.stampEnabled ? Number(sale.stampRate) || 0 : 0;
  const stamp = Math.round((totalAfterReduction * stampRate) / 100);

  // Part kept by the showroom on a vehicle it sells for its owner. It is billed
  // as a service of its own: shown before tax, taxed at the invoice TVA rate,
  // shown again after tax, and added to the total of this invoice.
  const showroomPart = Math.max(0, Number(sale?.showroomShare) || 0);
  const showroomPartTva = Math.round((showroomPart * tvaRate) / 100);
  const showroomPartTTC = showroomPart + showroomPartTva;

  const grandTotal = totalAfterReduction + stamp + showroomPartTTC;
  const paid = Number(sale?.amountPaid) || 0;
  const remaining = Math.max(0, grandTotal - paid);

  const year = new Date(sale?.date || Date.now()).getFullYear();
  const num = invoiceNumber || `${String(sale?.id ?? "").padStart(2, "0")}/${year}`;
  const city = showroom?.address ? String(showroom.address).split(",").pop().trim() : "";

  const designation = [
    carName(car),
    car.color,
    car.year,
    car.energy ? x.energyLabels[car.energy] : null,
  ].filter(Boolean).join(" ");

  return (
    <div style={sheetStyle(lang, true)}>
      <Header showroom={showroom} lang={lang} />

      {/* Invoice number + place/date, like the paper model */}
      <div
        style={{
          display: "flex", justifyContent: "space-between", alignItems: "flex-end",
          marginBottom: 10, gap: 14,
        }}
      >
        <div
          style={{
            background: SOFT, border: `1px solid ${LINE}`,
            [ar ? "borderRight" : "borderLeft"]: `4px solid ${ACCENT}`,
            borderRadius: 6, padding: "7px 14px", ...exact,
          }}
        >
          <div style={{ fontWeight: 900, fontSize: 15, textTransform: "uppercase", color: ACCENT, letterSpacing: "0.04em" }}>
            {proforma ? x.proformaTitle : x.finalTitle}
          </div>
          <div style={{ fontSize: 11.5, marginTop: 1 }}>
            {x.invoiceNo} <b style={ltr}>{num}</b>
          </div>
        </div>
        <div style={{ fontSize: 10.5, textAlign: ar ? "left" : "right", color: MUTE }}>
          {x.madeAtCity} <b style={{ color: INK, ...ltr }}>{city || "—"}</b> {x.on}{" "}
          <b style={{ color: INK, ...ltr }}>{formatDate(sale?.date)}</b>
        </div>
      </div>

      {/* Client */}
      <Frame title={x.clientBlock}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 18px" }}>
          <Row lang={lang} label={x.fullName} value={`${c.firstName || ""} ${c.lastName || ""}`.trim()} strong />
          <Row lang={lang} label={x.phone} value={c.phonePrimary} />
          <Row lang={lang} label={x.address} value={c.address} />
          <Row lang={lang} label={x.idDoc} value={[c.docType, c.docNumber].filter(Boolean).join(" ")} />
          {c.rc && <Row lang={lang} label="RC" value={c.rc} />}
          {c.nif && <Row lang={lang} label="NIF" value={c.nif} />}
        </div>
      </Frame>

      {/* Items */}
      <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed", marginTop: 10 }}>
        <colgroup>
          <col style={{ width: "8%" }} />
          <col style={{ width: "44%" }} />
          <col style={{ width: "12%" }} />
          <col style={{ width: "18%" }} />
          <col style={{ width: "18%" }} />
        </colgroup>
        <thead>
          <tr>
            <th style={s.th}>{x.ref}</th>
            <th style={s.th}>{x.designation}</th>
            <th style={{ ...s.th, textAlign: "center" }}>{x.qty}</th>
            <th style={{ ...s.th, textAlign: s.end }}>{x.unitPrice}</th>
            <th style={{ ...s.th, textAlign: s.end }}>{x.lineTotal}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ ...s.td, ...ltr, textAlign: s.start }}>01</td>
            <td style={{ ...s.td }}>
              <div style={{ fontWeight: 800 }}>{designation}</div>
              {car.vin && (
                <div style={{ color: MUTE, fontSize: 9.5, ...ltr }}>
                  {x.chassis} : {car.vin}
                </div>
              )}
              {car.plate && (
                <div style={{ color: MUTE, fontSize: 9.5, ...ltr }}>
                  {x.plate} : {car.plate}
                </div>
              )}
            </td>
            <td style={{ ...s.td, textAlign: "center", ...ltr }}>1</td>
            <td style={{ ...s.td, textAlign: s.end, ...ltr }}>{formatAmount(base)}</td>
            <td style={{ ...s.td, textAlign: s.end, fontWeight: 800, ...ltr }}>{formatAmount(base)}</td>
          </tr>
          {/* keep the sheet visually close to the paper model */}
          {[0, 1, 2].map((i) => (
            <tr key={i}>
              <td style={{ ...s.td, height: 16 }} />
              <td style={s.td} />
              <td style={s.td} />
              <td style={s.td} />
              <td style={s.td} />
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div style={{ display: "flex", justifyContent: ar ? "flex-start" : "flex-end", marginTop: 10 }}>
        <table style={{ borderCollapse: "collapse", width: "62%" }}>
          <tbody>
            <tr>
              <td style={{ ...s.td, fontWeight: 700 }}>{x.totalHT}</td>
              <td style={{ ...s.td, textAlign: s.end, fontWeight: 800, ...ltr }}>{formatAmount(base)}</td>
            </tr>
            {tvaRate > 0 && (
              <tr>
                <td style={{ ...s.td, fontWeight: 700 }}>{`${x.tvaLine} ${tvaRate}%`}</td>
                <td style={{ ...s.td, textAlign: s.end, fontWeight: 800, ...ltr }}>{formatAmount(tva)}</td>
              </tr>
            )}
            {reduction > 0 && (
              <tr>
                <td style={{ ...s.td, fontWeight: 700 }}>{x.reductionLine}</td>
                <td style={{ ...s.td, textAlign: s.end, fontWeight: 800, ...ltr }}>- {formatAmount(reduction)}</td>
              </tr>
            )}
            {stampRate > 0 && (
              <tr>
                <td style={{ ...s.td, fontWeight: 700 }}>{`${x.stampLine} ${stampRate}%`}</td>
                <td style={{ ...s.td, textAlign: s.end, fontWeight: 800, ...ltr }}>{formatAmount(stamp)}</td>
              </tr>
            )}
            {showroomPart > 0 && (
              <>
                <tr>
                  <td style={{ ...s.td, fontWeight: 700, background: SOFT, ...exact }}>{x.showroomPartHT}</td>
                  <td style={{ ...s.td, textAlign: s.end, fontWeight: 800, background: SOFT, ...ltr, ...exact }}>
                    {formatAmount(showroomPart)}
                  </td>
                </tr>
                {tvaRate > 0 && (
                  <tr>
                    <td style={{ ...s.td, fontWeight: 700 }}>{`${x.showroomPartTva} ${tvaRate}%`}</td>
                    <td style={{ ...s.td, textAlign: s.end, fontWeight: 800, ...ltr }}>{formatAmount(showroomPartTva)}</td>
                  </tr>
                )}
                <tr>
                  <td style={{ ...s.td, fontWeight: 800, color: ACCENT }}>{x.showroomPartTTC}</td>
                  <td style={{ ...s.td, textAlign: s.end, fontWeight: 900, color: ACCENT, ...ltr }}>
                    {formatAmount(showroomPartTTC)}
                  </td>
                </tr>
              </>
            )}
            <tr>
              <td style={{ ...s.tf, textTransform: "uppercase", background: ACCENT, color: "#fff", border: `1px solid ${ACCENT}` }}>
                {x.totalTTC}
              </td>
              <td
                style={{
                  ...s.tf, textAlign: s.end, background: ACCENT, color: "#fff",
                  border: `1px solid ${ACCENT}`, fontSize: 14, ...ltr,
                }}
              >
                {formatAmount(grandTotal)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Amount in words */}
      <div
        style={{
          marginTop: 10, border: `1px solid ${LINE}`, borderRadius: 6,
          padding: "8px 11px", fontSize: 11, background: SOFT, ...exact,
        }}
      >
        <span style={{ fontWeight: 800 }}>{x.stopSum} </span>
        <span style={{ fontWeight: 700, textTransform: "uppercase" }}>{numberToWords(grandTotal, lang)}</span>
      </div>

      {/* Payment + deposit */}
      <div style={{ ...grid2, marginTop: 10 }}>
        <div style={{ fontSize: 10.5 }}>
          <div style={{ marginBottom: 3 }}>
            <b>{x.paymentModeLine}</b> {dash(sale?.paymentMethod)}
          </div>
          {!proforma && (
            <>
              <div style={{ color: MUTE }}>
                {x.deposit} : <b style={{ color: INK, ...ltr }}>{formatAmount(paid)}</b>
              </div>
              <div style={{ color: MUTE }}>
                {x.rest} :{" "}
                <b style={{ color: remaining > 0 ? ACCENT : "#047857", ...ltr }}>{formatAmount(remaining)}</b>
              </div>
            </>
          )}
          {proforma && (
            <div style={{ marginTop: 6, color: MUTE, fontSize: 9.5, fontStyle: "italic" }}>{x.proformaNote}</div>
          )}
        </div>
        <div
          style={{
            border: `1px solid ${LINE}`, borderRadius: 6, height: 82,
            display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: "6px 9px",
          }}
        >
          <div
            style={{
              borderTop: `1px solid ${MUTE}`, paddingTop: 3, textAlign: "center",
              fontSize: 9.5, color: MUTE, textTransform: "uppercase", fontWeight: 700,
            }}
          >
            {x.sigStamp}
          </div>
        </div>
      </div>

      <Footer showroom={showroom} lang={lang} />
    </div>
  );
}

// ============================================================================
// 8. RÈGLEMENT PROPRIÉTAIRE (vente d'un véhicule déposé par un client)
// ============================================================================
export function SettlementReceipt({ settlement, showroom, lang = "fr" }) {
  const x = x2(lang);
  const s = tableStyles(lang);
  const expenses = Array.isArray(settlement?.expenses) ? settlement.expenses : [];

  return (
    <div style={sheetStyle(lang, true)}>
      <Header showroom={showroom} lang={lang} />
      <TitleBar
        lang={lang}
        title={x.settlementTitle}
        reference={settlement?.reference}
        date={formatDateTime(settlement?.date)}
        extra={x.settlementExtra}
      />

      <div style={grid2}>
        <ClientBlock client={settlement?.client} title={x.owner} lang={lang} />
        <CarBlock car={settlement?.car} lang={lang} />
      </div>

      <Frame title={x.settlementDetail} style={{ marginTop: 10 }}>
        <Row lang={lang} label={x.saleRef} value={settlement?.sale?.reference} />
        <Row lang={lang} label={x.salePrice} value={formatAmount(settlement?.salePrice)} strong />
        <Row lang={lang} label={x.showroomShare} value={`- ${formatAmount(settlement?.showroomShare)}`} />
        <Row lang={lang} label={x.expensesTotal} value={`- ${formatAmount(settlement?.expensesTotal)}`} />
        {settlement?.paymentMethod && <Row lang={lang} label={x.paymentMode} value={settlement.paymentMethod} />}
        <div
          style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            marginTop: 8, padding: "9px 12px", borderRadius: 6,
            background: ACCENT, color: "#fff", ...exact,
          }}
        >
          <span style={{ fontWeight: 800, textTransform: "uppercase", fontSize: 10.5 }}>{x.ownerAmount}</span>
          <span style={{ fontWeight: 900, fontSize: 18, ...ltr }}>{formatAmount(settlement?.ownerAmount)}</span>
        </div>
      </Frame>

      <div style={{ fontWeight: 900, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em", color: ACCENT, margin: "10px 0 4px" }}>
        {x.expensesList}
      </div>
      {expenses.length === 0 ? (
        <div style={{ border: `1px solid ${LINE}`, borderRadius: 6, padding: "12px 10px", textAlign: "center", color: MUTE }}>
          {x.noExpense}
        </div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: "8%" }} />
            <col style={{ width: "18%" }} />
            <col style={{ width: "32%" }} />
            <col style={{ width: "24%" }} />
            <col style={{ width: "18%" }} />
          </colgroup>
          <thead>
            <tr>
              <th style={s.th}>{x.colNo}</th>
              <th style={s.th}>{x.colDate}</th>
              <th style={s.th}>{x.colName}</th>
              <th style={s.th}>{x.colDesc}</th>
              <th style={{ ...s.th, textAlign: s.end }}>{x.colAmount}</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((e, i) => (
              <tr key={i} style={{ background: i % 2 ? SOFT : "#fff", ...exact }}>
                <td style={{ ...s.td, color: MUTE, ...ltr, textAlign: s.start }}>{i + 1}</td>
                <td style={{ ...s.td, whiteSpace: "nowrap", ...ltr, textAlign: s.start }}>{formatDate(e.date)}</td>
                <td style={{ ...s.td, fontWeight: 700 }}>{dash(e.name)}</td>
                <td style={{ ...s.td, color: MUTE }}>{dash(e.description)}</td>
                <td style={{ ...s.td, textAlign: s.end, fontWeight: 800, ...ltr }}>{formatAmount(e.amount)}</td>
              </tr>
            ))}
            <tr>
              <td style={{ ...s.tf, textTransform: "uppercase", textAlign: s.start }} colSpan={4}>{x.expensesTotal}</td>
              <td style={{ ...s.tf, textAlign: s.end, color: ACCENT, ...ltr }}>{formatAmount(settlement?.expensesTotal)}</td>
            </tr>
          </tbody>
        </table>
      )}

      <div
        style={{
          marginTop: 10, border: `1px solid ${LINE}`, borderRadius: 6,
          padding: "8px 11px", fontSize: 11, background: SOFT, ...exact,
        }}
      >
        <span style={{ fontWeight: 800 }}>{x.stopSumVoucher} </span>
        <span style={{ fontWeight: 700 }}>{numberToWords(settlement?.ownerAmount, lang)}</span>
      </div>

      {settlement?.note && (
        <Frame title={x.note} style={{ marginTop: 10 }}>
          <div style={{ fontSize: 10.5 }}>{settlement.note}</div>
        </Frame>
      )}

      <Signatures left={x.sigOwnerReceipt} right={x.sigShowroom} />
      <Footer showroom={showroom} lang={lang} />
    </div>
  );
}

// ============================================================================
// 9. RELEVÉ DES VERSEMENTS  (statement of every installment paid on a sale)
//    Faithful to the paper "Versements" document — showroom header + logo,
//    client & vehicle info blocks, a table of every versement with its bon
//    number, versement number, amount, date and observation, then the total
//    paid and the remaining balance, with the agency stamp / client signature.
//    `highlightId` bolds one versement (used when printing a single one).
// ============================================================================
export function VersementStatement({ sale, showroom, lang = "fr", payments = [], highlightId = null }) {
  const x = x2(lang);
  const s = tableStyles(lang);
  const car = sale?.car || {};
  const client = sale?.client || {};
  const total = Number(sale?.totalAfterReduction) || 0;
  const list = (Array.isArray(payments) ? payments : [])
    .slice()
    .sort((a, b) => new Date(a.date) - new Date(b.date) || (a.id || 0) - (b.id || 0));
  const totalPaid = list.reduce((a, p) => a + (Number(p.amount) || 0), 0);
  const rest = Math.max(0, total - totalPaid);
  const featured =
    highlightId != null ? list.find((p) => p.id === highlightId) : list[list.length - 1];
  const reduction = Number(sale?.reductionValue) || 0;
  const bonNo = sale?.id ?? "";

  return (
    <div style={sheetStyle(lang, false)}>
      <Header showroom={showroom} lang={lang} />
      <TitleBar
        lang={lang}
        title={x.versementsTitle}
        reference={bonNo}
        date={formatDate(featured?.date || sale?.date)}
        extra={x.versementsExtra}
      />

      <div style={grid2}>
        {/* Client info */}
        <Frame title={x.clientBlock}>
          <Row lang={lang} label={x.dateLabel} value={formatDate(featured?.date || sale?.date)} />
          <Row lang={lang} label={x.clientBlock} value={`${client.firstName || ""} ${client.lastName || ""}`.trim()} strong />
          <Row lang={lang} label={x.clientCode} value={client.id} />
          <Row lang={lang} label={x.montantLabel} value={formatAmount(total)} strong last />
        </Frame>
        {/* Vehicle info */}
        <Frame title={x.vehicle}>
          <Row lang={lang} label={x.colCarCode} value={car.id} />
          <Row lang={lang} label={x.colBrand} value={carName(car)} strong />
          <Row lang={lang} label={x.plate} value={car.plate} />
          <Row lang={lang} label={x.versementLabel} value={formatAmount(featured?.amount || 0)} />
          <Row lang={lang} label={x.remiseLabel} value={formatAmount(reduction)} last />
        </Frame>
      </div>

      {/* Versements table */}
      <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed", marginTop: 10 }}>
        <colgroup>
          <col style={{ width: "17%" }} />
          <col style={{ width: "13%" }} />
          <col style={{ width: "22%" }} />
          <col style={{ width: "20%" }} />
          <col style={{ width: "28%" }} />
        </colgroup>
        <thead>
          <tr>
            <th style={s.th}>{x.colVersementNo}</th>
            <th style={s.th}>{x.colBonNo}</th>
            <th style={{ ...s.th, textAlign: s.end }}>{x.colVersements}</th>
            <th style={s.th}>{x.colVersementDate}</th>
            <th style={s.th}>{x.colObservation}</th>
          </tr>
        </thead>
        <tbody>
          {list.length === 0 ? (
            <tr>
              <td style={{ ...s.td, textAlign: "center", color: MUTE }} colSpan={5}>—</td>
            </tr>
          ) : (
            list.map((p, i) => {
              const hot = highlightId != null && p.id === highlightId;
              const bg = hot ? "#fde8e8" : i % 2 ? SOFT : "#fff";
              return (
                <tr key={p.id ?? i} style={{ background: bg, ...exact }}>
                  <td style={{ ...s.td, ...ltr, textAlign: s.start, fontWeight: hot ? 900 : 700, color: hot ? ACCENT : INK }}>{p.id ?? i + 1}</td>
                  <td style={{ ...s.td, ...ltr, textAlign: s.start }}>{bonNo}</td>
                  <td style={{ ...s.td, textAlign: s.end, fontWeight: 800, ...ltr }}>{formatAmount(p.amount)}</td>
                  <td style={{ ...s.td, whiteSpace: "nowrap", ...ltr, textAlign: s.start }}>{formatDate(p.date)}</td>
                  <td style={{ ...s.td, color: MUTE }}>{dash(p.description)}</td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>

      {/* Total paid + remaining balance */}
      <div style={{ ...grid2, marginTop: 10 }}>
        <div
          style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            border: `1px solid ${LINE}`, borderRadius: 6, padding: "9px 12px", background: SOFT, ...exact,
          }}
        >
          <span style={{ fontWeight: 800, textTransform: "uppercase", fontSize: 11 }}>{x.totalPaidLabel}</span>
          <span style={{ fontWeight: 900, fontSize: 16, ...ltr }}>{formatAmount(totalPaid)}</span>
        </div>
        <div
          style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            borderRadius: 6, padding: "9px 12px",
            background: rest > 0 ? ACCENT : "#047857", color: "#fff", ...exact,
          }}
        >
          <span style={{ fontWeight: 800, textTransform: "uppercase", fontSize: 11 }}>{x.restToPay}</span>
          <span style={{ fontWeight: 900, fontSize: 16, ...ltr }}>{formatAmount(rest)}</span>
        </div>
      </div>

      {/* Amount in words of the total collected */}
      <div style={{ marginTop: 10, border: `1px dashed ${LINE}`, borderRadius: 6, padding: "7px 9px", fontSize: 10.5 }}>
        <span style={{ fontWeight: 800, color: INK }}>{x.stopSumVoucher} </span>
        <span style={{ fontWeight: 700 }}>{numberToWords(totalPaid, lang)}</span>
      </div>

      <Signatures left={x.sigAgencyStamp} right={x.sigClientPrint} />
      <Footer showroom={showroom} lang={lang} />
    </div>
  );
}

// ============================================================================
// 10. FICHE DE BÉNÉFICE — le gain du showroom sur UNE vente
//     Imprimée depuis Caisse → Bénéfice. Elle reprend l'en-tête du showroom
//     (logo, identité, mentions légales), le véhicule, l'acheteur — et, pour
//     une prestation, le propriétaire du véhicule — puis le décompte complet
//     du bénéfice : prix de vente, coût d'acquisition ou part du showroom,
//     détail des dépenses engagées et bénéfice net mis en valeur.
//     `gain` est un enregistrement produit par cashApi.ledger().gains.
// ============================================================================
export function BeneficeSheet({ gain, showroom, lang = "fr" }) {
  const x = x2(lang);
  const ar = isAr(lang);
  const st = tableStyles(lang);
  const g = gain || {};
  const prestation = g.kind === "PRESTATION";
  const car = g.car || {};
  const buyer = g.client || {};
  const owner = g.owner || {};
  const expenses = Array.isArray(g.expensesList) ? g.expensesList : [];
  const positive = Number(g.gain || 0) >= 0;
  const gainColor = positive ? "#047857" : ACCENT;

  const person = (c) => `${c?.firstName || ""} ${c?.lastName || ""}`.trim() || "—";

  // Le décompte : les lignes qui mènent au bénéfice net, signées + / −.
  const lines = prestation
    ? [
        [x.salePrice, g.salePrice, null],
        [x.showroomShare, g.showroomShare, "+"],
        [x.expensesTotal, g.carExpenses, "−"],
        [x.ownerAmount, g.ownerAmount, null],
      ]
    : [
        [x.salePrice, g.salePrice, "+"],
        [x.purchasePrice, g.purchasePrice, "−"],
        [x.expensesTotal, g.carExpenses, "−"],
        [x.totalCostLabel, g.totalCost, null],
      ];

  return (
    <div style={sheetStyle(lang, true)}>
      <div>
        <Header showroom={showroom} lang={lang} />
        <TitleBar
          lang={lang}
          title={x.beneficeTitle}
          reference={g.reference || g.saleId}
          date={formatDateTime(g.date)}
          extra={prestation ? x.beneficePrestation : x.beneficeNormal}
        />

        {/* Véhicule + acheteur */}
        <div style={grid2}>
          <Frame title={x.vehicle}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 14px" }}>
              <Row lang={lang} label={x.brand} value={car.brand} strong />
              <Row lang={lang} label={x.model} value={car.model} strong />
              <Row lang={lang} label={x.plate} value={car.plate} />
              <Row lang={lang} label={x.year} value={car.year} />
              <Row lang={lang} label={x.color} value={car.color} />
              <Row lang={lang} label={x.mileage} value={car.mileage != null ? formatAmount(car.mileage, x.kmUnit) : "—"} />
            </div>
            <Row lang={lang} label={x.chassis} value={car.vin} last />
          </Frame>

          <Frame title={x.buyerBlock}>
            <Row lang={lang} label={x.fullName} value={person(buyer)} strong />
            <Row lang={lang} label={x.phone} value={buyer.phonePrimary} />
            <Row lang={lang} label={x.saleDateLabel} value={formatDate(g.date)} />
            <Row lang={lang} label={x.saleTypeLabel} value={prestation ? x.saleDeposit : x.saleNormal} />
            <Row lang={lang} label={x.collected} value={formatAmount(g.amountPaid)} />
            <Row lang={lang} label={x.restToPay} value={formatAmount(g.amountRest)} last />
          </Frame>
        </div>

        {/* Propriétaire (prestation uniquement) */}
        {prestation && (
          <div style={{ marginTop: 10 }}>
            <Frame title={x.ownerBlock}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 14px" }}>
                <Row lang={lang} label={x.fullName} value={person(owner)} strong />
                <Row lang={lang} label={x.phone} value={owner.phonePrimary} />
                <Row lang={lang} label={x.ownerAmount} value={formatAmount(g.ownerAmount)} strong />
                <Row lang={lang} label={x.settlementState} value={g.settled ? x.settlementDone : x.settlementPending} />
              </div>
            </Frame>
          </div>
        )}

        {/* Décompte du bénéfice */}
        <div style={{ marginTop: 10 }}>
          <Frame title={x.beneficeDetail}>
            {lines.map(([label, value, sign], i) => (
              <div
                key={i}
                style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  gap: 10, padding: "6px 0",
                  borderBottom: i === lines.length - 1 ? "none" : `1px dotted ${LINE}`,
                }}
              >
                <span style={{ color: sign ? INK : MUTE, fontSize: 12.5, fontWeight: sign ? 700 : 600 }}>
                  {sign ? `${sign}  ` : ""}{label}
                </span>
                <span style={{ fontWeight: 800, fontSize: 13.5, textAlign: ar ? "left" : "right", ...ltr }}>
                  {formatAmount(value)}
                </span>
              </div>
            ))}
          </Frame>
        </div>

        {/* Détail des dépenses engagées sur le véhicule */}
        <div style={{ marginTop: 10 }}>
          <Frame title={x.expensesList}>
            {expenses.length === 0 ? (
              <div style={{ color: MUTE, fontSize: 11.5, padding: "2px 0" }}>{x.noExpense}</div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
                <colgroup>
                  <col style={{ width: "52%" }} />
                  <col style={{ width: "23%" }} />
                  <col style={{ width: "25%" }} />
                </colgroup>
                <thead>
                  <tr>
                    <th style={st.th}>{x.colExpense}</th>
                    <th style={st.th}>{x.colExpenseDate}</th>
                    <th style={{ ...st.th, textAlign: st.end }}>{x.colExpenseAmount}</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((e, i) => (
                    <tr key={e.id ?? i} style={{ background: i % 2 ? SOFT : "#fff", ...exact }}>
                      <td style={st.td}>{dash(e.name)}</td>
                      <td style={{ ...st.td, whiteSpace: "nowrap", ...ltr, textAlign: st.start }}>{formatDate(e.date)}</td>
                      <td style={{ ...st.td, textAlign: st.end, fontWeight: 800, ...ltr }}>{formatAmount(e.amount)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td style={st.tf} colSpan={2}>{x.expensesTotal}</td>
                    <td style={{ ...st.tf, textAlign: st.end, ...ltr }}>{formatAmount(g.carExpenses)}</td>
                  </tr>
                </tbody>
              </table>
            )}
          </Frame>
        </div>
      </div>

      <div>
        {/* Bénéfice net — la ligne que ce document existe pour porter */}
        <div
          style={{
            marginTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center",
            gap: 14, borderRadius: 10, padding: "16px 22px",
            background: `linear-gradient(100deg, ${INK} 0%, #1f2937 60%, ${gainColor} 100%)`,
            color: "#fff", ...exact,
          }}
        >
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.14em", opacity: 0.85 }}>
              {x.beneficeNet}
            </div>
            <div style={{ fontSize: 10.5, opacity: 0.78, marginTop: 3 }}>
              {x.beneficeMargin} : <span style={ltr}>{(Number(g.margin) || 0).toFixed(1)} %</span>
            </div>
          </div>
          <div style={{ fontWeight: 900, fontSize: 30, whiteSpace: "nowrap", ...ltr }}>
            {positive ? "+ " : "− "}{formatAmount(Math.abs(Number(g.gain) || 0))}
          </div>
        </div>

        <div style={{ marginTop: 10, border: `1px dashed ${LINE}`, borderRadius: 6, padding: "7px 9px", fontSize: 10.5 }}>
          <span style={{ fontWeight: 800, color: INK }}>{x.stopSumBenefice} </span>
          <span style={{ fontWeight: 700 }}>{numberToWords(Math.abs(Number(g.gain) || 0), lang)}</span>
        </div>

        <div style={{ marginTop: 7, fontSize: 10, color: MUTE, lineHeight: 1.45 }}>
          {prestation ? x.beneficeNotePrestation : x.beneficeNoteNormal}
        </div>

        <Signatures left={x.sigAccounting} right={x.sigShowroom} />
        <Footer showroom={showroom} lang={lang} />
      </div>
    </div>
  );
}
