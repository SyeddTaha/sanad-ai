import { z } from "zod";
import { CurrencySchema, EpochSecondsSchema, MoneyMinorSchema, ReferenceSchema } from "./scalars";

export const SignedNoticeHeaderSchema = z.strictObject({
  alg: z.literal("Ed25519"),
  kid: ReferenceSchema,
  typ: z.literal("sanad-notice+jws"),
});
export type SignedNoticeHeader = z.infer<typeof SignedNoticeHeaderSchema>;

/** Transport syntax only; Developer 2 owns byte/JSON/signature verification. */
export const CompactJwsSchema = z.string().max(8192)
  .regex(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
export type CompactJws = z.infer<typeof CompactJwsSchema>;

// Object validation only: never use parsed/reconstructed JSON as signing input.
export const SignedNoticePayloadSchema = z.strictObject({
  v: z.literal(1),
  issuerId: ReferenceSchema,
  noticeId: ReferenceSchema,
  recipientRef: ReferenceSchema,
  programRef: ReferenceSchema,
  paymentRef: ReferenceSchema,
  amountMinor: MoneyMinorSchema,
  currency: CurrencySchema,
  issuedAt: EpochSecondsSchema,
  expiresAt: EpochSecondsSchema,
}).refine((notice) => notice.expiresAt > notice.issuedAt, {
  path: ["expiresAt"], message: "Expiry must follow issuance",
});

export type SignedNoticePayload = z.infer<typeof SignedNoticePayloadSchema>;
