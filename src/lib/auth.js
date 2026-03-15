const COOKIE_NAME = "aa_admin_session";
const SESSION_TTL_SECONDS = 60 * 60 * 12;

function utf8Encode(value) {
  return new TextEncoder().encode(String(value || ""));
}

function bytesToBase64(bytes) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function toBase64Url(bytes) {
  return bytesToBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value) {
  const source = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  const padded = `${source}${"=".repeat((4 - (source.length % 4)) % 4)}`;
  return base64ToBytes(padded);
}

function safeEqual(a, b) {
  const left = String(a || "");
  const right = String(b || "");
  if (left.length !== right.length) return false;

  let mismatch = 0;
  for (let i = 0; i < left.length; i += 1) {
    mismatch |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return mismatch === 0;
}

function parseCookies(request) {
  const raw = request.headers.get("Cookie") || "";
  if (!raw) return {};

  return raw.split(";").reduce((acc, item) => {
    const [rawKey, ...rest] = item.trim().split("=");
    if (!rawKey) return acc;
    acc[rawKey] = decodeURIComponent(rest.join("="));
    return acc;
  }, {});
}

function getAdminUsername(env) {
  return String(env.SCHEDULE_ADMIN_USERNAME || "").trim();
}

function getAdminPassword(env) {
  return String(env.SCHEDULE_ADMIN_PASSWORD || "");
}

function getAuthSecret(env) {
  return String(env.SCHEDULE_AUTH_SECRET || "");
}

function createCookieHeader(value, maxAge, secure) {
  const attrs = [
    `${COOKIE_NAME}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    `Max-Age=${maxAge}`
  ];
  if (secure) attrs.push("Secure");
  return attrs.join("; ");
}

async function signTokenPart(secret, value) {
  const key = await crypto.subtle.importKey(
    "raw",
    utf8Encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", key, utf8Encode(value));
  return toBase64Url(new Uint8Array(signature));
}

export function isAuthConfigured(env) {
  return Boolean(getAdminUsername(env) && getAdminPassword(env) && getAuthSecret(env));
}

export function validateCredentials(env, username, password) {
  if (!isAuthConfigured(env)) return false;
  return username === getAdminUsername(env) && password === getAdminPassword(env);
}

export async function createSessionCookie(env, secure) {
  const payload = {
    sub: "admin",
    exp: Date.now() + SESSION_TTL_SECONDS * 1000
  };
  const encodedPayload = toBase64Url(utf8Encode(JSON.stringify(payload)));
  const signature = await signTokenPart(getAuthSecret(env), encodedPayload);
  return createCookieHeader(`${encodedPayload}.${signature}`, SESSION_TTL_SECONDS, secure);
}

export function clearSessionCookie(secure) {
  return createCookieHeader("", 0, secure);
}

export async function isAuthenticated(request, env) {
  if (!isAuthConfigured(env)) return false;

  const token = parseCookies(request)[COOKIE_NAME];
  if (!token) return false;

  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return false;

  const expectedSignature = await signTokenPart(getAuthSecret(env), encodedPayload);
  if (!safeEqual(signature, expectedSignature)) return false;

  try {
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(encodedPayload)));
    return Boolean(payload && payload.exp > Date.now());
  } catch (error) {
    return false;
  }
}
