const { sendJson } = require("../_lib/http");
const { isAuthConfigured, isAuthenticated } = require("../_lib/auth");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return sendJson(res, 405, { error: "method_not_allowed" });
  }

  return sendJson(res, 200, {
    authenticated: isAuthenticated(req),
    configured: isAuthConfigured()
  });
};
