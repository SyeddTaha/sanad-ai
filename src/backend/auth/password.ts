import "server-only";
import { z } from "zod";
import type { NextRequest } from "next/server";
import { SessionResponseSchema } from "@/lib/auth/session-contract";
import { AuthFailure, providerFailure, requestToken, resolvePrincipal, SESSION_COOKIE } from "./principal";
import { auditedAuth, privateJson } from "./session";
import type { AuthClients } from "./supabase";

export const Credentials = z.strictObject({ email: z.email().max(254), password: z.string().min(1).max(1024) });

function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin !== request.nextUrl.origin || request.headers.get("sec-fetch-site") === "cross-site") {
    throw new AuthFailure("FORBIDDEN");
  }
}

export function handleLogin(request: NextRequest, clients?: AuthClients) {
  return auditedAuth("LOGIN", async (provider, requestId) => {
    sameOrigin(request);
    if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") {
      throw new AuthFailure("UNSUPPORTED_MEDIA_TYPE");
    }
    // Bound the streamed body as well as Content-Length; never log credentials.
    let bytes = 0;
    const chunks: Uint8Array[] = [];
    if (!request.body) throw new AuthFailure("MALFORMED_REQUEST");
    const reader = request.body.getReader();
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > 4096) {
          await reader.cancel();
          throw new AuthFailure("PAYLOAD_TOO_LARGE");
        }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    let body: unknown;
    try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
    catch { throw new AuthFailure("MALFORMED_REQUEST"); }
    const parsed = Credentials.safeParse(body);
    if (!parsed.success) throw new AuthFailure("VALIDATION_FAILED");
    const { data, error } = await provider.user.auth.signInWithPassword(parsed.data);
    if (error) throw providerFailure(error.status);
    if (!data.session) throw new AuthFailure("UNAUTHENTICATED");
    const context = await resolvePrincipal(data.session.access_token, provider);
    const response = privateJson(SessionResponseSchema.parse({ data: context, requestId }));
    // B01 deliberately does not persist refresh tokens. Reauthentication is required at expiry.
    response.cookies.set(SESSION_COOKIE, data.session.access_token, {
      httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/",
      maxAge: Math.max(0, Math.min(data.session.expires_in, 3600)),
    });
    return { actorId: context.principal.id, response };
  }, clients);
}

export function handleLogout(request: NextRequest, clients?: AuthClients) {
  return auditedAuth("LOGOUT", async (provider, requestId) => {
    sameOrigin(request);
    // Verify with Auth, then revoke this exact session. An expired local cookie can still be cleared.
    let actorId: string | undefined;
    try {
      const token = requestToken(request);
      const { data, error } = await provider.user.auth.getUser(token);
      if (error && providerFailure(error.status).code !== "UNAUTHENTICATED") throw providerFailure(error.status);
      if (data.user && !error) {
        actorId = data.user.id;
        const revoked = await provider.server.auth.admin.signOut(token, "local");
        if (revoked.error) throw providerFailure(revoked.error.status);
      }
    } catch (error) {
      if (!(error instanceof AuthFailure) || error.code !== "UNAUTHENTICATED") throw error;
    }
    const response = privateJson({ data: null, requestId });
    response.cookies.set(SESSION_COOKIE, "", {
      httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 0,
    });
    return { actorId, response };
  }, clients);
}
