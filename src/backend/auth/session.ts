import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { ErrorHttpStatus, type ApiErrorEnvelope } from "@/contracts/v1";
import { AuthFailure, requirePrincipal } from "./principal";
import { authClients, type AuthClients } from "./supabase";
import { SessionResponseSchema } from "@/lib/auth/session-contract";

export function privateJson(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store", Vary: "Cookie, Authorization" } });
}

function failureResponse(problem: AuthFailure, requestId: string) {
  const code = problem.code;
  const response = privateJson({ requestId, error: {
    code, messageKey: "errors." + code.toLowerCase(), fieldErrors: [],
    retryable: code === "SERVICE_UNAVAILABLE" || code === "RATE_LIMITED",
  } } satisfies ApiErrorEnvelope, ErrorHttpStatus[code]);
  if (code === "RATE_LIMITED") response.headers.set("Retry-After", "60");
  return response;
}

type AuthResult = { actorId?: string; response: NextResponse };
export async function auditedAuth(action: "SESSION_READ" | "LOGIN" | "LOGOUT",
  operation: (clients: AuthClients, requestId: string) => Promise<AuthResult>, supplied?: AuthClients) {
  const requestId = crypto.randomUUID();
  try {
    const clients = supplied ?? authClients();
    let result: AuthResult;
    let outcome = "ALLOWED";
    try { result = await operation(clients, requestId); }
    catch (error) {
      const failure = error instanceof AuthFailure ? error : new AuthFailure("SERVICE_UNAVAILABLE");
      outcome = failure.code === "SERVICE_UNAVAILABLE" ? "FAILED" : "DENIED";
      result = { actorId: failure.actorId, response: failureResponse(failure, requestId) };
    }
    const audit = await clients.server.from("audit_events").insert({
      request_id: requestId, actor_id: result.actorId ?? null, action, outcome,
    });
    if (audit.error) throw new Error("Audit unavailable");
    return result.response;
  } catch { return failureResponse(new AuthFailure("SERVICE_UNAVAILABLE"), requestId); }
}

export function handleSession(request: NextRequest, clients?: AuthClients) {
  return auditedAuth("SESSION_READ", async (provider, requestId) => {
    const context = await requirePrincipal(request, provider);
    return { actorId: context.principal.id, response: privateJson(SessionResponseSchema.parse({ data: context, requestId })) };
  }, clients);
}
