import { z } from "zod";
import { ApiSuccessSchema, ConsentActionSchema, IdSchema, TimestampSchema, type Role } from "@/contracts/v1";

// B05 endpoint compositions; the frozen v1 exports remain unchanged.
export const ApiKeyScopesByRole = {
  CITIZEN: [],
  HELPER: ["READ_CASE", "READ_EVIDENCE", "WRITE_DRAFT", "ADD_EVIDENCE", "SUBMIT_CASE", "REQUEST_ASSESSMENT", "PROCESS_AI"],
  OFFICER: ["READ_CASE", "READ_EVIDENCE", "REQUEST_ASSESSMENT", "REVIEW_CASE", "RESOLVE_CASE", "CLOSE_CASE", "ESCALATE_CASE", "PROCESS_AI"],
  ADMIN: ["ASSIGN_CASE"],
  AUDITOR: ["READ_CASE", "READ_EVIDENCE"],
} as const satisfies Record<Role, readonly string[]>;
export const IssueApiKeyRequestSchema = z.strictObject({
  name: z.string().trim().min(1).max(80),
  scopes: z.array(ConsentActionSchema).min(1).max(12).refine((items) => new Set(items).size === items.length),
  expiresAt: TimestampSchema,
});
export const ApiKeyMetadataSchema = z.strictObject({
  id: IdSchema, principalId: IdSchema, name: z.string(), scopes: z.array(ConsentActionSchema),
  expiresAt: TimestampSchema, revokedAt: TimestampSchema.nullable(), createdAt: TimestampSchema,
});
export const IssueApiKeyResponseSchema = ApiSuccessSchema(z.strictObject({ credential: ApiKeyMetadataSchema, key: z.string().nullable() }));
export const ApiKeyListResponseSchema = ApiSuccessSchema(z.strictObject({ items: z.array(ApiKeyMetadataSchema), nextCursor: IdSchema.nullable() }));
export const ApiKeyResponseSchema = ApiSuccessSchema(ApiKeyMetadataSchema);
export const RevokeApiKeyRequestSchema = z.strictObject({});
