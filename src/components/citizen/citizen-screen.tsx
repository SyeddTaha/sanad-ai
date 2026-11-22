"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { CaseStatus } from "@/contracts/v1/case";
import { citizenText, useCitizenLanguage } from "./citizen-language";
import type { CitizenMessageKey } from "./citizen-copy";
import { syntheticCitizenViewAdapter } from "./citizen-view-adapter";
import { CitizenAudioControl } from "./citizen-audio-control";
import { useCitizenSession } from "./citizen-session";
import { citizenApi, CitizenApiError } from "./citizen-api";
import type { Case } from "@/contracts/v1/case";
import type { ConsentGrant } from "@/contracts/v1/consent";
import type { CaseDraft } from "@/lib/case-contract";
import type { EvidencePassport } from "@/contracts/v1/assessment";
import type { CitizenAudioTopic } from "./citizen-narration";
import { formatEvidenceFindings } from "./citizen-evidence";

export type CitizenScreenName = "home" | "verify" | "results" | "dispute" | "case" | "consent";

function PageIntro({
  eyebrow,
  title,
  description,
  audioTopic,
}: {
  eyebrow: string;
  title: string;
  description: string;
  audioTopic: CitizenAudioTopic;
}) {
  return (
    <div className="citizen-page-intro">
      <p className="citizen-eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p>{description}</p>
      <CitizenAudioControl topic={audioTopic} />
    </div>
  );
}

function FindingRow({
  titleKey,
  descriptionKey,
  status,
}: {
  titleKey: CitizenMessageKey;
  descriptionKey: CitizenMessageKey;
  status: "UNKNOWN";
}) {
  const { language } = useCitizenLanguage();
  return (
    <article className="citizen-finding-row">
      <div className="citizen-finding-copy">
        <h3>{citizenText(language, titleKey)}</h3>
        <p>{citizenText(language, descriptionKey)}</p>
      </div>
      <span className={`citizen-state citizen-state-${status.toLowerCase()}`}>
        {citizenText(language, "unknown")}
      </span>
      <p className="citizen-finding-source">{citizenText(language, "noSource")}</p>
    </article>
  );
}

