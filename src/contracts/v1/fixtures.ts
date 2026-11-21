// Synthetic schema examples only. No token, signature, real identity or payment.
import type {
  AiAssessmentMetadata, ApiErrorEnvelope, ApiSuccess, Assessment, AuthorizationContext,
  Case, ConsentGrant, EvidenceFindings, EvidencePassport, RuleVersion,
  SignedNoticePayload, SourceReference,
} from "./index";

export const noticePayloadFixture = {
  v: 1,
  issuerId: "issuer_demo",
  noticeId: "notice_demo_001",
  recipientRef: "recipient_demo_001",
  programRef: "program_demo",
  paymentRef: "payment_demo_001",
  amountMinor: 125000,
  currency: "PKR",
  issuedAt: 1795248000,
  expiresAt: 1795420800,
} as const satisfies SignedNoticePayload;

export const fixtureIds = {
  case: "00000000-0000-4000-8000-000000000001",
  citizen: "00000000-0000-4000-8000-000000000002",
  helper: "00000000-0000-4000-8000-000000000003",
  officer: "00000000-0000-4000-8000-000000000004",
  department: "00000000-0000-4000-8000-000000000005",
  helperGrant: "00000000-0000-4000-8000-000000000006",
  departmentGrant: "00000000-0000-4000-8000-000000000007",
  assessment: "00000000-0000-4000-8000-000000000008",
  ruleVersion: "00000000-0000-4000-8000-000000000009",
  request: "00000000-0000-4000-8000-000000000010",
  admin: "00000000-0000-4000-8000-000000000011",
  aiRun: "00000000-0000-4000-8000-000000000012",
} as const;

export const helperGrantFixture = {
  id: fixtureIds.helperGrant,
  caseId: fixtureIds.case,
  grantorCitizenId: fixtureIds.citizen,
  recipientType: "PRINCIPAL",
  recipientId: fixtureIds.helper,
  purpose: "synthetic_helper_assistance",
  actions: ["READ_CASE", "READ_EVIDENCE", "ADD_EVIDENCE", "SUBMIT_CASE"],
  expiresAt: "2026-11-22T13:00:00Z",
  revokedAt: null,
  createdAt: "2026-11-21T08:00:00Z",
  version: 1,
} satisfies ConsentGrant;

export const departmentGrantFixture = {
  ...helperGrantFixture,
  id: fixtureIds.departmentGrant,
  recipientType: "DEPARTMENT",
  recipientId: fixtureIds.department,
  purpose: "synthetic_department_review",
  actions: ["READ_CASE", "READ_EVIDENCE", "REVIEW_CASE", "RESOLVE_CASE", "CLOSE_CASE"],
} satisfies ConsentGrant;

export const authorizationContextFixture = {
  principal: { id: fixtureIds.officer, kind: "HUMAN", roles: ["OFFICER"], active: true },
  target: { caseId: fixtureIds.case, citizenId: fixtureIds.citizen, assignedOfficerId: fixtureIds.officer },
  departmentIds: [fixtureIds.department],
  grants: [helperGrantFixture, departmentGrantFixture],
  apiKeyScopes: null,
  evaluatedAt: "2026-11-21T08:30:00Z",
} satisfies AuthorizationContext;

export const sourceRefFixture = {
  service: "mock_payments",
  recordRef: "payment_demo_001",
  sourceVersion: 1,
  observedAt: "2026-11-21T08:30:00Z",
} satisfies SourceReference;

