"use client";

import Link from "next/link";
import { useEffect } from "react";
import { citizenText, useCitizenLanguage } from "@/components/citizen/citizen-language";

export default function CitizenError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { language } = useCitizenLanguage();

  useEffect(() => {
    console.error("Citizen route failed to render", error.digest ?? "no error digest");
  }, [error.digest]);

  return (
    <main className="citizen-error-page" id="main-content" lang={language}>
      <h1>{citizenText(language, "errorTitle")}</h1>
      <p>{citizenText(language, "errorText")}</p>
      <div className="citizen-actions">
        <button className="citizen-button citizen-button-primary" onClick={reset} type="button">
          {citizenText(language, "retry")}
        </button>
        <Link className="citizen-button citizen-button-outline" href="/citizen">
          {citizenText(language, "backHome")}
        </Link>
      </div>
    </main>
  );
}
