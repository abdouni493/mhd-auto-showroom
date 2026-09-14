import { renderToStaticMarkup } from "react-dom/server";
import { supabase } from "./supabase.js";

/* ============================================================================
 * Sending the printable documents of a sale / purchase to the client by email.
 *
 * Transport : Brevo (ex-Sendinblue) transactional email.
 *   - In production the request goes through /api/send-email (Vercel function)
 *     so the API key never reaches the browser.
 *   - If that route is not available (local `vite dev`), the browser can call
 *     Brevo directly, but only when VITE_BREVO_API_KEY is set locally.
 *
 * The documents are the very same React print templates used by the printer:
 * they are rendered to static HTML and stacked in the message body, so what the
 * client receives is what the showroom prints.
 * ========================================================================== */

export const BREVO = {
  // The real key lives ONLY in the serverless function (api/send-email.js) so it
  // is never shipped to the browser. For a local `vite dev` run, put it in
  // frontend/.env as VITE_BREVO_API_KEY to exercise the direct fallback below.
  apiKey: import.meta.env?.VITE_BREVO_API_KEY || "",
  senderEmail: "icarmhd@gmail.com",
  senderName: "altech showroom",
  endpoint: "https://api.brevo.com/v3/smtp/email",
};

// ── Build the message body ─────────────────────────────────────────────────
// Each document keeps its own A4 sheet look, separated by a thin rule.
export function renderDocsToHtml(docs, keys, lang, { title } = {}) {
  const selected = docs.filter((d) => keys.includes(d.key));
  const sheets = selected
    .map((doc) => {
      const markup = renderToStaticMarkup(doc.render(lang, doc.emailOptions || {}));
      return `
        <tr><td style="padding:0 0 26px 0;">
          <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:10px;padding:18px;">
            ${markup}
          </div>
        </td></tr>`;
    })
    .join("");

  const dir = lang === "ar" ? "rtl" : "ltr";
  return `<!doctype html>
<html dir="${dir}" lang="${lang}">
  <body style="margin:0;padding:22px 12px;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:860px;margin:0 auto;">
      ${title ? `<tr><td style="padding:0 0 16px 0;font-size:13px;color:#6b7280;">${title}</td></tr>` : ""}
      ${sheets}
    </table>
  </body>
</html>`;
}

export function documentLabels(docs, keys) {
  return docs.filter((d) => keys.includes(d.key)).map((d) => d.label);
}

// ── Transport ───────────────────────────────────────────────────────────────
async function sendViaProxy(payload) {
  const res = await fetch("/api/send-email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  // The serverless function does not exist when running `vite dev`: the dev
  // server answers the SPA fallback (index.html) with a 200 + text/html.
  const type = res.headers.get("content-type") || "";
  if (res.status === 404 || !type.includes("application/json")) {
    return { unavailable: true };
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || `Erreur d'envoi (${res.status})`);
  return { messageId: data?.messageId || null };
}

async function sendDirect({ to, toName, subject, html, senderEmail, senderName, replyTo }) {
  if (!BREVO.apiKey) {
    throw new Error(
      "Envoi indisponible ici : la fonction /api/send-email n'est pas accessible. " +
        "Déployez l'application (Vercel) ou ajoutez VITE_BREVO_API_KEY dans frontend/.env pour tester en local."
    );
  }
  const res = await fetch(BREVO.endpoint, {
    method: "POST",
    headers: {
      "api-key": BREVO.apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      sender: { email: senderEmail || BREVO.senderEmail, name: senderName || BREVO.senderName },
      to: [{ email: to, name: toName || to }],
      replyTo: replyTo ? { email: replyTo } : undefined,
      subject,
      htmlContent: html,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.message || `Brevo: envoi refusé (${res.status})`);
  }
  return { messageId: data?.messageId || null };
}

/**
 * Send one email carrying the selected documents.
 * Returns { messageId }. Throws with a readable message on failure.
 */
export async function sendDocumentsEmail({
  to,
  toName,
  subject,
  html,
  lang = "fr",
  templates = [],
  saleId = null,
  purchaseId = null,
  clientId = null,
  senderEmail,
  senderName,
  replyTo,
}) {
  if (!to) throw new Error("Adresse email du client manquante.");

  const payload = { to, toName, subject, html, senderEmail, senderName, replyTo };
  let result;
  try {
    result = await sendViaProxy(payload);
    if (result.unavailable) result = await sendDirect(payload);
    await logEmail({ to, subject, templates, lang, saleId, purchaseId, clientId, status: "SENT", providerId: result.messageId });
    return result;
  } catch (e) {
    await logEmail({
      to, subject, templates, lang, saleId, purchaseId, clientId,
      status: "FAILED", error: e?.message || String(e),
    });
    throw e;
  }
}

async function logEmail({ to, subject, templates, lang, saleId, purchaseId, clientId, status, error, providerId }) {
  try {
    await supabase.from("email_logs").insert({
      sale_id: saleId,
      purchase_id: purchaseId,
      client_id: clientId,
      to_email: to,
      subject,
      templates,
      lang,
      status,
      error: error || null,
      provider_id: providerId || null,
    });
  } catch {
    /* logging must never break the send */
  }
}

/** History of the emails sent for one sale (shown on the Ventes detail). */
export async function emailHistory({ saleId }) {
  const { data } = await supabase
    .from("email_logs")
    .select("*")
    .eq("sale_id", saleId)
    .order("sent_at", { ascending: false });
  return data || [];
}
