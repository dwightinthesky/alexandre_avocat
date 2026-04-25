import { jsonResponse, readJsonBody, addSecurityHeaders } from "../../src/lib/http.js";
import {
  isAuthConfigured,
  validateCredentials,
  createSessionCookie,
  clearSessionCookie,
  isAuthenticated
} from "../../src/lib/auth.js";
import {
  readSchedule,
  writeSchedule,
  reserveSlot,
  normalizeRules,
  applyRulesToDays
} from "../../src/lib/schedule-store.js";
import { syncOutlookWithSchedule } from "../../src/lib/outlook-sync.js";
import {
  normalizeContactPayload,
  isContactPayloadValid,
  sendContactNotification
} from "../../src/lib/contact-notify.js";

function methodNotAllowed() {
  return jsonResponse(405, { error: "method_not_allowed" });
}

function getContactErrorResponse(error) {
  const code = error && typeof error === "object" ? error.code : "";

  if (code === "email_provider_not_configured") {
    return jsonResponse(500, {
      error: code,
      message: "Email provider not configured. Add CONTACT_EMAIL, RESEND_API_KEY, or MAILCHANNELS_API_KEY."
    });
  }

  if (code === "mailchannels_auth_failed") {
    return jsonResponse(502, {
      error: code,
      message: "MailChannels authentication failed. Set MAILCHANNELS_API_KEY or switch to another provider."
    });
  }

  if (code === "resend_failed") {
    return jsonResponse(502, {
      error: code,
      message: "Resend rejected the email. Check RESEND_API_KEY and sender domain verification."
    });
  }

  if (code === "cloudflare_send_failed") {
    return jsonResponse(502, {
      error: code,
      message: "Cloudflare email sending failed. Check the CONTACT_EMAIL binding and verified sender address."
    });
  }

  return jsonResponse(502, {
    error: "notification_failed",
    message: "Unable to send contact notification."
  });
}

function isSecureRequest(request) {
  const url = new URL(request.url);
  if (url.protocol === "https:") return true;
  return String(request.headers.get("x-forwarded-proto") || "").toLowerCase() === "https";
}

async function handleSchedule(request, env) {
  if (request.method === "GET") {
    const schedule = await readSchedule(env);
    return jsonResponse(200, {
      timezone: schedule.timezone,
      slotDurationMinutes: schedule.slotDurationMinutes,
      days: schedule.days
    });
  }

  if (request.method === "PUT") {
    if (!(await isAuthenticated(request, env))) {
      return jsonResponse(401, { error: "unauthorized" });
    }

    let payload = {};
    try {
      payload = await readJsonBody(request);
    } catch {
      return jsonResponse(400, { error: "invalid_json" });
    }

    if (!payload || typeof payload.days !== "object") {
      return jsonResponse(400, { error: "invalid_payload" });
    }

    const current = await readSchedule(env);
    const next = await writeSchedule(env, {
      days: payload.days,
      rules: current.rules,
      outlookIcsUrl: current.outlookIcsUrl
    });

    return jsonResponse(200, {
      ok: true,
      timezone: next.timezone,
      slotDurationMinutes: next.slotDurationMinutes,
      days: next.days
    });
  }

  return methodNotAllowed();
}

async function handleScheduleBook(request, env) {
  if (request.method !== "POST") {
    return methodNotAllowed();
  }

  let payload = {};
  try {
    payload = await readJsonBody(request);
  } catch {
    return jsonResponse(400, { error: "invalid_json" });
  }

  const date = String(payload.date || "").trim();
  const time = String(payload.time || "").trim();
  const result = await reserveSlot(env, date, time);

  if (!result.ok) {
    const statusCode = result.reason === "slot_unavailable" ? 409 : 400;
    return jsonResponse(statusCode, {
      ok: false,
      error: result.reason,
      days: result.schedule.days
    });
  }

  return jsonResponse(200, {
    ok: true,
    days: result.schedule.days
  });
}

