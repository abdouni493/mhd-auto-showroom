/**
 * Vercel serverless function — Brevo transactional email proxy.
 *
 * The browser posts { to, toName, subject, html, senderEmail, senderName } here
 * and this function forwards it to Brevo with the API key, so the key is never
 * shipped to the client and the browser never hits a cross-origin API.
 *
 * Configure the key in Vercel → Settings → Environment Variables:
 *   BREVO_API_KEY      (falls back to the key below)
 *   BREVO_SENDER_EMAIL (default: icarmhd@gmail.com)
 *   BREVO_SENDER_NAME  (default: mhd showroom)
 */

const DEFAULT_API_KEY = process.env.BREVO_API_KEY || "";
const DEFAULT_SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || "icarmhd@gmail.com";
const DEFAULT_SENDER_NAME = process.env.BREVO_SENDER_NAME || "mhd showroom";

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Allow", "POST, OPTIONS");
    return res.status(204).end();
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body =
      typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const { to, toName, subject, html, senderEmail, senderName, replyTo } = body;

    if (!to || !html) {
      return res.status(400).json({ error: "Champs requis manquants : to, html." });
    }

    const apiKey = process.env.BREVO_API_KEY || DEFAULT_API_KEY;
    const sender = {
      email: senderEmail || process.env.BREVO_SENDER_EMAIL || DEFAULT_SENDER_EMAIL,
      name: senderName || process.env.BREVO_SENDER_NAME || DEFAULT_SENDER_NAME,
    };

    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        sender,
        to: [{ email: to, name: toName || to }],
        ...(replyTo ? { replyTo: { email: replyTo } } : {}),
        subject: subject || "Documents",
        htmlContent: html,
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return res.status(response.status).json({
        error:
          data?.message ||
          `Brevo a refusé l'envoi (${response.status}). Vérifiez la clé API et l'expéditeur vérifié.`,
        code: data?.code,
      });
    }

    return res.status(200).json({ messageId: data?.messageId || null });
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Erreur serveur lors de l'envoi." });
  }
};
