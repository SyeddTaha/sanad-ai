"use client";

import { z } from "zod";
import {
  ApiErrorEnvelopeSchema,
  CaseSchema,
  CaseStatusSchema,
  CasePrioritySchema,
  IdSchema,
  RuleParametersSchema,
  RuleVersionSchema,
  TimestampSchema,
  VersionSchema,
  AssessmentSchema,
} from "@/contracts/v1";
import { CaseEventSchema, EvidenceItemSchema } from "@/lib/case-contract";

export type StaffApiMode = "fixture" | "live";

const OfficerQueueItemSchema = z.strictObject({
  caseId: IdSchema,
  departmentId: IdSchema,
  assignedOfficerId: IdSchema.nullable(),
  status: CaseStatusSchema,
  priority: CasePrioritySchema,
  version: VersionSchema,
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
  confidence: z.number().min(0).max(1).nullable(),
});

const DispatchItemSchema = OfficerQueueItemSchema.omit({ confidence: true });
const CollectionSchema = <T extends z.ZodType>(item: T) =>
  z.strictObject({ items: z.array(item), nextCursor: z.string().min(1).nullable() });
const SuccessSchema = <T extends z.ZodType>(data: T) =>
  z.strictObject({ data, requestId: IdSchema });

const OfficerQueueResponseSchema = SuccessSchema(CollectionSchema(OfficerQueueItemSchema));
const DispatchResponseSchema = SuccessSchema(CollectionSchema(DispatchItemSchema));
const DispatchMutationResponseSchema = SuccessSchema(DispatchItemSchema);
const CaseActionResponseSchema = SuccessSchema(z.strictObject({ case: CaseSchema }));
const ResolutionResponseSchema = SuccessSchema(z.strictObject({
  case: CaseSchema,
  assessmentId: IdSchema,
  resolutionId: IdSchema,
}));
const EvidenceResponseSchema = SuccessSchema(CollectionSchema(EvidenceItemSchema));
const ProgramInputSchema = z.strictObject({
  id: IdSchema,
  caseId: IdSchema,
  version: VersionSchema,
  source: z.literal("SYNTHETIC_DEMO"),
  recipientMatch: z.enum(["MATCH", "AMBIGUOUS", "UNKNOWN"]),
  enrollment: z.enum(["ACTIVE", "INACTIVE", "UNKNOWN"]),
  monthlyIncomeMinor: z.number().int().nonnegative().nullable(),
  recordedBy: IdSchema,
  recordedAt: TimestampSchema,
});
const ProgramInputsResponseSchema = SuccessSchema(CollectionSchema(ProgramInputSchema));
const HistoryResponseSchema = SuccessSchema(CollectionSchema(CaseEventSchema));
const DecisionSchema = z.strictObject({
  id: IdSchema,
  caseId: IdSchema,
  actorId: IdSchema,
  action: z.enum(["CASE_ASSIGNED", "PRIORITY_CHANGED", "CASE_ESCALATED", "REVIEW_STARTED", "EVIDENCE_REQUESTED", "CASE_RESOLVED", "CASE_CLOSED", "CASE_RESUBMITTED"]),
  reason: z.string().nullable(),
  previousOfficerId: IdSchema.nullable(),
  officerId: IdSchema.nullable(),
  previousDepartmentId: IdSchema.nullable(),
  departmentId: IdSchema.nullable(),
  previousStatus: CaseStatusSchema,
  status: CaseStatusSchema,
  caseVersion: VersionSchema,
  evidenceVersion: VersionSchema,
  assessmentId: IdSchema.nullable(),
  reviewedAssessmentId: IdSchema.nullable(),
  ruleVersionId: IdSchema.nullable(),
  createdAt: TimestampSchema,
});
const DecisionsResponseSchema = SuccessSchema(CollectionSchema(DecisionSchema));
const PublishedRuleSchema = z.strictObject({
  programRef: z.literal("program_demo"),
  policyLabel: z.literal("SANAD Synthetic Relief Demo"),
  rule: RuleVersionSchema,
});
const RuleResponseSchema = SuccessSchema(PublishedRuleSchema);
const AssessmentResponseSchema = SuccessSchema(AssessmentSchema);

