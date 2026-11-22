import "server-only";
import { z } from "zod";
import { ApiSuccessSchema, ResolveCaseRequestSchema, type ConsentAction } from "@/contracts/v1";
import * as cases from "@/lib/case-contract";
import * as consent from "@/lib/consent-contract";
import * as staff from "@/lib/officer-contract";
import * as keys from "@/lib/api-key-contract";
import { PublishRuleRequestSchema, RuleResponseSchema } from "@/lib/rule-contract";
import { SessionResponseSchema } from "@/lib/auth/session-contract";
import { Credentials } from "@/backend/auth/password";

type Operation = {
  id: string; method: "get" | "post" | "patch"; path: string; summary: string;
  response: z.ZodType; request?: z.ZodType; example?: unknown; status?: number;
  scopes?: ConsentAction[]; description?: string; public?: boolean; pagination?: boolean; queue?: "officer" | "dispatch";
};
const uuid = "00000000-0000-4000-8000-000000000001";
const version = { expectedVersion: 1 };
const reason = { ...version, reason: "Review synthetic dispute; this action authorizes no payment." };
export const operations: Operation[] = [
  { id: "login", method: "post", path: "/auth/login", summary: "Log in with synthetic demo credentials", request: Credentials, response: SessionResponseSchema,
    public: true, example: { email: "helper@demo.sanad.test", password: "synthetic-password-from-environment" }, description: "Requires same-origin Origin even for non-browser clients. Sets the HttpOnly session cookie; no token is returned. No Idempotency-Key required." },
  { id: "logout", method: "post", path: "/auth/logout", summary: "Revoke the current human session", response: ApiSuccessSchema(z.null()),
    description: "Requires same-origin Origin. Clears the session cookie; an absent/expired human session may still be cleared. No body or Idempotency-Key required." },
  { id: "session", method: "get", path: "/session", summary: "Read verified human principal and departments", response: SessionResponseSchema },
  { id: "issueApiKey", method: "post", path: "/api-keys", summary: "Issue a scoped service credential for the authenticated human", request: keys.IssueApiKeyRequestSchema, response: keys.IssueApiKeyResponseSchema, status: 201,
    example: { name: "Synthetic helper integration", scopes: ["READ_CASE", "READ_EVIDENCE"], expiresAt: "2026-11-22T12:00:00Z" },
    description: "HELPER/OFFICER/ADMIN/AUDITOR scopes are limited by current roles. Mandatory future expiry, at most 30 days. The 201 response is the only disclosure of key; identical issuance retries return 200 with key:null and original metadata. Revoke a lost credential and issue another. Only a SHA-256 hash is stored." },
  { id: "listApiKeys", method: "get", path: "/api-keys", summary: "List own credential metadata, including expired/revoked credentials", response: keys.ApiKeyListResponseSchema, pagination: true },
  { id: "revokeApiKey", method: "post", path: "/api-keys/{keyId}/revoke", summary: "Revoke own service credential", request: keys.RevokeApiKeyRequestSchema, response: keys.ApiKeyResponseSchema, example: {},
    description: "Issuing human only. Subsequent requests reject the key. Repeated revocation is safe. API keys cannot manage credentials." },
  { id: "reserveCase", method: "post", path: "/case-drafts", summary: "Reserve a Citizen-owned Case ID", request: consent.ReserveCaseRequestSchema, response: consent.CaseReservationResponseSchema, status: 201, example: {}, description: "Human CITIZEN only; API keys cannot confirm ownership or consent." },
  { id: "readDraft", method: "get", path: "/case-drafts/{caseId}", summary: "Read an authorized unsubmitted draft", response: cases.DraftResponseSchema, scopes: ["READ_EVIDENCE"] },
  { id: "saveDraft", method: "patch", path: "/case-drafts/{caseId}", summary: "Replace an authorized draft at its current revision", request: cases.SaveDraftRequestSchema, response: cases.DraftResponseSchema, scopes: ["WRITE_DRAFT"],
    example: { ...version, noticeToken: null, messageText: "Synthetic relief notice: payment record is missing.", disputeText: null, relatedCaseId: null }, description: "Explicit nulls clear fields; no actor/owner/finding fields accepted. Related Cases require separate current read authorization. Body bound: 64 KiB." },
  { id: "listConsents", method: "get", path: "/cases/{caseId}/consents", summary: "Citizen views own sharing history", response: consent.ConsentListResponseSchema },
  { id: "grantConsent", method: "post", path: "/cases/{caseId}/consents", summary: "Citizen confirms explicit purpose/action/recipient sharing", request: consent.CreateConsentRequestSchema, response: consent.ConsentResponseSchema, status: 201,
    example: { recipientType: "PRINCIPAL", recipientId: uuid, purpose: "synthetic_helper_assistance", actions: ["READ_CASE", "READ_EVIDENCE"], expiresAt: "2026-11-22T12:00:00Z" }, description: "Human Citizen owner only. Purpose/action compatibility, active recipient and future expiry are checked on the server." },
  { id: "withdrawConsent", method: "post", path: "/consents/{grantId}/revoke", summary: "Citizen withdraws a current sharing grant", request: consent.RevokeConsentRequestSchema, response: consent.ConsentResponseSchema, example: version },
  { id: "submitCase", method: "post", path: "/cases", summary: "Submit saved authorized input as a Case", request: cases.SubmitCaseRequestSchema, response: cases.CaseResponseSchema, status: 201, scopes: ["SUBMIT_CASE"], example: { caseId: uuid, expectedDraftVersion: 2 }, description: "Citizen or consent-authorized HELPER. Server derives owner. Missing department review consent produces PENDING_CONSENT." },
  { id: "officerQueue", method: "get", path: "/cases", summary: "List assigned, consent-authorized officer Cases", response: staff.OfficerQueueResponseSchema, scopes: ["READ_CASE", "READ_EVIDENCE"], pagination: true, queue: "officer" },
  { id: "dispatchQueue", method: "get", path: "/admin/dispatch", summary: "List minimal authorized department dispatch metadata", response: staff.StaffQueueResponseSchema, scopes: ["ASSIGN_CASE"], pagination: true, queue: "dispatch" },
  { id: "staffOfficers", method: "get", path: "/admin/officers", summary: "List active officers in an authorized Admin department", response: staff.StaffOfficerDirectoryResponseSchema, scopes: ["ASSIGN_CASE"], description: "The departmentId query is restricted to department memberships from the verified session." },
  { id: "readCase", method: "get", path: "/cases/{caseId}", summary: "Read authorized Case metadata", response: cases.CaseResponseSchema, scopes: ["READ_CASE"] },
  { id: "caseHistory", method: "get", path: "/cases/{caseId}/history", summary: "Read authorized Case event history", response: cases.HistoryResponseSchema, scopes: ["READ_CASE"], pagination: true },
  { id: "readEvidence", method: "get", path: "/cases/{caseId}/evidence", summary: "Read authorized immutable evidence history", response: staff.EvidenceListResponseSchema, scopes: ["READ_EVIDENCE"], pagination: true },
  { id: "addEvidence", method: "post", path: "/cases/{caseId}/evidence", summary: "Append authorized evidence or a correction", request: cases.AddEvidenceRequestSchema, response: cases.AddEvidenceResponseSchema, status: 201, scopes: ["ADD_EVIDENCE"], example: { ...version, kind: "CITIZEN_STATEMENT", content: { text: "Synthetic payment record is missing." }, supersedesId: null }, description: "Citizen or authorized HELPER; authoritative SOURCE_SNAPSHOT uploads are rejected. Body bound: 64 KiB." },
  { id: "createAssessment", method: "post", path: "/cases/{caseId}/assessments", summary: "Append an authorized Assessment", request: cases.CreateAssessmentRequestSchema, response: cases.AssessmentResponseSchema, status: 201, scopes: ["REQUEST_ASSESSMENT", "READ_EVIDENCE"], example: { expectedEvidenceVersion: 1, includeAi: false },
    description: "AI additionally requires PROCESS_AI scope and separate current processor consent. Current B03/B04 composition preserves explicit unavailable crypto/payment/AI findings; this API does not wire the separate AI/crypto adapters. Body bound: 64 KiB." },
  { id: "evidencePassport", method: "get", path: "/cases/{caseId}/evidence-passport", summary: "Read independent findings, sources and provenance", response: cases.PassportResponseSchema, scopes: ["READ_EVIDENCE"] },
  { id: "assessmentTrace", method: "get", path: "/cases/{caseId}/assessments/{assessmentId}/trace", summary: "Read an authorized immutable Assessment trace", response: cases.AssessmentResponseSchema, scopes: ["READ_EVIDENCE"] },
  { id: "caseDecisions", method: "get", path: "/cases/{caseId}/decisions", summary: "Read protected officer decisions and reasons", response: staff.CaseDecisionsResponseSchema, scopes: ["READ_EVIDENCE"], pagination: true },
  { id: "programInputs", method: "get", path: "/cases/{caseId}/program-inputs", summary: "Read case-scoped SYNTHETIC_DEMO source history", response: staff.ProgramInputsResponseSchema, scopes: ["READ_EVIDENCE"], pagination: true },
  { id: "assignCase", method: "post", path: "/cases/{caseId}/assign", summary: "Admin assigns/reassigns within authorized department", request: staff.AssignCaseRequestSchema, response: staff.DispatchResponseSchema, scopes: ["ASSIGN_CASE"], example: { ...reason, departmentId: uuid, officerId: uuid } },
  { id: "setPriority", method: "post", path: "/cases/{caseId}/priority", summary: "Admin changes authorized department dispatch priority", request: staff.SetPriorityRequestSchema, response: staff.DispatchResponseSchema, scopes: ["ASSIGN_CASE"], example: { ...reason, departmentId: uuid, priority: "HIGH" } },
  { id: "startReview", method: "post", path: "/cases/{caseId}/start-review", summary: "Assigned officer starts authorized review", request: staff.CaseVersionRequestSchema, response: staff.OfficerActionResponseSchema, scopes: ["REVIEW_CASE"], example: version },
  { id: "requestEvidence", method: "post", path: "/cases/{caseId}/request-evidence", summary: "Assigned officer requests additional evidence", request: staff.OfficerReasonRequestSchema, response: staff.OfficerActionResponseSchema, scopes: ["REVIEW_CASE"], example: reason },
  { id: "resubmitCase", method: "post", path: "/cases/{caseId}/resubmit", summary: "Citizen/authorized helper resubmits with new evidence and department sharing", request: staff.CaseVersionRequestSchema, response: staff.OfficerActionResponseSchema, scopes: ["SUBMIT_CASE"], example: version },
  { id: "escalateCase", method: "post", path: "/cases/{caseId}/escalate", summary: "Assigned officer escalates authorized Case priority", request: staff.OfficerReasonRequestSchema, response: staff.OfficerActionResponseSchema, scopes: ["ESCALATE_CASE"], example: reason },
  { id: "resolveCase", method: "post", path: "/cases/{caseId}/resolve", summary: "Assigned officer resolves with current consent, evidence and published rules", request: ResolveCaseRequestSchema, response: staff.ResolutionResponseSchema, scopes: ["RESOLVE_CASE", "READ_EVIDENCE", "REQUEST_ASSESSMENT"], example: { ...reason, reviewedAssessmentId: uuid }, description: "Atomic B04 freshness/assignment/rule checks. Required human-authored reason; resolution authorizes no payment and changes no underlying finding." },
  { id: "closeCase", method: "post", path: "/cases/{caseId}/close", summary: "Assigned officer closes an authorized resolved Case", request: staff.CaseVersionRequestSchema, response: staff.OfficerActionResponseSchema, scopes: ["CLOSE_CASE"], example: version },
  { id: "auditMetadata", method: "get", path: "/audit", summary: "Auditor reads necessary retained audit metadata", response: staff.AuditMetadataResponseSchema, pagination: true, description: "Human AUDITOR only; required caseId query. No raw evidence, reasons or credential secrets." },
  { id: "currentRule", method: "get", path: "/rules/current", summary: "Admin/officer reads current published synthetic rule", response: RuleResponseSchema },
  { id: "ruleVersion", method: "get", path: "/rules/{ruleId}", summary: "Admin/officer reads an immutable published rule", response: RuleResponseSchema },
  { id: "publishRule", method: "post", path: "/rules/publish", summary: "Admin publishes validated synthetic eligibility/routing parameters", request: PublishRuleRequestSchema, response: RuleResponseSchema, status: 201,
    example: { programRef: "program_demo", expectedCurrentVersion: null, parameters: { maxMonthlyIncomeMinor: 800000, minRoutingConfidence: 0.8, integrityFailurePriority: "HIGH" } } },
  { id: "openapi", method: "get", path: "/openapi", summary: "Read this generated OpenAPI document", public: true,
    response: z.looseObject({ openapi: z.literal("3.1.0"), info: z.object({ title: z.string(), version: z.string(), description: z.string() }), paths: z.record(z.string(), z.unknown()) }) },
];
