import type { EvidenceFindings } from "@/contracts/v1/evidence";

export type CitizenPassportFindingKey =
  | "signature"
  | "expiry"
  | "revocation"
  | "recipientMatch"
  | "payment"
  | "eligibility";

export type CitizenPassportFinding = {
  key: CitizenPassportFindingKey;
  result: string;
  reasonCodes: readonly string[];
  sourceRefs: readonly EvidenceFindings["payment"]["sourceRefs"][number][];
  observedAt: string;
};

export function formatEvidenceFindings(findings: EvidenceFindings): CitizenPassportFinding[] {
  return [
    { key: "signature", ...findings.signature },
    { key: "expiry", ...findings.expiry },
    { key: "revocation", ...findings.revocation },
    { key: "recipientMatch", ...findings.recipientMatch },
    { key: "payment", ...findings.payment },
    { key: "eligibility", ...findings.eligibility },
  ];
}
