const { sendJson, readJsonBody } = require("../_lib/http");
const { isAuthenticated } = require("../_lib/auth");
const { readSchedule, writeSchedule } = require("../_lib/schedule-store");

module.exports = async function handler(req, res) {
  if (!isAuthenticated(req)) {
    return sendJson(res, 401, { error: "unauthorized" });
  }

  if (req.method === "GET") {
    const schedule = await readSchedule();
    return sendJson(res, 200, {
      timezone: schedule.timezone,
      slotDurationMinutes: schedule.slotDurationMinutes,
      days: schedule.days,
      rules: schedule.rules,
      outlookIcsUrl: schedule.outlookIcsUrl || ""
    });
  }

  if (req.method === "PUT") {
    let payload = {};
    try {
      payload = await readJsonBody(req);
    } catch (error) {
      return sendJson(res, 400, { error: "invalid_json" });
    }

    const current = await readSchedule();
    const next = await writeSchedule({
      days: payload && payload.days && typeof payload.days === "object" ? payload.days : current.days,
      rules: payload && Array.isArray(payload.rules) ? payload.rules : current.rules,
      outlookIcsUrl:
        payload && Object.prototype.hasOwnProperty.call(payload, "outlookIcsUrl")
          ? payload.outlookIcsUrl
          : current.outlookIcsUrl
    });

    return sendJson(res, 200, {
      ok: true,
      timezone: next.timezone,
      slotDurationMinutes: next.slotDurationMinutes,
      days: next.days,
      rules: next.rules,
      outlookIcsUrl: next.outlookIcsUrl || ""
    });
  }

  return sendJson(res, 405, { error: "method_not_allowed" });
};
