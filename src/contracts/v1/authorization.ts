import { z } from "zod";
import { ConsentActionSchema, ConsentGrantSchema } from "./consent";
import { IdSchema, TimestampSchema } from "./scalars";

export const RoleSchema = z.enum(["CITIZEN", "HELPER", "OFFICER", "ADMIN", "AUDITOR"]);
export const PrincipalKindSchema = z.enum(["HUMAN", "SERVICE"]);
export const PrincipalSchema = z.strictObject({
  id: IdSchema,
  kind: PrincipalKindSchema,
  roles: z.array(RoleSchema),
  active: z.boolean(),
});

/** Server-derived input to a future policy evaluator, never a request credential.
 * Parsing this context does not authenticate or authorize any action.
 */
export const AuthorizationContextSchema = z.strictObject({
  principal: PrincipalSchema,
  target: z.strictObject({
    caseId: IdSchema,
    citizenId: IdSchema,
    assignedOfficerId: IdSchema.nullable(),
  }),
  departmentIds: z.array(IdSchema),
  grants: z.array(ConsentGrantSchema),
  apiKeyScopes: z.array(ConsentActionSchema).nullable(),
  evaluatedAt: TimestampSchema,
});

export type Role = z.infer<typeof RoleSchema>;
export type PrincipalKind = z.infer<typeof PrincipalKindSchema>;
export type Principal = z.infer<typeof PrincipalSchema>;
export type AuthorizationContext = z.infer<typeof AuthorizationContextSchema>;
