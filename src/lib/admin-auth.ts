import { createHmac, timingSafeEqual } from "node:crypto";

export const ADMIN_SESSION_COOKIE = "ig_admin_session";
const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 12;

export type AdminAuthConfig = {
  apiToken: string | null;
  username: string;
  password: string | null;
  sessionSecret: string | null;
};

export function isAdminAuthEnabled(config: AdminAuthConfig): boolean {
  return Boolean(config.apiToken || config.password);
}

export function createAdminSessionToken(config: AdminAuthConfig): string {
  const secret = resolveSessionSecret(config);
  const payload = {
    username: config.username,
    exp: Math.floor(Date.now() / 1000) + ADMIN_SESSION_TTL_SECONDS,
  };
  const encodedPayload = encodeBase64Url(JSON.stringify(payload));
  const signature = signValue(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
}

export function verifyAdminSessionToken(token: string, config: AdminAuthConfig): boolean {
  if (!config.password || !token) {
    return false;
  }

  const secret = resolveSessionSecret(config);
  const [encodedPayload, signature] = token.split(".");

  if (!encodedPayload || !signature) {
    return false;
  }

  const expectedSignature = signValue(encodedPayload, secret);
  if (!safeEqual(signature, expectedSignature)) {
    return false;
  }

  let payload: { username?: string; exp?: number };

  try {
    payload = JSON.parse(decodeBase64Url(encodedPayload)) as { username?: string; exp?: number };
  } catch {
    return false;
  }

  if (payload.username !== config.username || typeof payload.exp !== "number") {
    return false;
  }

  return payload.exp > Math.floor(Date.now() / 1000);
}

export function extractCookieValue(cookieHeader: string | undefined, name: string): string {
  if (!cookieHeader) {
    return "";
  }

  const parts = cookieHeader.split(";").map((item) => item.trim());
  for (const part of parts) {
    const [key, ...rest] = part.split("=");
    if (key === name) {
      return decodeURIComponent(rest.join("="));
    }
  }

  return "";
}

export function serializeSessionCookie(token: string): string {
  return [
    `${ADMIN_SESSION_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${ADMIN_SESSION_TTL_SECONDS}`,
  ].join("; ");
}

export function serializeExpiredSessionCookie(): string {
  return [
    `${ADMIN_SESSION_COOKIE}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
  ].join("; ");
}

function resolveSessionSecret(config: AdminAuthConfig): string {
  if (config.sessionSecret) {
    return config.sessionSecret;
  }

  return `ig-admin-session:${config.username}:${config.password ?? ""}`;
}

function signValue(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function encodeBase64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decodeBase64Url(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}
