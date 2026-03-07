const crypto = require("crypto");

const COOKIE_NAME = "aa_admin_session";
const SESSION_TTL_SECONDS = 60 * 60 * 12;

function parseCookies(cookieHeader) {
  const source = String(cookieHeader || "");
  if (!source) return {};

  return source.split(";").reduce((acc, item) => {
    const [rawKey, ...rest] = item.trim().split("=");
    if (!rawKey) return acc;
    acc[rawKey] = decodeURIComponent(rest.join("="));
    return acc;
  }, {});
}

function getAdminUsername() {
  return String(process.env.SCHEDULE_ADMIN_USERNAME || "").trim();
}

function getAdminPassword() {
  return String(process.env.SCHEDULE_ADMIN_PASSWORD || "");
}

function getAuthSecret() {
  return String(process.env.SCHEDULE_AUTH_SECRET || "");
}

function isAuthConfigured() {
  return Boolean(getAdminUsername() && getAdminPassword() && getAuthSecret());
}

function signTokenPart(value) {
  const secret = getAuthSecret();
  return crypto.createHmac("sha256", secret).update(value).digest("base64url");
}

function createSessionToken() {
  const payload = {
    sub: "admin",
    exp: Date.now() + SESSION_TTL_SECONDS * 1000
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = signTokenPart(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

function getSession(req) {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[COOKIE_NAME];
  if (!token) return null;

  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return null;

  const expectedSignature = signTokenPart(encodedPayload);
  const incoming = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);
  if (incoming.length !== expected.length || !crypto.timingSafeEqual(incoming, expected)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
    if (!payload || payload.exp <= Date.now()) return null;
    return payload;
  } catch (error) {
    return null;
  }
}

function isAuthenticated(req) {
  return Boolean(getSession(req));
}

function buildCookie(value, maxAge) {
  const attrs = [
    `${COOKIE_NAME}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    `Max-Age=${maxAge}`
  ];

  if (process.env.NODE_ENV === "production") {
    attrs.push("Secure");
  }

  return attrs.join("; ");
}

function setSessionCookie(res) {
  res.setHeader("Set-Cookie", buildCookie(createSessionToken(), SESSION_TTL_SECONDS));
}

function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", buildCookie("", 0));
}

function validateCredentials(username, password) {
  if (!isAuthConfigured()) return false;
  return username === getAdminUsername() && password === getAdminPassword();
}

module.exports = {
  isAuthConfigured,
  isAuthenticated,
  validateCredentials,
  setSessionCookie,
  clearSessionCookie
};