export type OfficerQueueItem = z.infer<typeof OfficerQueueItemSchema>;
export type DispatchItem = z.infer<typeof DispatchItemSchema>;
export type CaseActionResult = z.infer<typeof CaseActionResponseSchema>["data"];
export type ResolutionResult = z.infer<typeof ResolutionResponseSchema>["data"];
export type CaseDecision = z.infer<typeof DecisionSchema>;

const parsers = {
  officerQueue: OfficerQueueResponseSchema,
  dispatch: DispatchResponseSchema,
  dispatchMutation: DispatchMutationResponseSchema,
  caseAction: CaseActionResponseSchema,
  resolution: ResolutionResponseSchema,
  evidence: EvidenceResponseSchema,
  history: HistoryResponseSchema,
  decisions: DecisionsResponseSchema,
  programInputs: ProgramInputsResponseSchema,
  rule: RuleResponseSchema,
  assessment: AssessmentResponseSchema,
};

export function parseStaffResponse(value: unknown, parser: keyof typeof parsers) {
  return parsers[parser].parse(value);
}

export class StaffApiError extends Error {
  constructor(
    public readonly code: string,
    public readonly messageKey: string,
    public readonly retryable: boolean,
  ) {
    super(`${code}: ${messageKey}`);
  }
}

function randomKey() {
  const bytes = new Uint32Array(4);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => value.toString(36)).join("_").slice(0, 128);
}

export type IdempotencyEntry = {
  key: string;
  fingerprint: string;
  status: "pending" | "rejected";
};

export const staffMutationKeys = new Map<string, IdempotencyEntry>();
let activeStaffIdentity: string | null = null;

function fingerprint(payload: unknown) {
  if (payload === undefined) return "{}";
  return JSON.stringify(payload);
}

export function createIdempotencyKey(
  keys: Map<string, IdempotencyEntry>,
  action: string,
  payload?: unknown,
) {
  const nextFingerprint = fingerprint(payload);
  const existing = keys.get(action);
  if (existing?.fingerprint === nextFingerprint) return existing.key;
  const key = randomKey();
  keys.set(action, { key, fingerprint: nextFingerprint, status: "pending" });
  return key;
}

export function markMutationSucceeded(
  keys: Map<string, IdempotencyEntry>,
  action: string,
  payload?: unknown,
) {
  const entry = keys.get(action);
  if (entry?.fingerprint === fingerprint(payload)) keys.delete(action);
}

export function markMutationRejected(
  keys: Map<string, IdempotencyEntry>,
  action: string,
  payload?: unknown,
) {
  const entry = keys.get(action);
  if (entry?.fingerprint === fingerprint(payload)) entry.status = "rejected";
}

export function bindStaffSession(keys: Map<string, IdempotencyEntry>, identity: string) {
  if (activeStaffIdentity !== identity) {
    keys.clear();
    activeStaffIdentity = identity;
  }
}

export function clearStaffMutationState(keys: Map<string, IdempotencyEntry>) {
  keys.clear();
  activeStaffIdentity = null;
}

export function getStaffApiMode(): StaffApiMode {
  return process.env.NEXT_PUBLIC_SANAD_STAFF_MODE === "live" ? "live" : "fixture";
}

export function getStaffModeLabel(mode: StaffApiMode) {
  return mode === "live"
    ? "Live configuration: server reachability and permissions are verified per request"
    : "Fixture demo: synthetic data and mutations";
}

export function isLiveResolutionAvailable(mode: StaffApiMode, assessmentId: string | null) {
  return mode === "fixture" ? true : assessmentId !== null && assessmentId.trim().length > 0;
}

