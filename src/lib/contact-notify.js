const DEFAULT_NOTIFICATION_TO = "cabinet@amartinez-avocat.fr";
const DEFAULT_FROM_EMAIL = "cabinet@amartinez-avocat.fr";
const DEFAULT_FROM_NAME = "Cabinet Alexandre MARTINEZ";
const DEFAULT_MAILCHANNELS_ENDPOINT = "https://api.mailchannels.net/tx/v1/send";

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeValue(value) {
  return String(value || "").trim();
}

function normalizePreferredContact(value) {
  const normalized = normalizeValue(value).toLowerCase();
  return normalized === "phone" ? "phone" : "email";
}

export function normalizeContactPayload(body) {
  return {
    name: normalizeValue(body && body.name),
    phone: normalizeValue(body && body.phone),
    email: normalizeValue(body && body.email),
    message: normalizeValue(body && body.message),
    preferred_contact: normalizePreferredContact(body && body.preferred_contact)
  };
}

export function isContactPayloadValid(payload) {
  return Boolean(
    payload &&
      payload.name &&
      payload.phone &&
      payload.email &&
      payload.message &&
      payload.preferred_contact
  );
}

function formatPreferredContact(preferredContact, language) {
  const isPhone = preferredContact === "phone";
  if (language === "fr") {
    return isPhone ? "Téléphone" : "E-mail";
  }
  return isPhone ? "Phone" : "Email";
}

function buildNotificationContent(payload, submittedAt) {
  const submittedDate = submittedAt.toLocaleString("fr-FR", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Europe/Paris"
  });
  const preferredFr = formatPreferredContact(payload.preferred_contact, "fr");
  const preferredEn = formatPreferredContact(payload.preferred_contact, "en");

  const subject = `Nouvelle demande de contact / New contact request - ${payload.name}`;

  const text = [
    "FRANCAIS",
    "",
    "Une nouvelle demande de contact a ete envoyee via le site.",
    `Date de soumission : ${submittedDate}`,
    `Nom : ${payload.name}`,
    `Telephone : ${payload.phone}`,
    `E-mail : ${payload.email}`,
    `Moyen de contact prefere : ${preferredFr}`,
    "Message :",
    payload.message,
    "",
    "ENGLISH",
    "",
    "A new contact request has been submitted through the website.",
    `Submitted at: ${submittedDate}`,
    `Name: ${payload.name}`,
    `Phone: ${payload.phone}`,
    `Email: ${payload.email}`,
    `Preferred contact method: ${preferredEn}`,
    "Message:",
    payload.message
  ].join("\n");

  const html = `
    <div style="font-family:Arial,sans-serif;color:#1f1f1f;line-height:1.6">
      <h2 style="margin:0 0 12px">Nouvelle demande de contact</h2>
      <p style="margin:0 0 16px">Une nouvelle demande de contact a ete envoyee via le site.</p>
      <table style="border-collapse:collapse;width:100%;margin-bottom:20px">
        <tr><td style="padding:6px 0;font-weight:700">Date de soumission</td><td style="padding:6px 0">${escapeHtml(submittedDate)}</td></tr>
        <tr><td style="padding:6px 0;font-weight:700">Nom</td><td style="padding:6px 0">${escapeHtml(payload.name)}</td></tr>
        <tr><td style="padding:6px 0;font-weight:700">Telephone</td><td style="padding:6px 0">${escapeHtml(payload.phone)}</td></tr>
        <tr><td style="padding:6px 0;font-weight:700">E-mail</td><td style="padding:6px 0">${escapeHtml(payload.email)}</td></tr>
        <tr><td style="padding:6px 0;font-weight:700">Contact prefere</td><td style="padding:6px 0">${escapeHtml(preferredFr)}</td></tr>
      </table>
      <p style="margin:0 0 8px;font-weight:700">Message</p>
      <p style="margin:0 0 28px;white-space:pre-wrap">${escapeHtml(payload.message)}</p>

      <hr style="border:none;border-top:1px solid #d9d9d9;margin:0 0 20px" />

      <h2 style="margin:0 0 12px">New contact request</h2>
      <p style="margin:0 0 16px">A new contact request has been submitted through the website.</p>
      <table style="border-collapse:collapse;width:100%;margin-bottom:20px">
        <tr><td style="padding:6px 0;font-weight:700">Submitted at</td><td style="padding:6px 0">${escapeHtml(submittedDate)}</td></tr>
        <tr><td style="padding:6px 0;font-weight:700">Name</td><td style="padding:6px 0">${escapeHtml(payload.name)}</td></tr>
        <tr><td style="padding:6px 0;font-weight:700">Phone</td><td style="padding:6px 0">${escapeHtml(payload.phone)}</td></tr>
        <tr><td style="padding:6px 0;font-weight:700">Email</td><td style="padding:6px 0">${escapeHtml(payload.email)}</td></tr>
        <tr><td style="padding:6px 0;font-weight:700">Preferred contact method</td><td style="padding:6px 0">${escapeHtml(preferredEn)}</td></tr>
      </table>
      <p style="margin:0 0 8px;font-weight:700">Message</p>
      <p style="margin:0;white-space:pre-wrap">${escapeHtml(payload.message)}</p>
    </div>
  `.trim();

  return { subject, text, html };
}

function buildMailConfig(env) {
  return {
    to: normalizeValue(env.CONTACT_NOTIFICATION_TO) || DEFAULT_NOTIFICATION_TO,
    fromEmail: normalizeValue(env.CONTACT_FROM_EMAIL) || DEFAULT_FROM_EMAIL,
    fromName: normalizeValue(env.CONTACT_FROM_NAME) || DEFAULT_FROM_NAME,
    resendApiKey: normalizeValue(env.RESEND_API_KEY),
    mailchannelsEndpoint: normalizeValue(env.MAILCHANNELS_ENDPOINT) || DEFAULT_MAILCHANNELS_ENDPOINT
  };
}

async function sendViaResend(config, message, replyTo) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.resendApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: `${config.fromName} <${config.fromEmail}>`,
      to: [config.to],
      reply_to: replyTo,
      subject: message.subject,
      text: message.text,
      html: message.html
    })
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`resend_failed:${response.status}:${details}`);
  }

  return "resend";
}

async function sendViaMailChannels(config, message, payload) {
  const response = await fetch(config.mailchannelsEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      personalizations: [
        {
          to: [{ email: config.to, name: config.fromName }]
        }
      ],
      from: {
        email: config.fromEmail,
        name: config.fromName
      },
      reply_to: {
        email: payload.email,
        name: payload.name
      },
      subject: message.subject,
      content: [
        {
          type: "text/plain",
          value: message.text
        },
        {
          type: "text/html",
          value: message.html
        }
      ]
    })
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`mailchannels_failed:${response.status}:${details}`);
  }

  return "mailchannels";
}

export async function sendContactNotification(env, payload) {
  const config = buildMailConfig(env);
  const submittedAt = new Date();
  const message = buildNotificationContent(payload, submittedAt);

  if (config.resendApiKey) {
    const provider = await sendViaResend(config, message, payload.email);
    return { provider, submittedAt: submittedAt.toISOString() };
  }

  const provider = await sendViaMailChannels(config, message, payload);
  return { provider, submittedAt: submittedAt.toISOString() };
}
