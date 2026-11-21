import "server-only";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { CaseSchema, IdSchema, type ConsentAction } from "@/contracts/v1";
import { AuthFailure } from "@/backend/auth/principal";
import { privateJson } from "@/backend/auth/session";
import { audit, inAuthorizationTransaction, type Dependencies, type Transaction } from "@/backend/authorization/transaction";
import { loadAuthorization, reconcileConsentStatus } from "@/backend/authorization/service";
import { authorize, type Permission } from "@/backend/authorization/policy";
import { errorJson, readBody } from "@/backend/consent/http";
import { addEvidence, evidenceRecord } from "./evidence";
import { AddEvidenceRequestSchema, SaveDraftRequestSchema, SubmitCaseRequestSchema, CreateAssessmentRequestSchema } from "@/lib/case-contract";
import { SANAD_AI_PROCESSOR_ID } from "@/lib/consent-contract";
import { replayable } from "./idempotency";
import { caseHistory } from "./history";
import { draftSnapshot, draftRecord, saveDraft, requireUnsubmitted } from "./drafts";
import { submitCase } from "./submission";
import { assessmentRecord, createAssessment, passportRecord } from "./assessments";

export async function caseRecord(tx: Transaction, caseId: string) {
  const { rows: [row] } = await tx.db.query("select * from public.cases where id=$1", [caseId]);
  if (!row) throw new AuthFailure("NOT_FOUND");
  return CaseSchema.parse({ id: row.id, citizenId: row.citizen_id, status: row.status, version: row.version,
    evidenceVersion: row.evidence_version, relatedCaseId: row.related_case_id, assignedOfficerId: row.assigned_officer_id,
    priority: row.priority, createdAt: new Date(row.created_at as string).toISOString(),
    submittedAt: new Date(row.submitted_at as string).toISOString(), updatedAt: new Date(row.updated_at as string).toISOString() });
}

async function checkPermission(tx: Transaction, caseId: string, action: ConsentAction) {
  const context = await loadAuthorization(tx, caseId).catch((error: unknown) => {
    if (error instanceof AuthFailure && error.code === "FORBIDDEN") throw new AuthFailure("CONSENT_REQUIRED");
    throw error;
  });
  // Evaluate complete server-selected paths; multiple roles never combine partial grants.
  const paths: Permission[] = ["synthetic_helper_assistance", "synthetic_department_review", "synthetic_audit_review"].map((purpose) => ({ action, purpose }));
  const decision = paths.map((permission) => authorize(context, permission)).find((candidate) => candidate.allowed);
  if (!decision) throw new AuthFailure("CONSENT_REQUIRED");
  return decision;
}

async function mayProcessAi(tx: Transaction, caseId: string) {
  const context = await loadAuthorization(tx, caseId);
  return ["synthetic_helper_assistance", "synthetic_department_review", "synthetic_audit_review"].some((purpose) =>
    authorize(context, { action: "PROCESS_AI", purpose, processorId: SANAD_AI_PROCESSOR_ID }).allowed);
}

