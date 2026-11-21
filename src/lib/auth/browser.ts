"use client";

import { SessionResponseSchema } from "./session-contract";
import { ApiErrorEnvelopeSchema } from "@/contracts/v1";

async function authRequest(path: string, body?: unknown) {
  const response = await fetch("/api/v1/" + path, {
    method: body === undefined ? "GET" : "POST", credentials: "same-origin", cache: "no-store",
    ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  });
  const payload: unknown = await response.json();
  if (!response.ok) throw new Error(ApiErrorEnvelopeSchema.parse(payload).error.code);
  return payload;
}

export async function login(email: string, password: string) {
  return SessionResponseSchema.parse(await authRequest("auth/login", { email, password })).data;
}
export async function session() { return SessionResponseSchema.parse(await authRequest("session")).data; }
export async function logout() { await authRequest("auth/logout", {}); }
