import "server-only";
import type { NextRequest } from "next/server";
import { z } from "zod";
import type { AiAssessmentMetadata, Assessment } from "@/contracts/v1";
import { AuthFailure } from "@/backend/auth/principal";
import { audit, type Dependencies } from "@/backend/authorization/transaction";
import { withAuthorizedCase } from "@/backend/authorization/service";
import { authorize, type PolicyContext } from "@/backend/authorization/policy";
import { readBody } from "@/backend/consent/http";
import { assessForCase } from "@/backend/adapters/assessment-adapters";
import type { AssessmentOptions } from "@/backend/ai/assessment";
import { CreateAssessmentRequestSchema } from "@/lib/case-contract";
import { SANAD_AI_PROCESSOR_ID } from "@/lib/consent-contract";
import { assessmentRecord, captureAssessment, composeAssessment, notAuthorizedAi, persistAssessment } from "./assessments";
import { operationReplay, replayable } from "./idempotency";

export type AssessmentDependencies = Dependencies & { assessmentOptions?: AssessmentOptions };
const purposes = ["synthetic_helper_assistance", "synthetic_department_review", "synthetic_audit_review"];
function processingGrant(context: PolicyContext) {
  return purposes.map((purpose) => authorize(context, { action: "PROCESS_AI", purpose, processorId: SANAD_AI_PROCESSOR_ID }))
    .find((decision) => decision.allowed)?.authorizationRef;
}

/** Snapshot -> external work without locks -> fresh authentication/consent/version checks -> immutable write. */
export async function assessCase(request: NextRequest, caseId: string, requestId: string, dependencies: AssessmentDependencies): Promise<Assessment> {
  let input: z.infer<typeof CreateAssessmentRequestSchema>;
  let key: string;
  let requireAi = false;
  let originalProcessingGrant: string | undefined;
  const permission = { caseId, action: "REQUEST_ASSESSMENT" as const, purpose: purposes[0],
    alternativePurposes: purposes.slice(1), additionalActions: ["READ_EVIDENCE" as const] };
  const recheck = (context: PolicyContext) => {
    const current = processingGrant(context);
    if (requireAi && (!current || (originalProcessingGrant && !context.grants.some((grant) => grant.id === originalProcessingGrant &&
      grant.revokedAt === null && Date.parse(grant.expiresAt) > Date.parse(context.evaluatedAt))))) throw new AuthFailure("CONSENT_REQUIRED");
  };
  const initial = await withAuthorizedCase(request, permission, async (tx, context) => {
    const replay = await operationReplay<{ assessmentId: string }>(tx, caseId, "assess", key, input);
    if (replay) {
      const assessment = await assessmentRecord(tx, caseId, replay.result.assessmentId);
      requireAi = assessment.ai.status !== "NOT_AUTHORIZED";
      recheck(context);
      return { kind: "REPLAY" as const, assessment };
    }
    originalProcessingGrant = input.includeAi ? processingGrant(context) : undefined;
    requireAi = Boolean(originalProcessingGrant);
    if (requireAi) await audit(tx, "AI_PROCESSING_AUTHORIZED", "ALLOWED", caseId, originalProcessingGrant);
    return { kind: "SNAPSHOT" as const, snapshot: await captureAssessment(tx, caseId, input.expectedEvidenceVersion), aiAuthorized: requireAi };
  }, dependencies, { requestId, auditAction: "ASSESSMENT_SNAPSHOT", recheck, prepare: async () => {
    const parsed = CreateAssessmentRequestSchema.safeParse(await readBody(request, 65536));
    if (!parsed.success) throw new AuthFailure("VALIDATION_FAILED");
    input = parsed.data;
    const parsedKey = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/).safeParse(request.headers.get("idempotency-key"));
    if (!parsedKey.success) throw new AuthFailure("MALFORMED_REQUEST");
    key = parsedKey.data;
  } });
  if (initial.kind === "REPLAY") return initial.assessment;

  let ai: AiAssessmentMetadata = notAuthorizedAi;
  if (initial.aiAuthorized) {
    // Bound the entire input; never silently truncate, or send an old superseded draft.
    const message = initial.snapshot.items.map((item) => "messageText" in item.content ? item.content.messageText : "text" in item.content ? item.content.text : null)
      .filter((text): text is string => typeof text === "string" && text.trim().length > 0).join("\n");
    if (!message) ai = { ...notAuthorizedAi, status: "UNAVAILABLE", failureCode: "message_unavailable" };
    else {
      const result = await assessForCase(message, { ...dependencies.assessmentOptions,
        minRoutingConfidence: initial.snapshot.rule?.parameters.minRoutingConfidence ?? 0.8 });
      if (result.kind === "INVALID_INPUT") throw new AuthFailure("VALIDATION_FAILED");
      ai = result.metadata;
    }
  }

  return withAuthorizedCase(request, permission, async (tx, context) => {
    if (initial.aiAuthorized) recheck(context);
    const saved = await replayable(tx, caseId, "assess", key, input, async () => {
      const fresh = await captureAssessment(tx, caseId, input.expectedEvidenceVersion);
      if (fresh.fingerprint !== initial.snapshot.fingerprint) throw new AuthFailure("STALE_ASSESSMENT");
      const saved = await persistAssessment(tx, await composeAssessment(fresh, ai));
      if (initial.aiAuthorized) await audit(tx, "AI_ASSESSMENT_RECORDED", "ALLOWED", caseId, ai.runId ?? undefined);
      return saved;
    });
    const assessment = await assessmentRecord(tx, caseId, saved.assessmentId);
    requireAi = assessment.ai.status !== "NOT_AUTHORIZED";
    recheck(context);
    return assessment;
  }, dependencies, { requestId, auditAction: "ASSESSMENT_CREATED", recheck });
}
