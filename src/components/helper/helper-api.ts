"use client";

import { z } from "zod";
import { ApiErrorEnvelopeSchema } from "@/contracts/v1";
import { SessionResponseSchema } from "@/lib/auth/session-contract";
import { CaseResponseSchema, HistoryResponseSchema, PassportResponseSchema } from "@/lib/case-contract";
import type { Case } from "@/contracts/v1/case";
import type { CaseEvent } from "@/lib/case-contract";
import type { EvidencePassport } from "@/contracts/v1/assessment";

async function getJson<T>(path: string, schema: z.ZodType<T>): Promise<T> {
  const response = await fetch(path, { credentials: "same-origin", cache: "no-store" });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const error = ApiErrorEnvelopeSchema.safeParse(payload);
    throw new Error(error.success ? error.data.error.code : "SERVICE_UNAVAILABLE");
  }
  const parsed = schema.safeParse(payload);
  if (!parsed.success) throw new Error("INVALID_API_RESPONSE");
  return parsed.data;
}

export async function getHelperSession() {
  const payload = await getJson("/api/v1/session", SessionResponseSchema);
  const context = payload.data;
  if (!context.principal.roles.includes("HELPER")) throw new Error("FORBIDDEN");
  return context;
}

export async function getAuthorizedCase(caseId: string): Promise<{ caseItem: Case; history: CaseEvent[]; passport: EvidencePassport | null }> {
  const casePayload = await getJson(`/api/v1/cases/${encodeURIComponent(caseId)}`, CaseResponseSchema);
  const historyPayload = await getJson(`/api/v1/cases/${encodeURIComponent(caseId)}/history`, HistoryResponseSchema);
  let passport: EvidencePassport | null = null;
  try {
    const passportPayload = await getJson(`/api/v1/cases/${encodeURIComponent(caseId)}/evidence-passport`, PassportResponseSchema);
    passport = passportPayload.data;
  } catch (error) {
    if (!(error instanceof Error) || error.message !== "NOT_FOUND") throw error;
  }
  return {
    caseItem: casePayload.data,
    history: historyPayload.data.items,
    passport,
  };
}
