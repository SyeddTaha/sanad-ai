import { z } from "zod";

// Scalar choices are frozen in bounded v1.0.0; see README approval ledger.
export const ReferenceSchema = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);
export const EpochSecondsSchema = z.int().nonnegative();
export const MoneyMinorSchema = z.int().nonnegative();
export const CurrencySchema = z.literal("PKR");
export const IdSchema = z.uuid();
export const TimestampSchema = z.iso.datetime();
export const VersionSchema = z.int().positive();
export const ConfidenceSchema = z.number().min(0).max(1);

export type Reference = z.infer<typeof ReferenceSchema>;
export type EpochSeconds = z.infer<typeof EpochSecondsSchema>;
export type MoneyMinor = z.infer<typeof MoneyMinorSchema>;
export type Currency = z.infer<typeof CurrencySchema>;
export type Id = z.infer<typeof IdSchema>;
export type Timestamp = z.infer<typeof TimestampSchema>;
export type Version = z.infer<typeof VersionSchema>;
export type Confidence = z.infer<typeof ConfidenceSchema>;