export function isLiveAssessmentFresh(
  assessmentId: string | null,
  assessmentEvidenceVersion: number | null,
  currentEvidenceVersion: number,
) {
  return assessmentId !== null
    && assessmentId.trim().length > 0
    && assessmentEvidenceVersion !== null
    && assessmentEvidenceVersion === currentEvidenceVersion;
}

async function request(path: string, init: RequestInit, action?: string, keys?: Map<string, IdempotencyEntry>) {
  const headers = new Headers(init.headers);
  if (init.method && init.method !== "GET") {
    headers.set("Content-Type", "application/json");
    if (action && keys) {
      const payload = init.body ? JSON.parse(String(init.body)) : undefined;
      headers.set("Idempotency-Key", createIdempotencyKey(keys, action, payload));
    }
  }
  const response = await fetch(`/api/v1/${path}`, {
    ...init,
    headers,
    credentials: "same-origin",
    cache: "no-store",
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    let error: StaffApiError;
    if (payload) {
      const parsed = ApiErrorEnvelopeSchema.safeParse(payload);
      if (parsed.success) {
        const apiError = parsed.data.error;
        error = new StaffApiError(apiError.code, apiError.messageKey, apiError.retryable);
      } else {
        error = new StaffApiError("SERVICE_UNAVAILABLE", "staff.endpoint.unavailable", true);
      }
    } else if (response.status === 401) {
      error = new StaffApiError("UNAUTHENTICATED", "authentication.required", true);
    } else if (response.status === 403) {
      error = new StaffApiError("FORBIDDEN", "authorization.denied", false);
    } else {
      error = new StaffApiError("SERVICE_UNAVAILABLE", "staff.endpoint.unavailable", true);
    }
    if (action && keys) {
      const requestPayload = init.body ? JSON.parse(String(init.body)) : undefined;
      const definitive = !error.retryable || ["UNAUTHENTICATED", "VALIDATION_FAILED", "STALE_VERSION", "STALE_ASSESSMENT", "INVALID_TRANSITION", "IDEMPOTENCY_CONFLICT", "CONSENT_REQUIRED", "ASSIGNMENT_REQUIRED", "INSUFFICIENT_SCOPE"].includes(error.code);
      if (definitive) markMutationRejected(keys, action, requestPayload);
    }
    throw error;
  }
  return payload;
}

export function createStaffApi(keys = staffMutationKeys, mode = getStaffApiMode()) {
  return {
    mode,
    getOfficerQueue: async (cursor?: string, status?: string, limit?: number, sort?: "priority" | "confidence" | "oldest") => {
      if (mode === "fixture") return null;
      const params = new URLSearchParams();
      if (cursor) params.set("cursor", cursor);
      if (status) params.set("status", status);
      if (limit !== undefined) params.set("limit", String(limit));
      if (sort) params.set("sort", sort);
      return parsers.officerQueue.parse(await request(`cases${params.size ? `?${params}` : ""}`, { method: "GET" }));
    },
    getDispatch: async (cursor?: string, status?: string, limit?: number, sort?: "priority" | "oldest") => {
      if (mode === "fixture") return null;
      const params = new URLSearchParams();
      if (cursor) params.set("cursor", cursor);
      if (status) params.set("status", status);
      if (limit !== undefined) params.set("limit", String(limit));
      if (sort) params.set("sort", sort);
      return parsers.dispatch.parse(await request(`admin/dispatch${params.size ? `?${params}` : ""}`, { method: "GET" }));
    },
    getCase: async (caseId: string) => {
      if (mode === "fixture") return null;
      return SuccessSchema(CaseSchema).parse(await request(`cases/${caseId}`, { method: "GET" })).data;
    },
    getEvidence: async (caseId: string, cursor?: string, limit?: number) => {
      if (mode === "fixture") return null;
      const params = new URLSearchParams();
      if (cursor) params.set("cursor", cursor);
      if (limit !== undefined) params.set("limit", String(limit));
      return parsers.evidence.parse(await request(`cases/${caseId}/evidence${params.size ? `?${params}` : ""}`, { method: "GET" })).data;
    },
    getDecisions: async (caseId: string, cursor?: string, limit?: number) => {
      if (mode === "fixture") return null;
      const params = new URLSearchParams();
      if (cursor) params.set("cursor", cursor);
      if (limit !== undefined) params.set("limit", String(limit));
      return parsers.decisions.parse(await request(`cases/${caseId}/decisions${params.size ? `?${params}` : ""}`, { method: "GET" })).data;
    },
    getProgramInputs: async (caseId: string, cursor?: string, limit?: number) => {
      if (mode === "fixture") return null;
      const params = new URLSearchParams();
      if (cursor) params.set("cursor", cursor);
      if (limit !== undefined) params.set("limit", String(limit));
      return parsers.programInputs.parse(await request(`cases/${caseId}/program-inputs${params.size ? `?${params}` : ""}`, { method: "GET" })).data;
    },
    getHistory: async (caseId: string) => {
      if (mode === "fixture") return null;
      return parsers.history.parse(await request(`cases/${caseId}/history`, { method: "GET" })).data;
    },
    getRule: async (programRef = "program_demo") => {
      if (mode === "fixture") return null;
      const params = new URLSearchParams({ programRef });
      return parsers.rule.parse(await request(`rules/current?${params}`, { method: "GET" })).data;
    },
    assignCase: async (caseId: string, body: { expectedVersion: number; departmentId: string; officerId: string; reason: string }) => {
      if (mode === "fixture") throw new StaffApiError("SERVICE_UNAVAILABLE", "staff.fixture.mutations_disabled", false);
      const payload = await request(`cases/${caseId}/assign`, { method: "POST", body: JSON.stringify(body) }, `assign:${caseId}`, keys);
      markMutationSucceeded(keys, `assign:${caseId}`, body);
      return parsers.dispatchMutation.parse(payload).data;
    },
    setPriority: async (caseId: string, body: { expectedVersion: number; departmentId: string; priority: "NORMAL" | "HIGH"; reason: string }) => {
      if (mode === "fixture") throw new StaffApiError("SERVICE_UNAVAILABLE", "staff.fixture.mutations_disabled", false);
      const payload = await request(`cases/${caseId}/priority`, { method: "POST", body: JSON.stringify(body) }, `priority:${caseId}`, keys);
      markMutationSucceeded(keys, `priority:${caseId}`, body);
      return parsers.dispatchMutation.parse(payload).data;
    },
    mutate: async (action: string, caseId: string, body: unknown) => {
      if (mode === "fixture") throw new StaffApiError("SERVICE_UNAVAILABLE", "staff.fixture.mutations_disabled", false);
      const payload = await request(`cases/${caseId}/${action}`, {
        method: "POST",
        body: JSON.stringify(body),
      }, `${action}:${caseId}`, keys);
      markMutationSucceeded(keys, `${action}:${caseId}`, body);
      return action === "resolve" ? parsers.resolution.parse(payload).data : parsers.caseAction.parse(payload).data;
    },
    createAssessment: async (caseId: string, body: { expectedEvidenceVersion: number; includeAi: boolean }) => {
      if (mode === "fixture") return null;
      const payload = await request(`cases/${caseId}/assessments`, {
        method: "POST",
        body: JSON.stringify(body),
      }, `assessment:${caseId}`, keys);
      markMutationSucceeded(keys, `assessment:${caseId}`, body);
      return parsers.assessment.parse(payload).data;
    },
    publishRule: async (body: { programRef: "program_demo"; expectedCurrentVersion: number | null; parameters: z.infer<typeof RuleParametersSchema> }) => {
      if (mode === "fixture") throw new StaffApiError("SERVICE_UNAVAILABLE", "staff.fixture.mutations_disabled", false);
      const payload = await request("rules/publish", {
        method: "POST",
        body: JSON.stringify(body),
      }, "publish-rule", keys);
      markMutationSucceeded(keys, "publish-rule", body);
      return parsers.rule.parse(payload).data;
    },
  };
}
