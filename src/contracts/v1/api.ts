import { z } from "zod";
import { IdSchema } from "./scalars";

export const ErrorHttpStatus = {
  MALFORMED_REQUEST: 400,
  UNAUTHENTICATED: 401, INVALID_API_KEY: 401,
  FORBIDDEN: 403, CONSENT_REQUIRED: 403, ASSIGNMENT_REQUIRED: 403, INSUFFICIENT_SCOPE: 403,
  NOT_FOUND: 404,
  INVALID_TRANSITION: 409, STALE_VERSION: 409, STALE_ASSESSMENT: 409,
  IDEMPOTENCY_CONFLICT: 409, REQUEST_IN_PROGRESS: 409,
  PAYLOAD_TOO_LARGE: 413, UNSUPPORTED_MEDIA_TYPE: 415, VALIDATION_FAILED: 422,
  RATE_LIMITED: 429, SERVICE_UNAVAILABLE: 503,
} as const;
export const ErrorCodeSchema = z.enum(Object.keys(ErrorHttpStatus) as [
  keyof typeof ErrorHttpStatus, ...(keyof typeof ErrorHttpStatus)[],
]);
// Candidate key grammar; producers must select reviewed, translated message keys.
export const MessageKeySchema = z.string().regex(/^[A-Za-z0-9_.-]+$/);
export const FieldErrorSchema = z.strictObject({ path: z.string(), messageKey: MessageKeySchema });
export const ApiErrorSchema = z.strictObject({
  code: ErrorCodeSchema,
  messageKey: MessageKeySchema,
  fieldErrors: z.array(FieldErrorSchema),
  retryable: z.boolean(),
});
export const ApiErrorEnvelopeSchema = z.strictObject({ requestId: IdSchema, error: ApiErrorSchema });

export function ApiSuccessSchema<T extends z.ZodType>(data: T) {
  return z.strictObject({ data, requestId: IdSchema });
}

export function ApiCollectionSchema<T extends z.ZodType>(item: T) {
  return z.strictObject({ items: z.array(item), nextCursor: z.string().min(1).nullable() });
}

export type ApiSuccess<T> = z.infer<ReturnType<typeof ApiSuccessSchema<z.ZodType<T>>>>;
export type ApiCollection<T> = z.infer<ReturnType<typeof ApiCollectionSchema<z.ZodType<T>>>>;
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;
export type MessageKey = z.infer<typeof MessageKeySchema>;
export type FieldError = z.infer<typeof FieldErrorSchema>;
export type ApiError = z.infer<typeof ApiErrorSchema>;
export type ApiErrorEnvelope = z.infer<typeof ApiErrorEnvelopeSchema>;
