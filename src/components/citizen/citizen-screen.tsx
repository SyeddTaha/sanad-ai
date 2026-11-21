"use client";

import Link from "next/link";
import { useState, type FormEvent, type ReactNode } from "react";
import type { CaseStatus } from "@/contracts/v1/case";
import { citizenText, useCitizenLanguage } from "./citizen-language";
import type { CitizenMessageKey } from "./citizen-copy";
import { syntheticCitizenViewAdapter } from "./citizen-view-adapter";

export type CitizenScreenName = "home" | "verify" | "results" | "dispute" | "case" | "consent";

function PageIntro({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="citizen-page-intro">
      <p className="citizen-eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p>{description}</p>
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
  const text = (key: CitizenMessageKey) => citizenText(language, key);
  const [notice, setNotice] = useState("");
  const [state, setState] = useState<"idle" | "empty" | "disconnected">("idle");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState(notice.trim() ? "disconnected" : "empty");
  }

  return (
    <main className="citizen-main" id="main-content">
      <PageIntro eyebrow={text("navVerify")} title={text("verifyHeading")} description={text("verifyCopy")} />
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
      <PageIntro eyebrow={text("passportTitle")} title={text("resultsHeading")} description={text("resultsCopy")} />
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
  const text = (key: CitizenMessageKey) => citizenText(language, key);
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
  }

  return (
    <main className="citizen-main" id="main-content">
      <PageIntro eyebrow={text("navTrack")} title={text("disputeHeading")} description={text("disputeCopy")} />
      <div className="citizen-form-layout">
        <form className="citizen-form" onSubmit={handleSubmit}>
          <label htmlFor="citizen-reason">{text("reasonLabel")}</label>
          <textarea aria-describedby="reason-help" id="citizen-reason" maxLength={2000} required rows={4} />
          <p className="citizen-field-help" id="reason-help">{text("reasonHelp")}</p>
          <label htmlFor="citizen-evidence">
            {text("evidenceLabel")} <span className="citizen-optional">({text("optional")})</span>
          </label>
          <textarea aria-describedby="evidence-help" id="citizen-evidence" maxLength={2000} rows={4} />
          <p className="citizen-field-help" id="evidence-help">{text("evidenceHelp")}</p>
          <p className="citizen-privacy-note">{text("privacyNotice")}</p>
          <button className="citizen-button citizen-button-primary" type="submit">{text("submitDispute")}</button>
          {submitted ? (
            <p aria-live="assertive" className="citizen-error-message" role="alert">{text("failedMessage")}</p>
          ) : null}
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
  const text = (key: CitizenMessageKey) => citizenText(language, key);
  const casePreview = syntheticCitizenViewAdapter.getCasePreview();

  return (
    <main className="citizen-main" id="main-content">
      <PageIntro eyebrow={text("navTrack")} title={text("caseHeading")} description={text("caseCopy")} />
      <section aria-labelledby="citizen-case-number" className="citizen-case-summary">
        <div>
          <p className="citizen-eyebrow">{text("caseLabel")}</p>
          <h2 id="citizen-case-number">{casePreview.reference}</h2>
        </div>
        <div className="citizen-case-status">
          <span>{text("currentStatus")}</span>
          <strong>{text(caseStatusCopy[casePreview.status])}</strong>
        </div>
      </section>

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
  const text = (key: CitizenMessageKey) => citizenText(language, key);
  const [withdrawn, setWithdrawn] = useState<Partial<Record<"helper" | "department", true>>>({});

  return (
    <main className="citizen-main" id="main-content">
      <PageIntro eyebrow={text("navConsent")} title={text("consentHeading")} description={text("consentCopy")} />
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
