import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  ADMIN_SESSION_COOKIE,
  createAdminSessionToken,
  extractCookieValue,
  isAdminAuthEnabled,
  serializeExpiredSessionCookie,
  serializeSessionCookie,
  type AdminAuthConfig,
  verifyAdminSessionToken,
} from "../lib/admin-auth.js";
import { GatewayError } from "../lib/errors.js";

const adminLoginSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
});

export function registerAdminAuthRoutes(app: FastifyInstance, auth: AdminAuthConfig) {
  app.get("/v1/admin/session", async (request) => {
    const token = extractCookieValue(request.headers.cookie, ADMIN_SESSION_COOKIE);
    const authenticated =
      isAdminAuthEnabled(auth) && verifyAdminSessionToken(token, auth);

    return {
      enabled: Boolean(auth.password),
      authenticated,
      username: authenticated ? auth.username : null,
    };
  });

  app.post("/v1/admin/login", async (request, reply) => {
    if (!auth.password) {
      throw new GatewayError({
        statusCode: 400,
        type: "invalid_request",
        code: "admin_password_not_configured",
        message: "Admin password login is not configured on this server.",
      });
    }

    const parsed = adminLoginSchema.parse(request.body);
    if (parsed.username !== auth.username || parsed.password !== auth.password) {
      throw new GatewayError({
        statusCode: 401,
        type: "authentication_error",
        code: "invalid_admin_credentials",
        message: "Invalid admin username or password.",
      });
    }

    const token = createAdminSessionToken(auth);
    reply.header("set-cookie", serializeSessionCookie(token));

    return {
      authenticated: true,
      username: auth.username,
    };
  });

  app.post("/v1/admin/logout", async (_, reply) => {
    reply.header("set-cookie", serializeExpiredSessionCookie());
    return { authenticated: false };
  });
}
