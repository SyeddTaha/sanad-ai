import "server-only";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { CaseStatusSchema, ResolveCaseRequestSchema } from "@/contracts/v1";
import { AuthFailure } from "@/backend/auth/principal";
import { privateJson } from "@/backend/auth/session";
import { authorize, type Permission } from "@/backend/authorization/policy";
import { hasDepartmentSharing,loadCaseAuthorizations, reconcileConsentStatus, withAuthorizedCase } from "@/backend/authorization/service";
import { audit, inAuthorizationTransaction, type Dependencies } from "@/backend/authorization/transaction";
import { errorJson, readBody } from "@/backend/consent/http";
import { AssignCaseRequestSchema, CaseVersionRequestSchema, OfficerReasonRequestSchema, SetPriorityRequestSchema, DispatchItemSchema } from "@/lib/officer-contract";
import { replayable } from "@/backend/cases/idempotency";
import { caseRecord } from "@/backend/cases/http";
import { lockedCase, recordDecision } from "./workflow";
import { resolveCase } from "./resolution";
import { pageOptions } from "./pagination";

type OfficerOperation = "assign" | "priority" | "start-review" | "resolve" | "request-evidence" | "escalate" | "close" | "resubmit";
const actions = {
  assign: {action:"ASSIGN_CASE",event:"CASE_ASSIGNED",schema:AssignCaseRequestSchema},
  priority: {action:"ASSIGN_CASE",event:"PRIORITY_CHANGED",schema:SetPriorityRequestSchema},
  "start-review": {action:"REVIEW_CASE",event:"REVIEW_STARTED",schema:CaseVersionRequestSchema},
  resolve: {action:"RESOLVE_CASE",event:"CASE_RESOLVED",schema:ResolveCaseRequestSchema},
  "request-evidence": {action:"REVIEW_CASE",event:"EVIDENCE_REQUESTED",schema:OfficerReasonRequestSchema},
  escalate: {action:"ESCALATE_CASE",event:"CASE_ESCALATED",schema:OfficerReasonRequestSchema},
  close: {action:"CLOSE_CASE",event:"CASE_CLOSED",schema:CaseVersionRequestSchema},
  resubmit: {action:"SUBMIT_CASE",event:"CASE_RESUBMITTED",schema:CaseVersionRequestSchema},
} as const;
export async function handleOfficerAction(request: NextRequest, operation: OfficerOperation, caseId: string, dependencies: Dependencies = {}) {
  const requestId = crypto.randomUUID();
  let input: z.infer<typeof AssignCaseRequestSchema> | z.infer<typeof CaseVersionRequestSchema> | z.infer<typeof ResolveCaseRequestSchema>;
  let key: string;
  const permission: Permission & { caseId: string; additionalActions?: ("READ_EVIDENCE" | "REQUEST_ASSESSMENT")[] } = { caseId,
    action: actions[operation].action, purpose: operation === "resubmit" ? "synthetic_helper_assistance" : "synthetic_department_review",
    additionalActions: operation === "resolve" ? ["READ_EVIDENCE","REQUEST_ASSESSMENT"] : [] };
  const event = actions[operation].event;
  try {
    const data = await withAuthorizedCase(request, permission, async (tx) => replayable(tx, caseId, operation, key, input, async () => {
      const previous = await lockedCase(tx, caseId, input.expectedVersion);
      if (operation === "resolve") return resolveCase(tx,previous,ResolveCaseRequestSchema.parse(input));
      if (operation === "assign" || operation === "priority") {
        if (["PENDING_CONSENT","RESOLVED","CLOSED"].includes(String(previous.status))) throw new AuthFailure("INVALID_TRANSITION");
        if (operation === "priority") {
          const priority=SetPriorityRequestSchema.parse(input);
          if (previous.assigned_department_id && previous.assigned_department_id !== priority.departmentId) throw new AuthFailure("FORBIDDEN");
          await tx.db.query("update public.cases set priority=$2 where id=$1",[caseId,priority.priority]);
        } else {
        const assignment = AssignCaseRequestSchema.parse(input);
        const { rows } = await tx.db.query(`select p.id from public.profiles p join public.role_assignments r on r.profile_id=p.id
          join public.department_memberships m on m.profile_id=p.id where p.id=$1 and p.active and r.role='OFFICER' and m.department_id=$2`, [assignment.officerId,assignment.departmentId]);
        if (!rows.length) throw new AuthFailure("FORBIDDEN");
        await tx.db.query("update public.cases set assigned_officer_id=$2,assigned_department_id=$3 where id=$1", [caseId, assignment.officerId, assignment.departmentId]);
        }
        await recordDecision(tx, previous, event, "reason" in input ? String(input.reason) : null);
        const { rows: [record] } = await tx.db.query("select * from public.cases where id=$1", [caseId]);
        return DispatchItemSchema.parse({ caseId,departmentId: record.assigned_department_id ?? permission.departmentId,assignedOfficerId:record.assigned_officer_id,
          status:record.status,priority:record.priority,version:record.version,createdAt:new Date(record.created_at as string).toISOString(),updatedAt:new Date(record.updated_at as string).toISOString() });
      }
      const required = operation === "start-review" ? "SUBMITTED" : operation === "close" ? "RESOLVED" : operation === "resubmit" ? "NEEDS_EVIDENCE" : "UNDER_REVIEW";
      if (operation === "escalate") {
        if (!["SUBMITTED","UNDER_REVIEW","NEEDS_EVIDENCE"].includes(String(previous.status))) throw new AuthFailure("INVALID_TRANSITION");
        await tx.db.query("update public.cases set priority='HIGH' where id=$1",[caseId]);
      } else {
        if (previous.status !== required) throw new AuthFailure("INVALID_TRANSITION");
        if (operation === "resubmit") {
          const { rows: [requested] } = await tx.db.query("select evidence_version from public.case_decisions where case_id=$1 and action='EVIDENCE_REQUESTED' order by case_version desc limit 1",[caseId]);
          if (!requested || Number(previous.evidence_version)<=Number(requested.evidence_version)) throw new AuthFailure("INVALID_TRANSITION");
        }
        const status = operation === "start-review" ? "UNDER_REVIEW" : operation === "close" ? "CLOSED" : operation === "resubmit" ? "SUBMITTED" : "NEEDS_EVIDENCE";
        await tx.db.query("update public.cases set status=$2 where id=$1", [caseId,status]);
      }
      await recordDecision(tx, previous, event, "reason" in input ? String(input.reason) : null);
      return { case: await caseRecord(tx, caseId) };
    }), dependencies, { requestId, auditAction:event, recheck:(context)=>{
      if ((operation==="resubmit" || operation==="resolve") && !hasDepartmentSharing(context)) throw new AuthFailure("CONSENT_REQUIRED");
    },prepare:async () => {
      const parsed = actions[operation].schema.safeParse(await readBody(request));
      if (!parsed.success) throw new AuthFailure("VALIDATION_FAILED");
      input=parsed.data;
      if ((operation === "assign" || operation === "priority") && "departmentId" in input) permission.departmentId=String(input.departmentId);
      const parsedKey = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/).safeParse(request.headers.get("idempotency-key"));
      if (!parsedKey.success) throw new AuthFailure("MALFORMED_REQUEST");
      key=parsedKey.data;
    } });
    return privateJson({data,requestId});
  } catch (error) { return errorJson(error,requestId); }
}

