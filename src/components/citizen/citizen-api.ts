"use client";

import { z } from "zod";
import { ApiErrorEnvelopeSchema } from "@/contracts/v1";
import {
  AddEvidenceResponseSchema,
  AssessmentResponseSchema,
  CaseResponseSchema,
  CreateAssessmentRequestSchema,
  DraftResponseSchema,
  HistoryResponseSchema,
  PassportResponseSchema,
  SaveDraftRequestSchema,
  SubmitCaseRequestSchema,
  type AddEvidenceRequest,
  type CaseDraft,
  type SaveDraftRequest,
} from "@/lib/case-contract";
import {
  CaseReservationResponseSchema,
  ConsentListResponseSchema,
  ConsentResponseSchema,
  CreateConsentRequestSchema,
  RevokeConsentRequestSchema,
  type CreateConsentRequest,
} from "@/lib/consent-contract";
import { session } from "@/lib/auth/browser";
import type { Case } from "@/contracts/v1/case";
import type { ConsentGrant } from "@/contracts/v1/consent";
import type { CaseEvent } from "@/lib/case-contract";
import type { EvidencePassport } from "@/contracts/v1/assessment";

export class CitizenApiError extends Error {
  readonly code: string;
  readonly retryable: boolean;

  constructor(code: string, retryable = false) {
    super(code);
    this.name = "CitizenApiError";
    this.code = code;
    this.retryable = retryable;
  }
}

export type CitizenMutationOutcome = "success" | "definitive-rejection" | "ambiguous";

export class CitizenMutationKeys {
  private readonly records = new Map<string, { key: string; payload: string }>();

  clear(): void {
    this.records.clear();
  }

