"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { Case } from "@/contracts/v1/case";
import type { CaseDecision } from "@/lib/staff-api";
import { z } from "zod";
import type { Assessment } from "@/contracts/v1";
import { EvidenceItemSchema } from "@/lib/case-contract";
import { createStaffApi, getStaffApiMode, isLiveAssessmentFresh, isLiveResolutionAvailable, StaffApiError } from "@/lib/staff-api";
import { fixtureCaseDetails, fixtureDecisions, fixtureEvidence } from "@/lib/staff-fixtures";

type EvidenceItem = z.infer<typeof EvidenceItemSchema>;

export default function OfficerCasePage() {
  const params = useParams<{ caseId: string }>();
  const caseId = params.caseId;
  const [caseItem, setCaseItem] = useState<Case | null>(null);
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [decisions, setDecisions] = useState<CaseDecision[]>([]);
  const [history, setHistory] = useState<unknown[]>([]);
  const [reason, setReason] = useState("");
  const [assessmentId, setAssessmentId] = useState("");
  const [assessmentEvidenceVersion, setAssessmentEvidenceVersion] = useState<number | null>(null);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const api = createStaffApi();
    Promise.all([
      api.getCase(caseId),
      api.getEvidence(caseId),
      api.getDecisions(caseId),
      api.getHistory(caseId),
    ]).then(([detail, evidenceResult, decisionResult, historyResult]) => {
      if (!active) return;
      if (api.mode === "fixture") {
        setCaseItem(detail ?? fixtureCaseDetails[caseId] ?? null);
        setEvidence(evidenceResult?.items ?? fixtureEvidence[caseId] ?? []);
        setDecisions(decisionResult?.items ?? fixtureDecisions[caseId] ?? []);
        setHistory(historyResult?.items ?? []);
      } else {
        setCaseItem(detail);
        setEvidence(evidenceResult?.items ?? []);
        setDecisions(decisionResult?.items ?? []);
        setHistory(historyResult?.items ?? []);
      }
      setAssessmentId("");
      setAssessmentEvidenceVersion(null);
      setAssessment(null);
    }).catch((cause) => active && setError(cause instanceof Error ? cause.message : "Case unavailable"))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [caseId]);

  async function transition(action: "start-review" | "request-evidence" | "escalate" | "close") {
    if (!caseItem) return;
    if (action === "request-evidence" && reason.trim().length === 0) {
      setError("Provide a meaningful evidence request reason.");
      return;
    }
    if (action === "escalate" && reason.trim().length === 0) {
      setError("Provide a meaningful escalation reason.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const api = createStaffApi();
      if (api.mode === "fixture") {
        const status = action === "start-review" ? "UNDER_REVIEW"
          : action === "request-evidence" ? "NEEDS_EVIDENCE"
          : action === "close" ? "CLOSED" : caseItem.status;
        setCaseItem({ ...caseItem, status, version: caseItem.version + 1 });
        setMessage(`Fixture-only ${action} applied. No live workflow mutation occurred.`);
      } else {
        const body = action === "start-review" || action === "close"
          ? { expectedVersion: caseItem.version }
          : { expectedVersion: caseItem.version, reason };
        const result = await api.mutate(action, caseId, body);
        setCaseItem(result.case);
        setAssessmentId("");
        setAssessmentEvidenceVersion(null);
        setAssessment(null);
        setMessage(`${action} completed.`);
      }
    } catch (cause) {
      setError(cause instanceof StaffApiError ? `${cause.code}: ${cause.messageKey}` : cause instanceof Error ? cause.message : "Workflow action failed");
    } finally {
      setBusy(false);
    }
  }

  async function createReviewedAssessment() {
    if (!caseItem) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const api = createStaffApi();
      if (api.mode === "fixture") {
        setAssessmentId("70000000-0000-4000-8000-000000000001");
        setAssessmentEvidenceVersion(caseItem.evidenceVersion);
        setAssessment(null);
        setMessage("Fixture demo: assessment ID selected for demonstration only.");
      } else {
        const assessment = await api.createAssessment(caseId, {
          expectedEvidenceVersion: caseItem.evidenceVersion,
          includeAi: false,
        });
        if (!assessment) throw new Error("ASSESSMENT_UNAVAILABLE: no authorized Assessment route result");
        setAssessmentId(assessment.id);
        setAssessmentEvidenceVersion(assessment.evidenceVersion);
        setAssessment(assessment);
        setMessage(`Authorized Assessment ${assessment.id.slice(0, 8)} created for evidence version ${assessment.evidenceVersion}.`);
      }
    } catch (cause) {
      setError(cause instanceof StaffApiError ? `${cause.code}: ${cause.messageKey}` : cause instanceof Error ? cause.message : "Assessment creation failed");
    } finally {
      setBusy(false);
    }
  }

  async function resolveCase() {
    if (!caseItem) return;
    if (reason.trim().length === 0) {
      setError("Resolution requires a written reason.");
      return;
    }
    if (!isLiveResolutionAvailable(getStaffApiMode(), assessmentId || null)
      || !isLiveAssessmentFresh(assessmentId || null, assessmentEvidenceVersion, caseItem.evidenceVersion)) {
      setError("Live resolution is unavailable until a fresh authorized Assessment is created for the current evidence.");
      return;
    }
    if (!window.confirm("Resolve this case? This does not approve payment or eligibility.")) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const api = createStaffApi();
      if (api.mode === "fixture") {
        setCaseItem({ ...caseItem, status: "RESOLVED", version: caseItem.version + 1 });
        setMessage("Fixture-only resolution applied. No live disposition or payment approval occurred.");
      } else {
        const result = await api.mutate("resolve", caseId, { expectedVersion: caseItem.version, reviewedAssessmentId: assessmentId, reason });
        setCaseItem(result.case);
        setMessage("Case resolved.");
      }
    } catch (cause) {
      setError(cause instanceof StaffApiError ? `${cause.code}: ${cause.messageKey}` : cause instanceof Error ? cause.message : "Resolution failed");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p role="status">Loading case...</p>;
  if (!caseItem) return <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-900" role="alert">Case not found or not authorized.</div>;

  return (
    <div className="space-y-5">
      <header><p className="text-sm text-slate-500">Case {caseId.slice(0, 8)}</p><h1 className="text-2xl font-semibold">Case review</h1></header>
      {error && <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-900" role="alert">{error}</div>}
      {message && <div className="rounded border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900" role="status">{message}</div>}
      <section className="grid gap-3 rounded border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div><span className="block text-xs text-slate-500">Status</span><strong>{caseItem.status}</strong></div>
        <div><span className="block text-xs text-slate-500">Priority</span><strong>{caseItem.priority}</strong></div>
        <div><span className="block text-xs text-slate-500">Case version</span><strong>{caseItem.version}</strong></div>
        <div><span className="block text-xs text-slate-500">Evidence version</span><strong>{caseItem.evidenceVersion}</strong></div>
      </section>
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <section className="rounded border border-slate-200 bg-white p-4">
            <h2 className="font-semibold">Evidence</h2>
            {evidence.length === 0 ? <p className="mt-2 text-sm text-slate-600">No evidence is available to this review grant.</p> : <ul className="mt-3 space-y-3">{evidence.map((item) => <li className="border-t pt-3 text-sm" key={item.id}><strong>{item.kind}</strong><p className="mt-1 whitespace-pre-wrap">{"text" in item.content ? item.content.text : item.content.noticeToken ?? item.content.messageText ?? ""}</p><p className="mt-1 text-xs text-slate-500">Evidence version {item.evidenceVersion}</p></li>)}</ul>}
          </section>
          <section className="rounded border border-slate-200 bg-white p-4">
            <h2 className="font-semibold">Latest assessment</h2>
            {!assessment ? (
              <p className="mt-2 text-sm text-slate-600">No authorized live Assessment is loaded for this evidence version. UNKNOWN findings remain unknown and are never converted into approval.</p>
            ) : (
              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <div><dt className="text-xs text-slate-500">Assessment</dt><dd>{assessment.id}</dd></div>
                <div><dt className="text-xs text-slate-500">Evidence version</dt><dd>{assessment.evidenceVersion}</dd></div>
                {(["signature", "expiry", "revocation", "recipientMatch", "payment", "eligibility"] as const).map((finding) => (
                  <div key={finding}><dt className="text-xs text-slate-500">{finding}</dt><dd>{assessment.findings[finding].result}</dd></div>
                ))}
              </dl>
            )}
          </section>
          <section className="rounded border border-slate-200 bg-white p-4">
            <h2 className="font-semibold">Case history</h2>
            {decisions.length === 0 && history.length === 0 ? <p className="mt-2 text-sm text-slate-600">No history available.</p> : <ul className="mt-3 space-y-2 text-sm">{decisions.map((item) => <li className="border-t pt-2" key={item.id}><strong>{item.action}</strong><span className="ml-2 text-slate-500">{item.status}</span>{item.reason && <p>{item.reason}</p>}</li>)}</ul>}
          </section>
        </div>
        <aside className="h-fit rounded border border-slate-200 bg-white p-4">
          <h2 className="font-semibold">Workflow actions</h2>
          <div className="mt-3 space-y-3">
            {caseItem.status === "SUBMITTED" && <button disabled={busy} className="w-full rounded bg-slate-900 px-3 py-2 text-sm text-white" onClick={() => transition("start-review")}>Start review</button>}
            {caseItem.status === "UNDER_REVIEW" && (
              <>
                <label className="block text-sm">Reason<textarea className="mt-1 min-h-20 w-full rounded border p-2" maxLength={2000} value={reason} onChange={(event) => setReason(event.target.value)} /></label>
                <button disabled={busy} className="w-full rounded border px-3 py-2 text-sm" onClick={() => transition("request-evidence")}>Request evidence</button>
                <button disabled={busy} className="mt-2 w-full rounded border px-3 py-2 text-sm" onClick={() => transition("escalate")}>Escalate</button>
                {getStaffApiMode() === "fixture" ? (
                  <button disabled={busy} className="mt-3 w-full rounded border px-3 py-2 text-sm" onClick={createReviewedAssessment}>Use fixture assessment</button>
                ) : (
                  <button disabled={busy} className="mt-3 w-full rounded border px-3 py-2 text-sm" onClick={createReviewedAssessment}>Create reviewed Assessment</button>
                )}
                {assessmentId && <p className="mt-2 text-xs text-slate-600">Reviewed Assessment: {assessmentId}</p>}
                {getStaffApiMode() === "fixture" ? (
                  <button disabled={busy || !assessmentId} className="mt-2 w-full rounded bg-slate-900 px-3 py-2 text-sm text-white" onClick={resolveCase}>Resolve fixture case</button>
                ) : (
                  <div>
                    <button disabled={busy || !assessmentId} className="mt-2 w-full rounded bg-slate-900 px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50" onClick={resolveCase}>Resolve with Assessment</button>
                    {!assessmentId && <p className="mt-2 text-xs text-slate-600">Live resolution is disabled until an authorized Assessment is created for the current evidence version.</p>}
                  </div>
                )}
              </>
            )}
            {caseItem.status === "RESOLVED" && <button disabled={busy} className="w-full rounded bg-slate-900 px-3 py-2 text-sm text-white" onClick={() => transition("close")}>Close resolved case</button>}
          </div>
        </aside>
      </div>
    </div>
  );
}
