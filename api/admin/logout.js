const { sendJson } = require("../_lib/http");
const { clearSessionCookie } = require("../_lib/auth");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "method_not_allowed" });
  }

  clearSessionCookie(res);
  return sendJson(res, 200, { ok: true });
};