  get(logicalOperation: string, payload: unknown): string {
    const serialized = JSON.stringify(payload);
    const previous = this.records.get(logicalOperation);
    if (previous?.payload === serialized) return previous.key;
    const key = `${logicalOperation.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 64)}-${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
    this.records.set(logicalOperation, { key, payload: serialized });
    return key;
  }

  retire(logicalOperation: string): void {
    this.records.delete(logicalOperation);
  }

  isTracked(logicalOperation: string): boolean {
    return this.records.has(logicalOperation);
  }
}

async function readJson(response: Response): Promise<unknown> {
  return response.json();
}

function settleMutation<T>(
  promise: Promise<T>,
  keys: CitizenMutationKeys,
  logicalOperation: string,
): Promise<T> {
  return promise.catch((error: unknown) => {
    if (
      error instanceof CitizenApiError &&
      ["STALE_VERSION", "STALE_ASSESSMENT", "INVALID_TRANSITION", "IDEMPOTENCY_CONFLICT", "VALIDATION_FAILED", "UNSUPPORTED_MEDIA_TYPE", "PAYLOAD_TOO_LARGE", "NOT_FOUND", "FORBIDDEN", "CONSENT_REQUIRED"].includes(error.code)
    ) {
      keys.retire(logicalOperation);
    }
    throw error;
  });
}

async function request<T>(
  path: string,
  schema: z.ZodType<T>,
  options: RequestInit & { idempotencyKey?: string } = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.method && options.method !== "GET") headers.set("Content-Type", "application/json");
  if (options.idempotencyKey) headers.set("Idempotency-Key", options.idempotencyKey);

  const response = await fetch(path, {
    ...options,
    headers,
    credentials: "same-origin",
    cache: "no-store",
  });
  const payload = await readJson(response).catch(() => null);

  if (!response.ok) {
    const parsed = ApiErrorEnvelopeSchema.safeParse(payload);
    if (!parsed.success) throw new CitizenApiError(response.status === 401 ? "UNAUTHENTICATED" : "SERVICE_UNAVAILABLE", response.status >= 500);
    throw new CitizenApiError(parsed.data.error.code, parsed.data.error.retryable);
  }
  const parsed = schema.safeParse(payload);
  if (!parsed.success) throw new CitizenApiError("INVALID_API_RESPONSE");
  return parsed.data;
}

export async function getCitizenSession(signal?: AbortSignal) {
  let context: Awaited<ReturnType<typeof session>>;
  try {
    context = await session();
  } catch (error) {
    if (error instanceof Error && ["UNAUTHENTICATED", "FORBIDDEN", "SERVICE_UNAVAILABLE"].includes(error.message)) {
      throw new CitizenApiError(error.message, error.message === "SERVICE_UNAVAILABLE");
    }
    throw new CitizenApiError("SERVICE_UNAVAILABLE", true);
  }
  if (!context.principal.roles.includes("CITIZEN")) throw new CitizenApiError("FORBIDDEN");
  void signal;
  return context;
}

export const citizenApi = {
  getSession: getCitizenSession,

  createDraft: (keys: CitizenMutationKeys, signal?: AbortSignal) => {
    const logicalOperation = "draft:create";
    const payload = {};
    const key = keys.get(logicalOperation, payload);
    return settleMutation(request("/api/v1/case-drafts", CaseReservationResponseSchema, {
      method: "POST",
      body: JSON.stringify(payload),
      idempotencyKey: key,
      signal,
    }).then((value) => ({ data: value.data, retire: () => keys.retire(logicalOperation) })), keys, logicalOperation);
  },

  getDraft: (caseId: string, signal?: AbortSignal) =>
    request(`/api/v1/case-drafts/${encodeURIComponent(caseId)}`, DraftResponseSchema, { signal }).then((value) => value.data as CaseDraft),

  saveDraft: (caseId: string, input: SaveDraftRequest, keys: CitizenMutationKeys, signal?: AbortSignal) => {
    const logicalOperation = `draft:save:${caseId}`;
    SaveDraftRequestSchema.parse(input);
    const key = keys.get(logicalOperation, input);
    return settleMutation(request(`/api/v1/case-drafts/${encodeURIComponent(caseId)}`, DraftResponseSchema, {
      method: "PATCH",
      body: JSON.stringify(input),
      idempotencyKey: key,
      signal,
    }).then((value) => ({ data: value.data as CaseDraft, retire: () => keys.retire(logicalOperation) })), keys, logicalOperation);
  },

  submitCase: (caseId: string, expectedDraftVersion: number, keys: CitizenMutationKeys, signal?: AbortSignal) => {
    const input = { caseId, expectedDraftVersion };
    SubmitCaseRequestSchema.parse(input);
    const logicalOperation = `case:submit:${caseId}`;
    const key = keys.get(logicalOperation, input);
    return settleMutation(request("/api/v1/cases", CaseResponseSchema, {
      method: "POST",
      body: JSON.stringify(input),
      idempotencyKey: key,
      signal,
    }).then((value) => ({ data: value.data as Case, retire: () => keys.retire(logicalOperation) })), keys, logicalOperation);
  },

  getCase: (caseId: string, signal?: AbortSignal) =>
    request(`/api/v1/cases/${encodeURIComponent(caseId)}`, CaseResponseSchema, { signal }).then((value) => value.data as Case),

  getHistory: (caseId: string, cursor: string | null = null, signal?: AbortSignal) => {
    const url = new URL(`/api/v1/cases/${encodeURIComponent(caseId)}/history`, window.location.origin);
    if (cursor) url.searchParams.set("cursor", cursor);
    return request(url.toString(), HistoryResponseSchema, { signal }).then((value) => ({
      items: value.data.items as CaseEvent[],
      nextCursor: value.data.nextCursor,
    }));
  },

  addEvidence: (caseId: string, input: AddEvidenceRequest, keys: CitizenMutationKeys, signal?: AbortSignal) => {
    const logicalOperation = `evidence:add:${caseId}`;
    const key = keys.get(logicalOperation, input);
    return settleMutation(request(`/api/v1/cases/${encodeURIComponent(caseId)}/evidence`, AddEvidenceResponseSchema, {
      method: "POST",
      body: JSON.stringify(input),
      idempotencyKey: key,
      signal,
    }).then((value) => ({ data: value.data, retire: () => keys.retire(logicalOperation) })), keys, logicalOperation);
  },

  getEvidencePassport: (caseId: string, signal?: AbortSignal) =>
    request(`/api/v1/cases/${encodeURIComponent(caseId)}/evidence-passport`, PassportResponseSchema, { signal }).then((value) => value.data as EvidencePassport),

  createAssessment: (caseId: string, expectedEvidenceVersion: number, includeAi: boolean, keys: CitizenMutationKeys, signal?: AbortSignal) => {
    const input = { expectedEvidenceVersion, includeAi };
    CreateAssessmentRequestSchema.parse(input);
    const logicalOperation = `assessment:create:${caseId}`;
    const key = keys.get(logicalOperation, input);
    return settleMutation(request(`/api/v1/cases/${encodeURIComponent(caseId)}/assessments`, AssessmentResponseSchema, {
      method: "POST",
      body: JSON.stringify(input),
      idempotencyKey: key,
      signal,
    }).then((value) => ({ data: value.data, retire: () => keys.retire(logicalOperation) })), keys, logicalOperation);
  },

  listConsents: (caseId: string, signal?: AbortSignal) =>
    request(`/api/v1/cases/${encodeURIComponent(caseId)}/consents`, ConsentListResponseSchema, { signal }).then((value) => value.data.items as ConsentGrant[]),

  grantConsent: (caseId: string, input: CreateConsentRequest, keys: CitizenMutationKeys, signal?: AbortSignal) => {
    CreateConsentRequestSchema.parse(input);
    const logicalOperation = `consent:grant:${caseId}:${input.purpose}:${input.recipientId}`;
    const key = keys.get(logicalOperation, input);
    return settleMutation(request(`/api/v1/cases/${encodeURIComponent(caseId)}/consents`, ConsentResponseSchema, {
      method: "POST",
      body: JSON.stringify(input),
      idempotencyKey: key,
      signal,
    }).then((value) => ({ data: value.data as ConsentGrant, retire: () => keys.retire(logicalOperation) })), keys, logicalOperation);
  },

  revokeConsent: (grantId: string, expectedVersion: number, keys: CitizenMutationKeys, signal?: AbortSignal) => {
    const input = { expectedVersion };
    RevokeConsentRequestSchema.parse(input);
    const logicalOperation = `consent:revoke:${grantId}`;
    const key = keys.get(logicalOperation, input);
    return settleMutation(request(`/api/v1/consents/${encodeURIComponent(grantId)}/revoke`, ConsentResponseSchema, {
      method: "POST",
      body: JSON.stringify(input),
      idempotencyKey: key,
      signal,
    }).then((value) => ({ data: value.data as ConsentGrant, retire: () => keys.retire(logicalOperation) })), keys, logicalOperation);
  },
};

export type CitizenApi = typeof citizenApi;
