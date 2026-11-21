"use client";

import { citizenText, useCitizenLanguage } from "@/components/citizen/citizen-language";

export default function Loading() {
  const { language } = useCitizenLanguage();
  return (
    <div aria-busy="true" className="citizen-loading" lang={language} role="status">
      <h1>{citizenText(language, "loadingTitle")}</h1>
      <p>{citizenText(language, "loadingText")}</p>
      <div aria-hidden="true" className="citizen-loading-line" />
      <div aria-hidden="true" className="citizen-loading-line" />
    </div>
  );
}