async function handleAdminSession(request, env) {
  if (request.method !== "GET") {
    return methodNotAllowed();
  }

  return jsonResponse(200, {
    authenticated: await isAuthenticated(request, env),
    configured: isAuthConfigured(env)
  });
}

async function handleAdminLogin(request, env) {
  if (request.method !== "POST") {
    return methodNotAllowed();
  }

  if (!isAuthConfigured(env)) {
    return jsonResponse(500, {
      error: "auth_not_configured",
      message: "Set SCHEDULE_ADMIN_USERNAME, SCHEDULE_ADMIN_PASSWORD and SCHEDULE_AUTH_SECRET."
    });
  }

  let payload = {};
  try {
    payload = await readJsonBody(request);
  } catch {
    return jsonResponse(400, { error: "invalid_json" });
  }

  const username = String(payload.username || "").trim();
  const password = String(payload.password || "");

  if (!validateCredentials(env, username, password)) {
    return jsonResponse(401, { error: "invalid_credentials" });
  }

  return jsonResponse(
    200,
    { ok: true },
    {
      "Set-Cookie": await createSessionCookie(env, isSecureRequest(request))
    }
  );
}

async function handleAdminLogout(request) {
  if (request.method !== "POST") {
    return methodNotAllowed();
  }

  return jsonResponse(
    200,
    { ok: true },
    {
      "Set-Cookie": clearSessionCookie(isSecureRequest(request))
    }
  );
}

async function handleAdminSchedule(request, env) {
  if (!(await isAuthenticated(request, env))) {
    return jsonResponse(401, { error: "unauthorized" });
  }

  if (request.method === "GET") {
    const schedule = await readSchedule(env);
    return jsonResponse(200, {
      timezone: schedule.timezone,
      slotDurationMinutes: schedule.slotDurationMinutes,
      days: schedule.days,
      rules: schedule.rules,
      outlookIcsUrl: schedule.outlookIcsUrl || ""
    });
  }

  if (request.method === "PUT") {
    let payload = {};
    try {
      payload = await readJsonBody(request);
    } catch {
      return jsonResponse(400, { error: "invalid_json" });
    }

    const current = await readSchedule(env);
    const next = await writeSchedule(env, {
      days: payload && payload.days && typeof payload.days === "object" ? payload.days : current.days,
      rules: payload && Array.isArray(payload.rules) ? payload.rules : current.rules,
      outlookIcsUrl:
        payload && Object.prototype.hasOwnProperty.call(payload, "outlookIcsUrl")
          ? payload.outlookIcsUrl
          : current.outlookIcsUrl
    });

    return jsonResponse(200, {
      ok: true,
      timezone: next.timezone,
      slotDurationMinutes: next.slotDurationMinutes,
      days: next.days,
      rules: next.rules,
      outlookIcsUrl: next.outlookIcsUrl || ""
    });
  }

  return methodNotAllowed();
}

async function handleAdminOutlookSync(request, env) {
  if (request.method !== "POST") {
    return methodNotAllowed();
  }

  if (!(await isAuthenticated(request, env))) {
    return jsonResponse(401, { error: "unauthorized" });
  }

  let payload = {};
  try {
    payload = await readJsonBody(request);
  } catch {
    return jsonResponse(400, { error: "invalid_json" });
  }

  const current = await readSchedule(env);
  const sourceSchedule = {
    ...current,
    days: payload && payload.days && typeof payload.days === "object" ? payload.days : current.days,
    rules: payload && Array.isArray(payload.rules) ? normalizeRules(payload.rules) : current.rules
  };

  try {
    const synced = await syncOutlookWithSchedule(sourceSchedule, payload.icsUrl || current.outlookIcsUrl, env);
    const saved = await writeSchedule(env, {
      days: synced.days,
      rules: sourceSchedule.rules,
      outlookIcsUrl: synced.sourceUrl
    });

    return jsonResponse(200, {
      ok: true,
      eventCount: synced.eventCount,
      blockedSlots: synced.blockedSlots,
      days: saved.days,
      rules: saved.rules,
      outlookIcsUrl: saved.outlookIcsUrl || ""
    });
  } catch (error) {
    return jsonResponse(400, {
      error: "sync_failed",
      message:
        error && error.message === "missing_ics_url"
          ? "Outlook ICS URL missing."
          : "Unable to sync Outlook calendar."
    });
  }
}