export const pendingFindingsFixture = {
  signature: { result: "VALID", reasonCodes: ["SIGNATURE_VALID"], sourceRefs: [], observedAt: "2026-11-21T08:30:00Z" },
  expiry: { result: "CURRENT", reasonCodes: [], sourceRefs: [], observedAt: "2026-11-21T08:30:00Z" },
  revocation: { result: "ACTIVE", reasonCodes: [], sourceRefs: [], observedAt: "2026-11-21T08:30:00Z" },
  recipientMatch: { result: "MATCH", reasonCodes: [], sourceRefs: [], observedAt: "2026-11-21T08:30:00Z" },
  payment: { result: "PENDING", reasonCodes: [], sourceRefs: [sourceRefFixture], observedAt: "2026-11-21T08:30:00Z" },
  eligibility: { result: "UNKNOWN", reasonCodes: ["ELIGIBILITY_INPUT_MISSING"], sourceRefs: [], observedAt: "2026-11-21T08:30:00Z" },
} satisfies EvidenceFindings;

// Illustrative test parameters only; no business threshold or calibration approved.
export const ruleVersionFixture = {
  id: fixtureIds.ruleVersion,
  version: 1,
  parameters: { maxMonthlyIncomeMinor: 1000000, minRoutingConfidence: 0.75, integrityFailurePriority: "HIGH" },
  publishedAt: "2026-11-21T08:00:00Z",
  publishedBy: fixtureIds.admin,
  contentDigest: "0".repeat(64), // Schema placeholder, not a computed content digest.
} satisfies RuleVersion;

export const aiNotAuthorizedFixture = {
  status: "NOT_AUTHORIZED",
  runId: null,
  modelVersion: null,
  promptVersion: null,
  outputSchemaVersion: null,
  confidence: null,
  classification: null,
  recommendedRoute: null,
  explanationRefs: [],
  failureCode: null,
} satisfies AiAssessmentMetadata;

export const assessmentFixture = {
  id: fixtureIds.assessment,
  caseId: fixtureIds.case,
  assessedAt: "2026-11-21T08:30:00Z",
  evidenceVersion: 1,
  ruleVersionId: fixtureIds.ruleVersion,
  sourceVersions: [sourceRefFixture],
  evidenceRefs: [],
  findings: pendingFindingsFixture,
  contradictions: [],
  missingEvidence: ["program_income"],
  ai: aiNotAuthorizedFixture,
  aiRunIds: [],
} satisfies Assessment;

export const evidencePassportFixture = {
  caseId: fixtureIds.case,
  assessmentId: fixtureIds.assessment,
  assessedAt: "2026-11-21T08:30:00Z",
  evidenceVersion: 1,
  ruleVersionId: fixtureIds.ruleVersion,
  ...pendingFindingsFixture,
  contradictions: [],
  missingEvidence: ["program_income"],
  ai: aiNotAuthorizedFixture,
  caseStatus: "UNDER_REVIEW",
} satisfies EvidencePassport;

export const caseFixture = {
  id: fixtureIds.case,
  citizenId: fixtureIds.citizen,
  status: "UNDER_REVIEW",
  version: 2,
  evidenceVersion: 1,
  relatedCaseId: null,
  assignedOfficerId: fixtureIds.officer,
  priority: "NORMAL",
  createdAt: "2026-11-21T08:00:00Z",
  submittedAt: "2026-11-21T08:10:00Z",
  updatedAt: "2026-11-21T08:30:00Z",
} satisfies Case;

export const missingPaymentPassportFixture = {
  ...evidencePassportFixture,
  payment: {
    result: "UNKNOWN", reasonCodes: ["RECORD_NOT_FOUND"],
    sourceRefs: [{ ...sourceRefFixture, recordRef: null, sourceVersion: null }],
    observedAt: "2026-11-21T08:30:00Z",
  },
} satisfies EvidencePassport;

export const evidencePassportSuccessFixture = {
  requestId: fixtureIds.request,
  data: evidencePassportFixture,
} satisfies ApiSuccess<EvidencePassport>;

export const validationErrorFixture = {
  requestId: fixtureIds.request,
  error: {
    code: "VALIDATION_FAILED", messageKey: "errors.validation_failed",
    fieldErrors: [{ path: "amountMinor", messageKey: "validation.integer_required" }],
    retryable: false,
  },
} satisfies ApiErrorEnvelope;
