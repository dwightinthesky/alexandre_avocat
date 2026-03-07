const { sendJson, readJsonBody } = require("../_lib/http");
const { isAuthenticated } = require("../_lib/auth");
const { readSchedule, writeSchedule, normalizeRules } = require("../_lib/schedule-store");
const { syncOutlookWithSchedule } = require("../_lib/outlook-sync");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "method_not_allowed" });
  }

  if (!isAuthenticated(req)) {
    return sendJson(res, 401, { error: "unauthorized" });
  }

  let payload = {};
  try {
    payload = await readJsonBody(req);
  } catch (error) {
    return sendJson(res, 400, { error: "invalid_json" });
  }

  const current = await readSchedule();
  const sourceSchedule = {
    ...current,
    days: payload && payload.days && typeof payload.days === "object" ? payload.days : current.days,
    rules: payload && Array.isArray(payload.rules) ? normalizeRules(payload.rules) : current.rules
  };

  try {
    const synced = await syncOutlookWithSchedule(sourceSchedule, payload.icsUrl || current.outlookIcsUrl);
    const saved = await writeSchedule({
      days: synced.days,
      rules: sourceSchedule.rules,
      outlookIcsUrl: synced.sourceUrl
    });

    return sendJson(res, 200, {
      ok: true,
      eventCount: synced.eventCount,
      blockedSlots: synced.blockedSlots,
      days: saved.days,
      rules: saved.rules,
      outlookIcsUrl: saved.outlookIcsUrl || ""
    });
  } catch (error) {
    return sendJson(res, 400, {
      error: "sync_failed",
      message:
        error && error.message === "missing_ics_url"
          ? "Outlook ICS URL missing."
          : "Unable to sync Outlook calendar."
    });
  }
};
