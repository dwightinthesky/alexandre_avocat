const { sendJson, readJsonBody } = require("./_lib/http");
const { isAuthenticated } = require("./_lib/auth");
const { readSchedule, writeSchedule } = require("./_lib/schedule-store");

module.exports = async function handler(req, res) {
  if (req.method === "GET") {
    const schedule = await readSchedule();
    return sendJson(res, 200, {
      timezone: schedule.timezone,
      slotDurationMinutes: schedule.slotDurationMinutes,
      days: schedule.days
    });
  }

  if (req.method === "PUT") {
    if (!isAuthenticated(req)) {
      return sendJson(res, 401, { error: "unauthorized" });
    }

    let payload = {};
    try {
      payload = await readJsonBody(req);
    } catch (error) {
      return sendJson(res, 400, { error: "invalid_json" });
    }

    if (!payload || typeof payload.days !== "object") {
      return sendJson(res, 400, { error: "invalid_payload" });
    }

    const next = await writeSchedule({ days: payload.days });
    return sendJson(res, 200, {
      ok: true,
      timezone: next.timezone,
      slotDurationMinutes: next.slotDurationMinutes,
      days: next.days
    });
  }

  return sendJson(res, 405, { error: "method_not_allowed" });
};