async function handleAdminApplyRules(request, env) {
  if (request.method !== "POST") {
    return methodNotAllowed();
  }

  if (!(await isAuthenticated(request, env))) {
    return jsonResponse(401, { error: "unauthorized" });
  }

  let payload = {};
  try {
    payload = await readJsonBody(request);
  } catch {
    return jsonResponse(400, { error: "invalid_json" });
  }

  const current = await readSchedule(env);
  const rules = Array.isArray(payload.rules) ? payload.rules : current.rules;
  const sourceDays = payload && payload.days && typeof payload.days === "object" ? payload.days : current.days;
  const nextDays = applyRulesToDays(sourceDays, rules);

  const saved = await writeSchedule(env, {
    days: nextDays,
    rules,
    outlookIcsUrl: current.outlookIcsUrl
  });

  return jsonResponse(200, {
    ok: true,
    days: saved.days,
    rules: saved.rules,
    outlookIcsUrl: saved.outlookIcsUrl || ""
  });
}

async function handleContact(request, env) {
  if (request.method !== "POST") {
    return methodNotAllowed();
  }

  const body = await readJsonBody(request).catch(() => null);
  if (!body) {
    return jsonResponse(400, { error: "invalid_body" });
  }

  const payload = normalizeContactPayload(body);
  if (!isContactPayloadValid(payload)) {
    return jsonResponse(400, { error: "missing_fields" });
  }

  let notification = null;
  try {
    notification = await sendContactNotification(env, payload);
  } catch (error) {
    if (env.SCHEDULE_STORE) {
      const failedKey = `contact:${Date.now()}:${Math.random().toString(36).slice(2, 7)}`;
      await env.SCHEDULE_STORE.put(
        failedKey,
        JSON.stringify({
          ...payload,
          submittedAt: new Date().toISOString(),
          notificationStatus: "failed",
          notificationError: error instanceof Error ? error.message : "unknown_error"
        }),
        { expirationTtl: 60 * 60 * 24 * 180 }
      );
    }

    return getContactErrorResponse(error);
  }

  if (env.SCHEDULE_STORE) {
    const key = `contact:${Date.now()}:${Math.random().toString(36).slice(2, 7)}`;
    await env.SCHEDULE_STORE.put(
      key,
      JSON.stringify({
        ...payload,
        submittedAt: notification ? notification.submittedAt : new Date().toISOString(),
        notificationStatus: "sent",
        notificationProvider: notification ? notification.provider : ""
      }),
      { expirationTtl: 60 * 60 * 24 * 180 }
    );
  }

  return jsonResponse(200, {
    ok: true,
    notificationProvider: notification ? notification.provider : ""
  });
}

const API_ROUTES = {
  "/api/contact": handleContact,
  "/api/schedule": handleSchedule,
  "/api/schedule/book": handleScheduleBook,
  "/api/admin/session": handleAdminSession,
  "/api/admin/login": handleAdminLogin,
  "/api/admin/logout": handleAdminLogout,
  "/api/admin/schedule": handleAdminSchedule,
  "/api/admin/outlook-sync": handleAdminOutlookSync,
  "/api/admin/apply-rules": handleAdminApplyRules
};

export async function onRequest(context) {
  try {
    const { request, env } = context;
    const url = new URL(request.url);
    const apiHandler = API_ROUTES[url.pathname];

    if (!apiHandler) {
      return addSecurityHeaders(jsonResponse(404, { error: "not_found" }));
    }

    const response = await apiHandler(request, env);
    return addSecurityHeaders(response);
  } catch {
    return addSecurityHeaders(jsonResponse(500, { error: "internal_error" }));
  }
}
