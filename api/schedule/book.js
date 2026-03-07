const { sendJson, readJsonBody } = require("../_lib/http");
const { reserveSlot } = require("../_lib/schedule-store");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "method_not_allowed" });
  }

  let payload = {};
  try {
    payload = await readJsonBody(req);
  } catch (error) {
    return sendJson(res, 400, { error: "invalid_json" });
  }

  const date = String(payload.date || "").trim();
  const time = String(payload.time || "").trim();
  const result = await reserveSlot(date, time);

  if (!result.ok) {
    const statusCode = result.reason === "slot_unavailable" ? 409 : 400;
    return sendJson(res, statusCode, {
      ok: false,
      error: result.reason,
      days: result.schedule.days
    });
  }

  return sendJson(res, 200, {
    ok: true,
    days: result.schedule.days
  });
};
