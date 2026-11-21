import type { CaseStatus } from "@/contracts/v1/case";

export const citizenUiFixture = {
  caseReference: "DEMO-CASE-04",
  caseStatus: "UNDER_REVIEW" satisfies CaseStatus,
  findings: [
    { key: "authenticity", status: "UNKNOWN" },
    { key: "payment", status: "UNKNOWN" },
    { key: "eligibility", status: "UNKNOWN" },
  ],
  consentGrants: [
    { recipient: "helper", status: "SAMPLE_ONLY" },
    { recipient: "department", status: "SAMPLE_ONLY" },
  ],
} as const;
