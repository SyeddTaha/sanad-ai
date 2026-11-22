"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import type { Case } from "@/contracts/v1/case";
import type { CaseEvent } from "@/lib/case-contract";
import type { EvidencePassport } from "@/contracts/v1/assessment";
import { formatEvidenceFindings } from "@/components/citizen/citizen-evidence";
import { getAuthorizedCase, getHelperSession } from "@/components/helper/helper-api";
import { logout } from "@/lib/auth/browser";

export default function HelperDashboard() {
  const router = useRouter();
  const [caseId, setCaseId] = useState("");
  const [caseItem, setCaseItem] = useState<Case | null>(null);
  const [history, setHistory] = useState<CaseEvent[]>([]);
  const [passport, setPassport] = useState<EvidencePassport | null>(null);
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    getHelperSession()
      .then(() => setBusy(false))
      .catch((error) => {
        setBusy(false);
        setMessage(error instanceof Error ? error.message : "SERVICE_UNAVAILABLE");
      });
  }, []);

  async function loadCase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setCaseItem(null);
    setHistory([]);
    setPassport(null);
    try {
      await getHelperSession();
      const result = await getAuthorizedCase(caseId.trim());
      setCaseItem(result.caseItem);
      setHistory(result.history);
      setPassport(result.passport);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "SERVICE_UNAVAILABLE");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    try {
      await logout();
      setMessage("Signed out.");
      router.push("/login");
    } catch {
      setMessage("Sign-out could not be confirmed.");
      setBusy(false);
    }
  }

  return (
    <div className="helper-root" dir="ltr">
      <header className="helper-header">
        <Link className="helper-brand" href="/helper" aria-label="SANAD helper dashboard">
          <span aria-hidden="true">س</span>
          <strong>SANAD</strong>
        </Link>
        <nav aria-label="Helper navigation">
          <Link aria-current="page" href="/helper">Authorized cases</Link>
          <Link href="/citizen">Citizen view</Link>
          <button type="button" onClick={signOut} disabled={busy}>Sign out</button>
        </nav>
      </header>
      <main className="helper-main" id="main-content">
        <section className="helper-intro">
          <p>Community Helper</p>
          <h1>Authorized case dashboard</h1>
          <p>Open only a case the Citizen has explicitly shared with this Helper account.</p>
        </section>

        <form className="helper-form" onSubmit={loadCase}>
          <label htmlFor="helper-case-id">Case ID</label>
          <input id="helper-case-id" value={caseId} onChange={(event) => setCaseId(event.target.value)} placeholder="UUID" required />
          <button type="submit" disabled={busy || !caseId.trim()}>{busy ? "Checking..." : "Open authorized case"}</button>
        </form>
        {message ? <p className="helper-message" role="alert">{message}</p> : null}

        {caseItem ? (
          <div className="helper-case-grid">
            <section className="helper-card">
              <p className="helper-label">Case</p>
              <h2>{caseItem.id}</h2>
              <dl>
                <div><dt>Status</dt><dd>{caseItem.status}</dd></div>
                <div><dt>Updated</dt><dd>{caseItem.updatedAt}</dd></div>
                <div><dt>Evidence version</dt><dd>{caseItem.evidenceVersion}</dd></div>
              </dl>
            </section>
            <section className="helper-card">
              <h2>Case history</h2>
              {history.length ? (
                <ul>
                  {history.map((item) => <li key={item.id}><strong>{item.action}</strong><span>{item.createdAt}</span></li>)}
                </ul>
              ) : <p>No history is available.</p>}
            </section>
            {passport ? (
              <section className="helper-card helper-passport">
                <h2>Evidence Passport</h2>
                <dl>
                  {formatEvidenceFindings(passport).map((finding) => (
                    <div key={finding.key}>
                      <dt>{finding.key === "recipientMatch" ? "Recipient match" : finding.key[0].toUpperCase() + finding.key.slice(1)}</dt>
                      <dd><strong>{finding.result}</strong><span>{finding.reasonCodes.join(", ") || "No reason code"}</span></dd>
                    </div>
                  ))}
                </dl>
              </section>
            ) : <section className="helper-card"><h2>Evidence Passport</h2><p>No assessment is available yet.</p></section>}
          </div>
        ) : null}
      </main>
    </div>
  );
}
