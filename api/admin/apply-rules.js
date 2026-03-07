const { sendJson, readJsonBody } = require("../_lib/http");
const { isAuthenticated } = require("../_lib/auth");
const { readSchedule, writeSchedule, applyRulesToDays } = require("../_lib/schedule-store");

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
  const rules = Array.isArray(payload.rules) ? payload.rules : current.rules;
  const sourceDays = payload && payload.days && typeof payload.days === "object" ? payload.days : current.days;
  const nextDays = applyRulesToDays(sourceDays, rules);

  const saved = await writeSchedule({
    days: nextDays,
    rules,
    outlookIcsUrl: current.outlookIcsUrl
  });

  return sendJson(res, 200, {
    ok: true,
    days: saved.days,
    rules: saved.rules,
    outlookIcsUrl: saved.outlookIcsUrl || ""
  });
};
