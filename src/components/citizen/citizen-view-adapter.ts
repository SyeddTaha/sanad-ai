import type { CaseStatus } from "@/contracts/v1/case";
import { citizenUiFixture } from "./citizen-ui-fixtures";

export type CitizenFindingView = Readonly<{
  key: "authenticity" | "payment" | "eligibility";
  status: "UNKNOWN";
}>;

export type CitizenCasePreview = Readonly<{
  reference: string;
  status: CaseStatus;
}>;

export type CitizenConsentPreview = Readonly<{
  recipient: "helper" | "department";
  status: "SAMPLE_ONLY";
}>;

export interface CitizenViewAdapter {
  getCasePreview(): CitizenCasePreview;
  getEvidenceFindings(): readonly CitizenFindingView[];
  getConsentPreviews(): readonly CitizenConsentPreview[];
}

export const syntheticCitizenViewAdapter: CitizenViewAdapter = {
  getCasePreview: () => ({
    reference: citizenUiFixture.caseReference,
    status: citizenUiFixture.caseStatus,
  }),
  getEvidenceFindings: () => citizenUiFixture.findings,
  getConsentPreviews: () => citizenUiFixture.consentGrants,
};