function HomeScreen() {
  const { language } = useCitizenLanguage();
  const text = (key: CitizenMessageKey) => citizenText(language, key);
  const casePreview = syntheticCitizenViewAdapter.getCasePreview();

  return (
    <main className="citizen-main" id="main-content">
      <section aria-labelledby="citizen-home-title" className="citizen-hero">
        <div className="citizen-hero-copy">
          <p className="citizen-eyebrow">{text("heroLabel")}</p>
          <h1 id="citizen-home-title">{text("homeTitle")}</h1>
          <p className="citizen-hero-description">{text("homeIntro")}</p>
          <CitizenAudioControl topic="welcome" />
          <p className="citizen-hero-question">{text("heroQuestion")}</p>
          <div className="citizen-actions">
            <Link className="citizen-button citizen-button-primary" href="/citizen/verify">
              {text("verifyAction")}
            </Link>
            <Link className="citizen-button citizen-button-outline" href="/citizen/case">
              {text("trackAction")}
            </Link>
          </div>
        </div>
        <div aria-hidden="true" className="citizen-hero-slip">
          <span className="citizen-slip-rule" />
          <span className="citizen-slip-title">سَنَد</span>
          <span className="citizen-slip-caption">{text("subtitle")}</span>
          <span className="citizen-slip-status">{text("unknown")}</span>
        </div>
      </section>

      <section aria-labelledby="citizen-guidance-title" className="citizen-section">
        <div className="citizen-section-heading">
          <h2 id="citizen-guidance-title">{text("guidanceTitle")}</h2>
        </div>
        <div className="citizen-guidance-list">
          {([
            ["authenticityTitle", "authenticityUnknown"],
            ["paymentTitle", "paymentUnknown"],
            ["eligibilityTitle", "eligibilityUnknown"],
          ] as const).map(([titleKey, descriptionKey], index) => (
            <article className="citizen-guidance-row" key={titleKey}>
              <span className="citizen-guidance-index" aria-hidden="true">{index + 1}</span>
              <h3>{text(titleKey)}</h3>
              <p>{text(descriptionKey)}</p>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="citizen-sample-case-title" className="citizen-sample-case">
        <div>
          <p className="citizen-eyebrow">{text("demoCaseTitle")}</p>
          <h2 id="citizen-sample-case-title">{casePreview.reference}</h2>
          <p>{text(caseStatusCopy[casePreview.status])}</p>
        </div>
        <Link className="citizen-text-link" href="/citizen/case">{text("viewCase")}</Link>
      </section>
    </main>
  );
}

function VerifyScreen() {
  const { language } = useCitizenLanguage();
  const { coordinator } = useCitizenSession();
  const text = (key: CitizenMessageKey) => citizenText(language, key);
  const [notice, setNotice] = useState("");
  const [state, setState] = useState<"idle" | "empty" | "disconnected">("idle");

  useEffect(() => coordinator.registerPrivateStateClearer(() => {
    setNotice("");
    setState("idle");
  }), [coordinator]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState(notice.trim() ? "disconnected" : "empty");
  }

  return (
    <main className="citizen-main" id="main-content">
      <PageIntro audioTopic="notice" eyebrow={text("navVerify")} title={text("verifyHeading")} description={text("verifyCopy")} />
      <div className="citizen-content-narrow">
        <form className="citizen-form" onSubmit={handleSubmit}>
          <label htmlFor="citizen-notice">{text("noticeField")}</label>
          <textarea
            autoComplete="off"
            id="citizen-notice"
            aria-describedby="notice-help"
            maxLength={16384}
            onChange={(event) => {
              setNotice(event.target.value);
              setState("idle");
            }}
            rows={7}
            value={notice}
          />
          <p className="citizen-field-help" id="notice-help">{text("noticeFieldHelp")}</p>
          <div aria-live="assertive" className="citizen-form-message" role={state === "idle" ? undefined : "alert"}>
            {state === "empty" ? text("emptyNotice") : null}
            {state === "disconnected" ? text("unavailableNotice") : null}
          </div>
          <button className="citizen-button citizen-button-primary" type="submit">{text("checkNotice")}</button>
        </form>

        <aside aria-labelledby="citizen-qr-title" className="citizen-future-feature">
          <h2 id="citizen-qr-title">{text("qrHeading")}</h2>
          <p>{text("qrCopy")}</p>
        </aside>
        <Link className="citizen-text-link" href="/citizen/results">{text("openSampleResults")}</Link>
      </div>
    </main>
  );
}

function ResultsScreen() {
  const { language } = useCitizenLanguage();
  const text = (key: CitizenMessageKey) => citizenText(language, key);

  return (
    <main className="citizen-main" id="main-content">
      <PageIntro audioTopic="evidence" eyebrow={text("passportTitle")} title={text("resultsHeading")} description={text("resultsCopy")} />
      <section aria-label={text("resultsHeading")} className="citizen-evidence-passport">
        {syntheticCitizenViewAdapter.getEvidenceFindings().map(({ key, status }) => {
          const copyByFinding = {
            authenticity: ["authenticityFinding", "authenticityFindingDetail"],
            payment: ["paymentFinding", "paymentFindingDetail"],
            eligibility: ["eligibilityFinding", "eligibilityFindingDetail"],
          } as const;
          const [titleKey, descriptionKey] = copyByFinding[key];
          return (
            <FindingRow
              descriptionKey={descriptionKey}
              key={key}
              status={status}
              titleKey={titleKey}
            />
          );
        })}
      </section>
      <p className="citizen-caution-note">{text("evidenceImportant")}</p>
      <Link className="citizen-button citizen-button-primary" href="/citizen/dispute">{text("openDispute")}</Link>
    </main>
  );
}

function SubmissionStates() {
  const { language } = useCitizenLanguage();
  const text = (key: CitizenMessageKey) => citizenText(language, key);
  const states: CitizenMessageKey[] = ["unsentState", "savingState", "savedState", "failedState"];

  return (
    <aside aria-label={text("privacyNotice")} className="citizen-submit-states">
      <h2>{text("currentStatus")}</h2>
      <ul>
        {states.map((key, index) => (
          <li aria-current={index === 0 ? "step" : undefined} key={key}>
            <span className={`citizen-state-dot citizen-state-dot-${index}`} aria-hidden="true" />
            {text(key)}
          </li>
        ))}
      </ul>
    </aside>
  );
}

function DisputeScreen() {
  const { language } = useCitizenLanguage();
  const { coordinator, mutationKeys } = useCitizenSession();
  const text = (key: CitizenMessageKey) => citizenText(language, key);
  const [reason, setReason] = useState("");
  const [evidence, setEvidence] = useState("");
  const [caseId, setCaseId] = useState("");
  const [draft, setDraft] = useState<CaseDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [liveMessage, setLiveMessage] = useState("");

  useEffect(() => coordinator.registerPrivateStateClearer(() => {
    setReason("");
    setEvidence("");
    setCaseId("");
    setDraft(null);
    setLiveMessage("");
  }), [coordinator]);
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setLiveMessage("");
    try {
      await citizenApi.getSession();
      let currentDraft = draft;
      if (!currentDraft) {
        if (!caseId) {
          const created = await coordinator.runRequest((signal) => citizenApi.createDraft(mutationKeys, signal));
          if (created.status === "stale") return;
          setCaseId(created.value.data.caseId);
          currentDraft = await coordinator.runRequest((signal) => citizenApi.getDraft(created.value.data.caseId, signal)).then((result) =>
            result.status === "current" ? result.value : null,
          );
          if (!currentDraft) return;
        } else {
          currentDraft = await coordinator.runRequest((signal) => citizenApi.getDraft(caseId, signal)).then((result) =>
            result.status === "current" ? result.value : null,
          );
          if (!currentDraft) throw new CitizenApiError("NOT_FOUND");
        }
      }
      const saved = await coordinator.runRequest((signal) => citizenApi.saveDraft(
        currentDraft!.caseId,
        {
          expectedVersion: currentDraft!.version,
          noticeToken: null,
          messageText: reason,
          disputeText: evidence.trim() ? evidence : null,
          relatedCaseId: null,
        },
        mutationKeys,
        signal,
      ));
      if (saved.status === "stale") return;
      saved.value.retire();
      setDraft(saved.value.data);
      setCaseId(saved.value.data.caseId);

      const submittedCase = await coordinator.runRequest((signal) => citizenApi.submitCase(
        saved.value.data.caseId,
        saved.value.data.version,
        mutationKeys,
        signal,
      ));
      if (submittedCase.status === "stale") return;
      submittedCase.value.retire();
      setLiveMessage(`${language === "ur" ? "کیس جمع ہو گیا" : "Case submitted"}: ${submittedCase.value.data.id}`);
    } catch (error) {
      setLiveMessage(error instanceof CitizenApiError
        ? `${language === "ur" ? "خرابی" : "Error"}: ${error.code}`
        : text("failedState"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="citizen-main" id="main-content">
      <PageIntro audioTopic="dispute" eyebrow={text("navTrack")} title={text("disputeHeading")} description={text("disputeCopy")} />
      <div className="citizen-form-layout">
        <form className="citizen-form" onSubmit={handleSubmit}>
          <label htmlFor="citizen-case-id">{language === "ur" ? "کیس آئی ڈی (اختیاری، موجودہ ڈرافٹ دوبارہ کھولنے کے لیے)" : "Case ID (optional, to recover an existing draft)"}</label>
          <input
            id="citizen-case-id"
            onChange={(event) => setCaseId(event.target.value)}
            placeholder={language === "ur" ? "UUID" : "UUID"}
            value={caseId}
          />
          <label htmlFor="citizen-reason">{text("reasonLabel")}</label>
          <textarea
            aria-describedby="reason-help"
            id="citizen-reason"
            maxLength={2000}
            onChange={(event) => setReason(event.target.value)}
            required
            rows={4}
            value={reason}
          />
          <p className="citizen-field-help" id="reason-help">{text("reasonHelp")}</p>
          <label htmlFor="citizen-evidence">
            {text("evidenceLabel")} <span className="citizen-optional">({text("optional")})</span>
          </label>
          <textarea
            aria-describedby="evidence-help"
            id="citizen-evidence"
            maxLength={2000}
            onChange={(event) => setEvidence(event.target.value)}
            rows={4}
            value={evidence}
          />
          <p className="citizen-field-help" id="evidence-help">{text("evidenceHelp")}</p>
          <p className="citizen-privacy-note">{text("privacyNotice")}</p>
          <button className="citizen-button citizen-button-primary" disabled={busy} type="submit">{busy ? text("savingState") : text("submitDispute")}</button>
          {liveMessage ? <p aria-live="polite" role="status">{liveMessage}</p> : null}
        </form>
        <SubmissionStates />
      </div>
    </main>
  );
}

const caseSteps: { key: CitizenMessageKey; status: CaseStatus }[] = [
  { key: "statusSubmitted", status: "SUBMITTED" },
  { key: "statusReview", status: "UNDER_REVIEW" },
  { key: "statusResolved", status: "RESOLVED" },
  { key: "statusClosed", status: "CLOSED" },
];

const caseStatusCopy: Record<CaseStatus, CitizenMessageKey> = {
  SUBMITTED: "statusSubmitted",
  UNDER_REVIEW: "statusReview",
  NEEDS_EVIDENCE: "statusNeedEvidence",
  PENDING_CONSENT: "statusPendingConsent",
  RESOLVED: "statusResolved",
  CLOSED: "statusClosed",
};

function CaseScreen() {
  const { language } = useCitizenLanguage();
  const { coordinator, mutationKeys } = useCitizenSession();
  const text = (key: CitizenMessageKey) => citizenText(language, key);
  const casePreview = syntheticCitizenViewAdapter.getCasePreview();
  const [caseId, setCaseId] = useState("");
  const [caseItem, setCaseItem] = useState<Case | null>(null);
  const [history, setHistory] = useState<{ id: string; action: string; createdAt: string }[]>([]);
  const [passport, setPassport] = useState<EvidencePassport | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => coordinator.registerPrivateStateClearer(() => {
    setCaseId("");
    setCaseItem(null);
    setHistory([]);
    setPassport(null);
    setMessage("");
  }), [coordinator]);

  async function loadCase() {
    setBusy(true);
    setMessage("");
    try {
      await citizenApi.getSession();
      const [detail, events] = await Promise.all([
        coordinator.runRequest((signal) => citizenApi.getCase(caseId, signal)),
        coordinator.runRequest((signal) => citizenApi.getHistory(caseId, null, signal)),
      ]);
      if (detail.status !== "current" || events.status !== "current") return;
      let evidence: EvidencePassport;
      try {
        const existing = await coordinator.runRequest((signal) => citizenApi.getEvidencePassport(caseId, signal));
        if (existing.status !== "current") return;
        evidence = existing.value;
      } catch (error) {
        if (!(error instanceof CitizenApiError) || error.code !== "NOT_FOUND") throw error;
        const assessment = await coordinator.runRequest((signal) => citizenApi.createAssessment(
          caseId,
          detail.value.evidenceVersion,
          false,
          mutationKeys,
          signal,
        ));
        if (assessment.status !== "current") return;
        assessment.value.retire();
        const generated = await coordinator.runRequest((signal) => citizenApi.getEvidencePassport(caseId, signal));
        if (generated.status !== "current") return;
        evidence = generated.value;
      }
      setCaseItem(detail.value);
      setHistory(events.value.items.map((item) => ({ id: item.id, action: item.action, createdAt: item.createdAt })));
      setPassport(evidence);
    } catch (error) {
      setMessage(error instanceof CitizenApiError ? `Error: ${error.code}` : text("failedState"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="citizen-main" id="main-content">
      <PageIntro audioTopic="evidence" eyebrow={text("navTrack")} title={text("caseHeading")} description={text("caseCopy")} />
      <div className="citizen-form citizen-case-loader">
        <label htmlFor="live-case-id">Case ID / کیس آئی ڈی</label>
        <input id="live-case-id" value={caseId} onChange={(event) => setCaseId(event.target.value)} placeholder="UUID" />
        <button className="citizen-button citizen-button-primary" type="button" disabled={busy || !caseId.trim()} onClick={loadCase}>
          {busy ? text("savingState") : (language === "ur" ? "کیس لائیں" : "Load live case")}
        </button>
        {message ? <p role="alert" className="citizen-error-message">{message}</p> : null}
      </div>
      <section aria-labelledby="citizen-case-number" className="citizen-case-summary">
        <div>
          <p className="citizen-eyebrow">{text("caseLabel")}</p>
          <h2 id="citizen-case-number">{caseItem?.id ?? casePreview.reference}</h2>
        </div>
        <div className="citizen-case-status">
          <span>{text("currentStatus")}</span>
          <strong>{text(caseStatusCopy[caseItem?.status ?? casePreview.status])}</strong>
        </div>
      </section>
      {caseItem ? (
        <section className="citizen-section" aria-label={language === "ur" ? "کیس کی تاریخ" : "Case history"}>
          <h2>{language === "ur" ? "کیس کی تاریخ" : "Case history"}</h2>
          {history.length === 0 ? <p>{language === "ur" ? "کوئی سرور کی تاریخ دستیاب نہیں۔" : "No server history available."}</p> : (
            <ul>
              {history.map((item) => <li key={item.id}>{item.action} — {item.createdAt}</li>)}
            </ul>
          )}
        </section>
      ) : null}
      {passport ? (
        <section className="citizen-section" aria-label={language === "ur" ? "سرور شواہد" : "Server evidence passport"}>
          <h2>{language === "ur" ? "سرور شواہد" : "Server evidence passport"}</h2>
          <dl className="citizen-evidence-passport-list">
            {formatEvidenceFindings(passport).map((finding) => (
              <div key={finding.key}>
                <dt>{text(({
                  signature: "passportSignature",
                  expiry: "passportExpiry",
                  revocation: "passportRevocation",
                  recipientMatch: "passportRecipientMatch",
                  payment: "passportPayment",
                  eligibility: "passportEligibility",
                } as const)[finding.key])}</dt>
                <dd>
                  <strong>{finding.result}</strong>
                  {finding.reasonCodes.length > 0 ? <span> — {finding.reasonCodes.join(", ")}</span> : null}
                  <small>{language === "ur" ? "دیکھا گیا" : "Observed"}: {finding.observedAt}</small>
                  {finding.sourceRefs.length === 0 ? <small>{language === "ur" ? "کوئی لائیو سرویس مصدر دستیاب نہیں" : "No live source reference"}</small> : (
                    <small>{finding.sourceRefs.map((source) => source.service).join(", ")}</small>
                  )}
                </dd>
              </div>
            ))}
          </dl>
          <p>{language === "ur" ? "AI حالت" : "AI status"}: {passport.ai.status}</p>
          {passport.missingEvidence.length > 0 ? <p>Missing evidence: {passport.missingEvidence.join(", ")}</p> : null}
          <p>{text("evidenceImportant")}</p>
        </section>
      ) : null}

      <section aria-labelledby="citizen-workflow-heading" className="citizen-section citizen-workflow">
        <h2 id="citizen-workflow-heading">{text("workflowHeading")}</h2>
        <p>{text("workflowDescription")}</p>
        <ol className="citizen-timeline">
          {caseSteps.map(({ key, status }, index) => {
            const current = status === casePreview.status;
            const complete = index === 0;
            return (
              <li aria-current={current ? "step" : undefined} className={current ? "is-current" : ""} key={status}>
                <span aria-hidden="true" className="citizen-timeline-marker">{complete ? "✓" : index + 1}</span>
                <span>{text(key)}</span>
                {current ? <strong>{text("currentStatus")}</strong> : null}
              </li>
            );
          })}
        </ol>
        <p className="citizen-pending-consent">
          <strong>{text("statusNeedEvidence")}</strong>
          <span>{text("evidenceResubmission")}</span>
        </p>
        <p className="citizen-pending-consent">
          <strong>{text("statusPendingConsent")}</strong>
          <span>{text("consentPause")}</span>
        </p>
        <p className="citizen-caution-note">{text("notPaymentApproval")}</p>
      </section>
    </main>
  );
}

function ConsentGrant({
  recipient,
  purpose,
  scope,
  withdrawn,
  onWithdraw,
}: {
  recipient: CitizenMessageKey;
  purpose: CitizenMessageKey;
  scope: CitizenMessageKey;
  withdrawn?: boolean;
  onWithdraw?: () => void;
}) {
  const { language } = useCitizenLanguage();
  const text = (key: CitizenMessageKey) => citizenText(language, key);

  return (
    <article className="citizen-consent-grant">
      <div className="citizen-consent-status">
        <span className="citizen-state citizen-state-sample">{text("sampleGrant")}</span>
        {withdrawn ? <span className="citizen-state citizen-state-withdrawn">{text("previewWithdrawn")}</span> : null}
      </div>
      <dl>
        <div><dt>{text("recipientTitle")}</dt><dd>{text(recipient)}</dd></div>
        <div><dt>{text("purposeTitle")}</dt><dd>{text(purpose)}</dd></div>
        <div><dt>{text("scopeTitle")}</dt><dd>{text(scope)}</dd></div>
        <div><dt>{text("expiryTitle")}</dt><dd>{text("sampleExpiry")}</dd></div>
      </dl>
      {onWithdraw ? (
        <button
          className="citizen-button citizen-button-outline"
          disabled={withdrawn}
          onClick={onWithdraw}
          type="button"
        >
          {withdrawn ? text("previewWithdrawn") : text("previewWithdraw")}
        </button>
      ) : null}
    </article>
  );
}

const consentGrantCopy = {
  helper: {
    purpose: "helperPurpose",
    recipient: "helperRecipient",
    scope: "helperScope",
  },
  department: {
    purpose: "departmentPurpose",
    recipient: "departmentRecipient",
    scope: "departmentScope",
  },
} satisfies Record<"helper" | "department", {
  purpose: CitizenMessageKey;
  recipient: CitizenMessageKey;
  scope: CitizenMessageKey;
}>;

function ConsentScreen() {
  const { language } = useCitizenLanguage();
  const { coordinator } = useCitizenSession();
  const text = (key: CitizenMessageKey) => citizenText(language, key);
  const [withdrawn, setWithdrawn] = useState<Partial<Record<"helper" | "department", true>>>({});
  const { mutationKeys } = useCitizenSession();
  const [caseId, setCaseId] = useState("");
  const [recipientId, setRecipientId] = useState("");
  const [purpose, setPurpose] = useState<"synthetic_helper_assistance" | "synthetic_department_review" | "synthetic_audit_review">("synthetic_helper_assistance");
  const [expiresAt, setExpiresAt] = useState("");
  const [grants, setGrants] = useState<ConsentGrant[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => coordinator.registerPrivateStateClearer(() => {
    setWithdrawn({});
    setCaseId("");
    setRecipientId("");
    setExpiresAt("");
    setGrants([]);
    setMessage("");
  }), [coordinator]);

  async function loadConsents() {
    setBusy(true);
    setMessage("");
    try {
      await citizenApi.getSession();
      const result = await coordinator.runRequest((signal) => citizenApi.listConsents(caseId, signal));
      if (result.status === "current") setGrants(result.value);
    } catch (error) {
      setMessage(error instanceof CitizenApiError ? `Error: ${error.code}` : text("failedState"));
    } finally {
      setBusy(false);
    }
  }

  async function grant() {
    setBusy(true);
    setMessage("");
    try {
      await citizenApi.getSession();
      const recipientType = purpose === "synthetic_department_review" ? "DEPARTMENT" : "PRINCIPAL";
      const actions = purpose === "synthetic_helper_assistance"
        ? ["READ_CASE", "READ_EVIDENCE", "WRITE_DRAFT", "ADD_EVIDENCE", "SUBMIT_CASE", "REQUEST_ASSESSMENT"] as const
        : purpose === "synthetic_department_review"
          ? ["READ_CASE", "READ_EVIDENCE", "REQUEST_ASSESSMENT", "REVIEW_CASE", "RESOLVE_CASE", "CLOSE_CASE", "ASSIGN_CASE", "ESCALATE_CASE"] as const
          : ["READ_CASE", "READ_EVIDENCE"] as const;
      const result = await coordinator.runRequest((signal) => citizenApi.grantConsent(caseId, {
        recipientType,
        recipientId,
        purpose,
        actions: [...actions],
        expiresAt: new Date(expiresAt).toISOString(),
      }, mutationKeys, signal));
      if (result.status === "current") {
        result.value.retire();
        setGrants((current) => [result.value.data, ...current]);
        setMessage(language === "ur" ? "سرور نے اجازت دے دی۔" : "Consent granted by the server.");
      }
    } catch (error) {
      setMessage(error instanceof CitizenApiError ? `Error: ${error.code}` : text("failedState"));
    } finally {
      setBusy(false);
    }
  }

  async function revoke(grant: ConsentGrant) {
    setBusy(true);
    setMessage("");
    try {
      await citizenApi.getSession();
      const result = await coordinator.runRequest((signal) => citizenApi.revokeConsent(grant.id, grant.version, mutationKeys, signal));
      if (result.status === "current") {
        result.value.retire();
        setGrants((current) => current.map((item) => item.id === grant.id ? result.value.data : item));
        setMessage(language === "ur" ? "سرور نے اجازت واپس لے لی۔" : "Consent revoked by the server.");
      }
    } catch (error) {
      setMessage(error instanceof CitizenApiError ? `Error: ${error.code}` : text("failedState"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="citizen-main" id="main-content">
      <PageIntro audioTopic="consent" eyebrow={text("navConsent")} title={text("consentHeading")} description={text("consentCopy")} />
      <section className="citizen-section" aria-labelledby="live-consent-heading">
        <h2 id="live-consent-heading">{language === "ur" ? "حقیقی سرور اجازت" : "Live server consent"}</h2>
        <div className="citizen-form citizen-consent-live">
          <label htmlFor="consent-case-id">Case ID</label>
          <input id="consent-case-id" value={caseId} onChange={(event) => setCaseId(event.target.value)} placeholder="UUID" />
          <label htmlFor="consent-purpose">{language === "ur" ? "مقصد" : "Purpose"}</label>
          <select id="consent-purpose" value={purpose} onChange={(event) => setPurpose(event.target.value as typeof purpose)}>
            <option value="synthetic_helper_assistance">synthetic_helper_assistance</option>
            <option value="synthetic_department_review">synthetic_department_review</option>
            <option value="synthetic_audit_review">synthetic_audit_review</option>
          </select>
          <label htmlFor="consent-recipient-id">{language === "ur" ? "وصول کنندہ آئی ڈی" : "Recipient ID"}</label>
          <input id="consent-recipient-id" value={recipientId} onChange={(event) => setRecipientId(event.target.value)} placeholder="UUID" />
          <label htmlFor="consent-expiry">{language === "ur" ? "اختتامی وقت" : "Expiry"}</label>
          <input id="consent-expiry" type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} />
          <div className="citizen-actions">
            <button className="citizen-button citizen-button-primary" type="button" disabled={busy || !caseId.trim()} onClick={loadConsents}>{language === "ur" ? "اجازتیں لائیں" : "Load grants"}</button>
            <button className="citizen-button citizen-button-outline" type="button" disabled={busy || !caseId.trim() || !recipientId.trim() || !expiresAt} onClick={grant}>{language === "ur" ? "اجازت دیں" : "Grant consent"}</button>
          </div>
          {message ? <p role="status">{message}</p> : null}
        </div>
        {grants.map((grant) => (
          <article className="citizen-consent-grant" key={grant.id}>
            <dl>
              <div><dt>ID</dt><dd>{grant.id}</dd></div>
              <div><dt>{language === "ur" ? "مقصد" : "Purpose"}</dt><dd>{grant.purpose}</dd></div>
              <div><dt>{language === "ur" ? "اجازت کی حد" : "Actions"}</dt><dd>{grant.actions.join(", ")}</dd></div>
              <div><dt>{text("expiryTitle")}</dt><dd>{grant.expiresAt}</dd></div>
            </dl>
            <button className="citizen-button citizen-button-outline" type="button" disabled={busy || grant.revokedAt !== null} onClick={() => revoke(grant)}>
              {grant.revokedAt ? (language === "ur" ? "واپس لی گئی" : "Revoked") : (language === "ur" ? "اجازت واپس لیں" : "Revoke consent")}
            </button>
          </article>
        ))}
      </section>
      <p className="citizen-privacy-note">{text("withdrawRule")}</p>
      <section aria-label={text("consentHeading")} className="citizen-consent-list">
        {syntheticCitizenViewAdapter.getConsentPreviews().map(({ recipient }) => {
          const grantCopy = consentGrantCopy[recipient];
          return (
            <ConsentGrant
              key={recipient}
              onWithdraw={() => setWithdrawn((current) => ({ ...current, [recipient]: true }))}
              withdrawn={Boolean(withdrawn[recipient])}
              {...grantCopy}
            />
          );
        })}
      </section>
      {Object.values(withdrawn).some(Boolean) ? (
        <p aria-live="polite" className="citizen-error-message" role="status">{text("noAccessChanges")}</p>
      ) : null}
    </main>
  );
}

export function CitizenScreen({ screen }: { screen: CitizenScreenName }) {
  const { ended, startNewSession } = useCitizenSession();
  const { language } = useCitizenLanguage();
  const text = (key: CitizenMessageKey) => citizenText(language, key);

  if (ended) {
    return (
      <main className="citizen-main citizen-session-ended" id="main-content">
        <h1>{text("sessionEndedTitle")}</h1>
        <p>{text("sessionEndedBody")}</p>
        <button
          className="citizen-button citizen-button-primary citizen-session-restart"
          onClick={startNewSession}
          type="button"
        >
          {text("startNewSession")}
        </button>
      </main>
    );
  }

  const screens: Record<CitizenScreenName, () => ReactNode> = {
    home: HomeScreen,
    verify: VerifyScreen,
    results: ResultsScreen,
    dispute: DisputeScreen,
    case: CaseScreen,
    consent: ConsentScreen,
  };
  const Screen = screens[screen];
  return <Screen />;
}
