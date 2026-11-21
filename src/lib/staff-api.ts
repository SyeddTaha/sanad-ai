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
const CaseActionResponseSchema = SuccessSchema(z.strictObject({ case: CaseSchema }));
const ResolutionResponseSchema = SuccessSchema(z.strictObject({
  case: CaseSchema,
  assessmentId: IdSchema,
  resolutionId: IdSchema,
}));
const EvidenceResponseSchema = SuccessSchema(CollectionSchema(EvidenceItemSchema));
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

export type OfficerQueueItem = z.infer<typeof OfficerQueueItemSchema>;
export type DispatchItem = z.infer<typeof DispatchItemSchema>;
export type CaseActionResult = z.infer<typeof CaseActionResponseSchema>["data"];
export type ResolutionResult = z.infer<typeof ResolutionResponseSchema>["data"];
export type CaseDecision = z.infer<typeof DecisionSchema>;

const parsers = {
  officerQueue: OfficerQueueResponseSchema,
  dispatch: DispatchResponseSchema,
  caseAction: CaseActionResponseSchema,
  resolution: ResolutionResponseSchema,
  evidence: EvidenceResponseSchema,
  history: HistoryResponseSchema,
  decisions: DecisionsResponseSchema,
  rule: RuleResponseSchema,
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

export function createIdempotencyKey(keys: Map<string, string>, action: string) {
  const existing = keys.get(action);
  if (existing) return existing;
  const key = randomKey();
  keys.set(action, key);
  return key;
}

export function getStaffApiMode(): StaffApiMode {
  return process.env.NEXT_PUBLIC_SANAD_STAFF_MODE === "live" ? "live" : "fixture";
}

async function request(path: string, init: RequestInit, action?: string, keys?: Map<string, string>) {
  const headers = new Headers(init.headers);
  if (init.method && init.method !== "GET") {
    headers.set("Content-Type", "application/json");
    if (action && keys) headers.set("Idempotency-Key", createIdempotencyKey(keys, action));
  }
  const response = await fetch(`/api/v1/${path}`, {
    ...init,
    headers,
    credentials: "same-origin",
    cache: "no-store",
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401) throw new StaffApiError("UNAUTHENTICATED", "authentication.required", true);
    if (response.status === 403) throw new StaffApiError("FORBIDDEN", "authorization.denied", false);
    if (payload) {
      const parsed = ApiErrorEnvelopeSchema.safeParse(payload);
      if (parsed.success) {
        const error = parsed.data.error;
        throw new StaffApiError(error.code, error.messageKey, error.retryable);
      }
    }
    throw new StaffApiError("SERVICE_UNAVAILABLE", "staff.endpoint.unavailable", true);
  }
  return payload;
}

export function createStaffApi(keys = new Map<string, string>(), mode = getStaffApiMode()) {
  return {
    mode,
    getOfficerQueue: async (cursor?: string, status?: string) => {
      if (mode === "fixture") return null;
      const params = new URLSearchParams();
      if (cursor) params.set("cursor", cursor);
      if (status) params.set("status", status);
      return parsers.officerQueue.parse(await request(`cases${params.size ? `?${params}` : ""}`, { method: "GET" }));
    },
    getDispatch: async (cursor?: string) => {
      if (mode === "fixture") return null;
      const params = new URLSearchParams();
      if (cursor) params.set("cursor", cursor);
      return parsers.dispatch.parse(await request(`admin/dispatch${params.size ? `?${params}` : ""}`, { method: "GET" }));
    },
    getCase: async (caseId: string) => {
      if (mode === "fixture") return null;
      return SuccessSchema(CaseSchema).parse(await request(`cases/${caseId}`, { method: "GET" })).data;
    },
    getEvidence: async (caseId: string) => {
      if (mode === "fixture") return null;
      return parsers.evidence.parse(await request(`cases/${caseId}/evidence`, { method: "GET" })).data;
    },
    getDecisions: async (caseId: string) => {
      if (mode === "fixture") return null;
      return parsers.decisions.parse(await request(`cases/${caseId}/decisions`, { method: "GET" })).data;
    },
    getHistory: async (caseId: string) => {
      if (mode === "fixture") return null;
      return parsers.history.parse(await request(`cases/${caseId}/history`, { method: "GET" })).data;
    },
    getRule: async () => {
      if (mode === "fixture") return null;
      return parsers.rule.parse(await request("rules/current", { method: "GET" })).data;
    },
    mutate: async (action: string, caseId: string, body: unknown) => {
      if (mode === "fixture") throw new StaffApiError("SERVICE_UNAVAILABLE", "staff.fixture.mutations_disabled", false);
      const payload = await request(`cases/${caseId}/${action}`, {
        method: "POST",
        body: JSON.stringify(body),
      }, `${action}:${caseId}`, keys);
      return action === "resolve" ? parsers.resolution.parse(payload).data : parsers.caseAction.parse(payload).data;
    },
    publishRule: async (body: { programRef: "program_demo"; expectedCurrentVersion: number | null; parameters: z.infer<typeof RuleParametersSchema> }) => {
      if (mode === "fixture") throw new StaffApiError("SERVICE_UNAVAILABLE", "staff.fixture.mutations_disabled", false);
      const payload = await request("rules/publish", {
        method: "POST",
        body: JSON.stringify(body),
      }, "publish-rule", keys);
      return parsers.rule.parse(payload).data;
    },
  };
}
