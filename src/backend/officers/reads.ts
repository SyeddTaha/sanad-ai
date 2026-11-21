import "server-only";
import type { NextRequest } from "next/server";
import { IdSchema } from "@/contracts/v1";
import { AuthFailure } from "@/backend/auth/principal";
import { privateJson } from "@/backend/auth/session";
import { withAuthorizedCase } from "@/backend/authorization/service";
import { audit,inAuthorizationTransaction,type Dependencies } from "@/backend/authorization/transaction";
import { errorJson } from "@/backend/consent/http";
import { evidenceRecord } from "@/backend/cases/evidence";
import { AuditMetadataSchema, CaseDecisionSchema, SyntheticProgramInputSchema } from "@/lib/officer-contract";
import { page,pageOptions } from "./pagination";

export async function handleCaseRecords(request:NextRequest,kind:"evidence"|"decisions"|"program-inputs",caseId:string,dependencies:Dependencies={}) {
  const requestId=crypto.randomUUID();
  try {
    const data=await withAuthorizedCase(request,{caseId,action:"READ_EVIDENCE",purpose:"synthetic_department_review",
      alternativePurposes:["synthetic_helper_assistance","synthetic_audit_review"]},async (tx)=>{
      const {cursor,limit}=pageOptions(request.nextUrl.searchParams);
      if (kind==="program-inputs") {
        const {rows}=await tx.db.query("select * from public.synthetic_program_inputs where case_id=$1 and ($2::uuid is null or id>$2) order by id limit $3",[caseId,cursor,limit+1]);
        return page(rows.map((row)=>SyntheticProgramInputSchema.parse({id:row.id,caseId:row.case_id,version:row.version,source:"SYNTHETIC_DEMO",
          recipientMatch:row.recipient_match,enrollment:row.enrollment,monthlyIncomeMinor:row.monthly_income_minor===null ? null : Number(row.monthly_income_minor),recordedBy:row.recorded_by,recordedAt:new Date(row.recorded_at as string).toISOString()})),limit);
      }
      if (kind==="evidence") {
        const {rows}=await tx.db.query("select id from public.evidence_items where case_id=$1 and ($2::uuid is null or id>$2) order by id limit $3",[caseId,cursor,limit+1]);
        const items=[];
        for (const row of rows) items.push(await evidenceRecord(tx,caseId,String(row.id)));
        return page(items,limit);
      }
      const {rows}=await tx.db.query("select * from public.case_decisions where case_id=$1 and ($2::uuid is null or id>$2) order by id limit $3",[caseId,cursor,limit+1]);
      return page(rows.map((row)=>CaseDecisionSchema.parse({id:row.id,caseId:row.case_id,actorId:row.actor_id,action:row.action,reason:row.reason,
        previousOfficerId:row.previous_officer_id,officerId:row.officer_id,previousDepartmentId:row.previous_department_id,departmentId:row.department_id,
        previousStatus:row.previous_status,status:row.status,caseVersion:row.case_version,evidenceVersion:row.evidence_version,
        assessmentId:row.assessment_id,reviewedAssessmentId:row.reviewed_assessment_id,ruleVersionId:row.rule_version_id,createdAt:new Date(row.created_at as string).toISOString()})),limit);
    },dependencies,{requestId,auditAction:kind==="evidence" ? "EVIDENCE_READ" : kind==="program-inputs" ? "PROGRAM_INPUTS_READ" : "DECISIONS_READ"});
    return privateJson({data,requestId});
  } catch (error) {return errorJson(error,requestId);}
}

export async function handleAudit(request:NextRequest,caseId:string,dependencies:Dependencies={}) {
  const requestId=crypto.randomUUID();
  try {
    const data=await inAuthorizationTransaction(request,requestId,"AUDIT_READ",async (tx)=>{
      if (!tx.identity.principal.roles.includes("AUDITOR")) throw new AuthFailure("FORBIDDEN");
      if (!IdSchema.safeParse(caseId).success) throw new AuthFailure("VALIDATION_FAILED");
      const {cursor,limit}=pageOptions(request.nextUrl.searchParams);
      const {rows}=await tx.db.query(`select id,request_id,actor_id,action,outcome,target_id,authorization_ref,created_at from public.audit_events
        where target_id=$1 and ($2::uuid is null or id>$2) order by id limit $3`,[caseId,cursor,limit+1]);
      await audit(tx,"AUDIT_READ","ALLOWED",caseId);
      return page(rows.map((row)=>AuditMetadataSchema.parse({id:row.id,requestId:row.request_id,actorId:row.actor_id,action:row.action,outcome:row.outcome,
        targetId:row.target_id,authorizationRef:row.authorization_ref,createdAt:new Date(row.created_at as string).toISOString()})),limit);
    },dependencies);
    return privateJson({data,requestId});
  } catch(error) {return errorJson(error,requestId);}
}
