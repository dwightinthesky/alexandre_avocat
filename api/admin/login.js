const { readJsonBody, sendJson } = require("../_lib/http");
const { isAuthConfigured, validateCredentials, setSessionCookie } = require("../_lib/auth");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "method_not_allowed" });
  }

  if (!isAuthConfigured()) {
    return sendJson(res, 500, {
      error: "auth_not_configured",
      message: "Set SCHEDULE_ADMIN_USERNAME, SCHEDULE_ADMIN_PASSWORD and SCHEDULE_AUTH_SECRET."
    });
  }

  let payload = {};
  try {
    payload = await readJsonBody(req);
  } catch (error) {
    return sendJson(res, 400, { error: "invalid_json" });
  }

  const username = String(payload.username || "").trim();
  const password = String(payload.password || "");

  if (!validateCredentials(username, password)) {
    return sendJson(res, 401, { error: "invalid_credentials" });
  }

  setSessionCookie(res);
  return sendJson(res, 200, { ok: true });
};