export type CaseOperation = "detail" | "passport" | "evidence-add" | "history" | "draft-read" | "draft-save" | "submit" | "assess" | "trace";
const operations: Record<CaseOperation, { action: ConsentAction; audit: string; status: number }> = {
  detail: { action: "READ_CASE", audit: "CASE_READ", status: 200 },
  passport: { action: "READ_EVIDENCE", audit: "PASSPORT_READ", status: 200 },
  "evidence-add": { action: "ADD_EVIDENCE", audit: "EVIDENCE_ADDED", status: 201 },
  history: { action: "READ_CASE", audit: "CASE_HISTORY_READ", status: 200 },
  "draft-read": { action: "READ_EVIDENCE", audit: "DRAFT_READ", status: 200 },
  "draft-save": { action: "WRITE_DRAFT", audit: "DRAFT_SAVED", status: 200 },
  submit: { action: "SUBMIT_CASE", audit: "CASE_SUBMITTED", status: 201 },
  assess: { action: "REQUEST_ASSESSMENT", audit: "ASSESSMENT_CREATED", status: 201 },
  trace: { action: "READ_EVIDENCE", audit: "ASSESSMENT_READ", status: 200 },
};
export async function handleCase(request: NextRequest, operation: CaseOperation, caseId: string, dependencies: Dependencies = {}, targetAssessmentId?: string) {
  const requestId = crypto.randomUUID();
  let prepared: unknown;
  let key: string;
  const { action, audit: event, status } = operations[operation];
  try {
    const data = await inAuthorizationTransaction(request, requestId, event, async (tx) => {
      if (!IdSchema.safeParse(caseId).success) throw new AuthFailure("VALIDATION_FAILED");
      const decision = await checkPermission(tx, caseId, action);
      if (operation === "assess") await checkPermission(tx, caseId, "READ_EVIDENCE");
      await reconcileConsentStatus(tx, caseId);
      let result;
      let requireAi = false;
      if (operation === "draft-read") {
        await requireUnsubmitted(tx, caseId);
        result = await draftRecord(tx, await draftSnapshot(tx, caseId));
      } else if (operation === "draft-save") {
        const input = SaveDraftRequestSchema.parse(prepared);
        if (input.relatedCaseId) {
          const { rows: [related] } = await tx.db.query("select citizen_id from public.cases where id=$1", [input.relatedCaseId]);
          const snapshot = await draftSnapshot(tx, caseId);
          if (!related || related.citizen_id !== snapshot.citizenId) throw new AuthFailure("FORBIDDEN");
          await checkPermission(tx, input.relatedCaseId, "READ_CASE");
        }
        const snapshot = await replayable(tx, caseId, operation, key, prepared, () => saveDraft(tx, caseId, input));
        result = await draftRecord(tx, snapshot);
      } else if (operation === "assess") {
        const input = CreateAssessmentRequestSchema.parse(prepared);
        const aiAuthorized = input.includeAi && await mayProcessAi(tx, caseId);
        const saved = await replayable(tx, caseId, operation, key, prepared, () => createAssessment(tx, caseId, input.expectedEvidenceVersion, aiAuthorized));
        result = await assessmentRecord(tx, caseId, saved.assessmentId);
        requireAi = input.includeAi && result.ai.status !== "NOT_AUTHORIZED";
      } else if (operation === "submit") {
        const input = SubmitCaseRequestSchema.parse(prepared);
        result = await replayable(tx, caseId, operation, key, prepared, async () => {
          await submitCase(tx, caseId, input.expectedDraftVersion);
          await reconcileConsentStatus(tx, caseId);
          const record = await caseRecord(tx, caseId);
          await tx.db.query("insert into public.case_events(case_id,actor_id,action,case_version,evidence_version) values($1,$2,'CASE_SUBMITTED',$3,$4)",
            [caseId, tx.identity.principal.id, record.version, record.evidenceVersion]);
          return record;
        });
      } else if (operation === "history") result = await caseHistory(tx, caseId, request.nextUrl.searchParams);
      else if (operation === "evidence-add") {
        const saved = await replayable(tx, caseId, operation, key, prepared, () => addEvidence(tx, caseId, AddEvidenceRequestSchema.parse(prepared)));
        result = { evidence: await evidenceRecord(tx, caseId, saved.evidenceId), caseVersion: saved.caseVersion, evidenceVersion: saved.evidenceVersion };
      } else if (operation === "passport" || operation === "trace") {
        const assessmentId = operation === "trace" ? targetAssessmentId ?? "" : request.nextUrl.searchParams.get("assessmentId");
        if (assessmentId !== null && !IdSchema.safeParse(assessmentId).success) throw new AuthFailure("VALIDATION_FAILED");
        result = operation === "trace" ? await assessmentRecord(tx, caseId, assessmentId) : await passportRecord(tx, caseId, assessmentId);
      } else result = await caseRecord(tx, caseId);
      await checkPermission(tx, caseId, action);
      if (operation === "assess") await checkPermission(tx, caseId, "READ_EVIDENCE");
      if (requireAi && !await mayProcessAi(tx, caseId)) throw new AuthFailure("CONSENT_REQUIRED");
      await audit(tx, event, "ALLOWED", caseId, decision.authorizationRef);
      return result;
    }, dependencies, async () => {
      const schema = operation === "evidence-add" ? AddEvidenceRequestSchema : operation === "draft-save" ? SaveDraftRequestSchema : operation === "submit" ? SubmitCaseRequestSchema : operation === "assess" ? CreateAssessmentRequestSchema : null;
      if (!schema) return;
      const parsed = schema.safeParse(await readBody(request, 65536));
      if (!parsed.success) throw new AuthFailure("VALIDATION_FAILED");
      prepared = parsed.data;
      if (operation === "submit") caseId = SubmitCaseRequestSchema.parse(prepared).caseId;
      const parsedKey = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/).safeParse(request.headers.get("idempotency-key"));
      if (!parsedKey.success) throw new AuthFailure("MALFORMED_REQUEST");
      key = parsedKey.data;
    });
    return privateJson({ data, requestId }, status);
  } catch (error) { return errorJson(error, requestId); }
}