export async function handleStaffQueue(request: NextRequest, kind: "officer" | "dispatch", dependencies: Dependencies = {}) {
  const requestId = crypto.randomUUID();
  try {
    const data = await inAuthorizationTransaction(request, requestId, "STAFF_QUEUE_READ", async (tx) => {
      if (!tx.identity.principal.roles.includes(kind === "officer" ? "OFFICER" : "ADMIN")) throw new AuthFailure("FORBIDDEN");
      const {cursor,limit}=pageOptions(request.nextUrl.searchParams);
      const sort=request.nextUrl.searchParams.get("sort") ?? "priority";
      const status=request.nextUrl.searchParams.get("status");
      if (!["priority","oldest",...(kind==="officer" ? ["confidence"] : [])].includes(sort) || (status!==null && !CaseStatusSchema.safeParse(status).success)) throw new AuthFailure("VALIDATION_FAILED");
      // These SQL fragments come exclusively from this finite server map.
      const confidence=(alias:string)=>`coalesce((select (a.record#>>'{ai,confidence}')::numeric from public.assessments a where a.case_id=${alias}.id order by a.assessed_at desc,a.id desc limit 1),-1)`;
      const order=(alias:string)=>sort==="oldest" ? `${alias}.submitted_at,${alias}.id` : sort==="confidence" ? `${confidence(alias)},${alias}.priority,${alias}.submitted_at,${alias}.id` : `${alias}.priority,${kind==="officer" ? confidence(alias)+"," : ""}${alias}.submitted_at,${alias}.id`;
      const action = kind === "officer" ? "READ_CASE" : "ASSIGN_CASE";
      const { rows } = await tx.db.query(`select c.id,${kind==="officer" ? confidence("c") : "null"} as confidence from public.cases c where
        ($1='dispatch' or c.assigned_officer_id=$2) and exists (
          select 1 from public.consent_grants g where g.case_id=c.id and g.recipient_type='DEPARTMENT'
          and g.purpose='synthetic_department_review' and g.recipient_id=any($3::uuid[])
          and ($1='dispatch' or g.recipient_id=c.assigned_department_id)
          and g.revoked_at is null and g.created_at<=clock_timestamp() and g.expires_at>clock_timestamp()
          and $4::public.sanad_consent_action=any(g.actions))
        and ($5::uuid is null or (${order("c")})>(select ${order("x")} from public.cases x where x.id=$5))
        and ($7::text is null or c.status=$7)
        order by ${order("c")} limit $6`, [kind, tx.identity.principal.id, tx.identity.departmentIds, action, cursor, limit + 1,status]);
      const permission = { action: action as "READ_CASE" | "ASSIGN_CASE", purpose: "synthetic_department_review" };
      const snapshots=await loadCaseAuthorizations(tx,rows.map(row=>String(row.id)));
      for (const {context,record} of snapshots) {
        if (!record || !authorize(context,permission).allowed || ["RESOLVED","CLOSED"].includes(String(record.status))) continue;
        const desired=hasDepartmentSharing(context) ? (record.status==="PENDING_CONSENT" ? "SUBMITTED" : record.status) : "PENDING_CONSENT";
        if (desired!==record.status) await reconcileConsentStatus(tx,context.target.caseId);
      }
      const items = [];
      const fresh=await loadCaseAuthorizations(tx,rows.map(row=>String(row.id)));
      const confidenceById=new Map(rows.map(row=>[String(row.id),Number(row.confidence)]));
      for (const {context,record} of fresh) {
        if (!record) continue;
        const decision=authorize(context,permission);
        if (!decision.allowed) continue;
        const caseId=context.target.caseId;
        const grant = context.grants.find((grant) => grant.id === decision.authorizationRef)!;
        const item=DispatchItemSchema.parse({ caseId, departmentId: grant.recipientId, assignedOfficerId: record.assigned_officer_id,
          status: record.status, priority: record.priority, version: record.version,
          createdAt: new Date(record.created_at as string).toISOString(), updatedAt: new Date(record.updated_at as string).toISOString() });
        items.push(kind==="officer" ? {...item,confidence:confidenceById.get(caseId)!<0 ? null : confidenceById.get(caseId)!} : item);
      }
      const rank=new Map(rows.map((row,index)=>[String(row.id),index]));
      items.sort((a,b) => rank.get(a.caseId)!-rank.get(b.caseId)!);
      await audit(tx, "STAFF_QUEUE_READ");
      return { items: items.slice(0,limit), nextCursor: items.length>limit ? items[limit-1].caseId : null };
    }, dependencies);
    return privateJson({ data, requestId });
  } catch (error) { return errorJson(error, requestId); }
}
