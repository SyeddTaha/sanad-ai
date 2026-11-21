import "server-only";
import type { NextRequest } from "next/server";
import { IdSchema, type ErrorCode } from "@/contracts/v1";
import { SessionContextSchema } from "@/lib/auth/session-contract";
import { authClients, type AuthClients } from "./supabase";

export const SESSION_COOKIE = "sanad-session";

export class AuthFailure extends Error {
  constructor(readonly code: ErrorCode, readonly actorId?: string) { super(code); }
}

export function providerFailure(status?: number) {
  if (status === 429) return new AuthFailure("RATE_LIMITED");
  if (status && [400, 401, 403, 422].includes(status)) return new AuthFailure("UNAUTHENTICATED");
  return new AuthFailure("SERVICE_UNAVAILABLE");
}

export function requestToken(request: NextRequest) {
  const cookie = request.cookies.get(SESSION_COOKIE)?.value;
  const auth = request.headers.get("authorization");
  const key = request.headers.has("x-api-key");
  if (Number(Boolean(cookie)) + Number(auth !== null) + Number(key) > 1) throw new AuthFailure("MALFORMED_REQUEST");
  if (key) throw new AuthFailure("INVALID_API_KEY");
  const token = auth === null ? cookie : /^Bearer ([^\s,]+)$/i.exec(auth)?.[1];
  if (!token) throw new AuthFailure("UNAUTHENTICATED");
  return token;
}

export async function resolvePrincipal(token: string, clients: AuthClients = authClients()) {
  const { data, error } = await clients.user.auth.getUser(token);
  if (error) throw providerFailure(error.status);
  if (!data.user) throw new AuthFailure("UNAUTHENTICATED");

  // getUser verified this exact JWT. Bind its session to that user in auth.sessions
  // so even an unexpired access token stops working after local sign-out.
  let sessionId: string;
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
    sessionId = IdSchema.parse(payload.session_id);
  } catch { throw new AuthFailure("UNAUTHENTICATED"); }
  const result = await clients.server.rpc("sanad_session_context", { actor: data.user.id, session: sessionId });
  if (result.error) throw new AuthFailure("SERVICE_UNAVAILABLE");
  if (!result.data) throw new AuthFailure("UNAUTHENTICATED");
  const context = SessionContextSchema.parse(result.data);
  if (context.principal.id !== data.user.id || context.principal.kind !== "HUMAN") throw new AuthFailure("SERVICE_UNAVAILABLE");
  if (!context.principal.active || !context.principal.roles.length) throw new AuthFailure("FORBIDDEN", data.user.id);
  return context;
}

export function requirePrincipal(request: NextRequest, clients: AuthClients = authClients()) {
  return resolvePrincipal(requestToken(request), clients);
}
