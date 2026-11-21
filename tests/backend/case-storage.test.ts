import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
before(async () => {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    create table auth.sessions(id uuid primary key,user_id uuid,not_after timestamptz);`);
  for (const name of (await readdir("supabase/migrations")).sort()) await db.exec(await readFile("supabase/migrations/" + name, "utf8"));
});
after(async () => { await db.close(); });

test("private Case persistence denies direct access even under permissive Supabase roles", async () => {
  for (const role of ["anon", "authenticated", "service_role"]) {
    await db.exec(`set role ${role}`);
    try {
      for (const table of ["evidence_items", "assessments", "assessment_evidence", "assessment_sources", "case_events", "case_operation_keys", "case_inputs", "assessment_rule_bases", "rule_versions", "rule_publication", "case_decisions", "synthetic_program_inputs"]) {
        await assert.rejects(db.query(`select * from public.${table}`), { code: "42501" });
      }
    } finally { await db.exec("reset role"); }
  }
});

test("submitted input pointers cannot be changed or deleted underneath an Assessment", async () => {
  const owner = crypto.randomUUID();
  const caseId = crypto.randomUUID();
  await db.query("insert into auth.users values($1)", [owner]);
  await db.query("insert into public.profiles(id,active) values($1,true)", [owner]);
  await db.query("insert into public.case_reservations(id,citizen_id) values($1,$2)", [caseId, owner]);
  await db.query("insert into public.case_inputs(case_id) values($1)", [caseId]);
  await db.query("insert into public.cases(id,citizen_id,status) values($1,$2,'PENDING_CONSENT')", [caseId, owner]);
  await assert.rejects(db.query("update public.case_inputs set evidence_version=2 where case_id=$1", [caseId]), { code: "23514" });
  await assert.rejects(db.query("delete from public.case_inputs where case_id=$1", [caseId]), { code: "23514" });
});

test("database preserves immutable evidence and Assessment history, rejects cross-Case provenance and rolls back atomically", async () => {
  const owner = crypto.randomUUID();
  const caseId = crypto.randomUUID();
  const other = crypto.randomUUID();
  const evidence = crypto.randomUUID();
  const assessment = crypto.randomUUID();
  await db.query("insert into auth.users values($1)", [owner]);
  await db.query("insert into public.profiles(id,active) values($1,true)", [owner]);
  for (const target of [caseId, other]) await db.query("insert into public.case_reservations(id,citizen_id) values($1,$2)", [target, owner]);
  await db.query("insert into public.evidence_items(id,case_id,kind,content,actor_id,evidence_version) values($1,$2,'CITIZEN_STATEMENT','{\"text\":\"Synthetic statement\"}',$3,1)", [evidence, caseId, owner]);
  const rule = "b3000000-0000-4000-8000-000000000001";
  await db.query("insert into public.assessments(id,case_id,evidence_version,rule_version_id,assessed_at,record) values($1,$2,1,$3,now(),$4)",
    [assessment, caseId, rule, { id: assessment, caseId, evidenceVersion: 1, ruleVersionId: rule }]);
  await db.query("insert into public.assessment_evidence values($1,$2,$3)", [assessment, caseId, evidence]);
  await db.query("insert into public.assessment_sources values($1,0,'synthetic_identity',null,null,now())", [assessment]);
  await db.query("insert into public.case_events(case_id,action) values($1,'ASSESSMENT_CREATED')", [caseId]);
  for (const table of ["evidence_items", "assessments", "assessment_evidence", "assessment_sources", "case_events"]) {
    await assert.rejects(db.query(`delete from public.${table}`), { code: "23514" });
  }
  await assert.rejects(db.query("update public.evidence_items set content='{}'"), { code: "23514" });
  await assert.rejects(db.query("update public.assessments set record='{}'"), { code: "23514" });
  const foreignEvidence = crypto.randomUUID();
  await db.query("insert into public.evidence_items(id,case_id,kind,content,actor_id,evidence_version) values($1,$2,'CITIZEN_STATEMENT','{}',$3,1)", [foreignEvidence, other, owner]);
  await assert.rejects(db.query("insert into public.assessment_evidence values($1,$2,$3)", [assessment, caseId, foreignEvidence]), { code: "23503" });
  await db.exec("begin");
  await db.query("insert into public.evidence_items(case_id,kind,content,actor_id,evidence_version) values($1,'CITIZEN_STATEMENT','{}',$2,2)", [caseId, owner]);
  await db.exec("rollback");
  assert.equal((await db.query<{ count: number }>("select count(*)::int as count from public.evidence_items where case_id=$1", [caseId])).rows[0].count, 1);
});
