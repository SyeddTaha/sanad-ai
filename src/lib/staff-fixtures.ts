import type { Case } from "@/contracts/v1/case";
import type { OfficerQueueItem, DispatchItem, CaseDecision } from "@/lib/staff-api";
import { z } from "zod";
import { EvidenceItemSchema } from "@/lib/case-contract";

type EvidenceItem = z.infer<typeof EvidenceItemSchema>;

export const fixtureDepartmentId = "10000000-0000-4000-8000-000000000001";
export const fixtureOfficerIds = [
  "20000000-0000-4000-8000-000000000001",
  "20000000-0000-4000-8000-000000000002",
] as const;

export const fixtureCases: OfficerQueueItem[] = [
  {
    caseId: "30000000-0000-4000-8000-000000000001",
    departmentId: fixtureDepartmentId,
    assignedOfficerId: fixtureOfficerIds[0],
    status: "UNDER_REVIEW",
    priority: "HIGH",
    version: 4,
    createdAt: "2026-11-20T08:15:00.000Z",
    updatedAt: "2026-11-21T09:30:00.000Z",
    confidence: null,
  },
  {
    caseId: "30000000-0000-4000-8000-000000000002",
    departmentId: fixtureDepartmentId,
    assignedOfficerId: fixtureOfficerIds[0],
    status: "SUBMITTED",
    priority: "NORMAL",
    version: 2,
    createdAt: "2026-11-21T10:05:00.000Z",
    updatedAt: "2026-11-21T10:05:00.000Z",
    confidence: 0.6,
  },
];

export const fixtureDispatch: DispatchItem[] = fixtureCases.map((item) => ({
  caseId: item.caseId,
  departmentId: item.departmentId,
  assignedOfficerId: item.assignedOfficerId,
  status: item.status,
  priority: item.priority,
  version: item.version,
  createdAt: item.createdAt,
  updatedAt: item.updatedAt,
}));

export const fixtureCaseDetails: Record<string, Case> = {
  [fixtureCases[0].caseId]: {
    id: fixtureCases[0].caseId,
    citizenId: "40000000-0000-4000-8000-000000000001",
    status: "UNDER_REVIEW",
    version: 4,
    evidenceVersion: 3,
    relatedCaseId: null,
    assignedOfficerId: fixtureOfficerIds[0],
    priority: "HIGH",
    createdAt: "2026-11-20T08:15:00.000Z",
    submittedAt: "2026-11-20T08:20:00.000Z",
    updatedAt: "2026-11-21T09:30:00.000Z",
  },
  [fixtureCases[1].caseId]: {
    id: fixtureCases[1].caseId,
    citizenId: "40000000-0000-4000-8000-000000000002",
    status: "SUBMITTED",
    version: 2,
    evidenceVersion: 2,
    relatedCaseId: null,
    assignedOfficerId: fixtureOfficerIds[0],
    priority: "NORMAL",
    createdAt: "2026-11-21T10:05:00.000Z",
    submittedAt: "2026-11-21T10:06:00.000Z",
    updatedAt: "2026-11-21T10:06:00.000Z",
  },
};

export const fixtureEvidence: Record<string, EvidenceItem[]> = {
  [fixtureCases[0].caseId]: [{
    id: "50000000-0000-4000-8000-000000000001",
    caseId: fixtureCases[0].caseId,
    kind: "CITIZEN_STATEMENT",
    content: { text: "Synthetic dispute statement: the notice was received but settlement details are missing." },
    supersedesId: null,
    actorId: "40000000-0000-4000-8000-000000000001",
    evidenceVersion: 3,
    createdAt: "2026-11-21T09:20:00.000Z",
  }],
};

export const fixtureDecisions: Record<string, CaseDecision[]> = {
  [fixtureCases[0].caseId]: [{
    id: "60000000-0000-4000-8000-000000000001",
    caseId: fixtureCases[0].caseId,
    actorId: fixtureOfficerIds[0],
    action: "REVIEW_STARTED",
    reason: null,
    previousOfficerId: fixtureOfficerIds[0],
    officerId: fixtureOfficerIds[0],
    previousDepartmentId: fixtureDepartmentId,
    departmentId: fixtureDepartmentId,
    previousStatus: "SUBMITTED",
    status: "UNDER_REVIEW",
    caseVersion: 3,
    evidenceVersion: 3,
    assessmentId: null,
    reviewedAssessmentId: null,
    ruleVersionId: null,
    createdAt: "2026-11-21T09:30:00.000Z",
  }],
};
