import { z } from "zod";
import { ApiSuccessSchema, IdSchema, PrincipalSchema } from "@/contracts/v1";

// B01 endpoint composition of frozen v1 schemas; no frozen contract is changed.
export const SessionContextSchema = z.strictObject({
  principal: PrincipalSchema,
  departmentIds: z.array(IdSchema),
});
export const SessionResponseSchema = ApiSuccessSchema(SessionContextSchema);
export type SessionContext = z.infer<typeof SessionContextSchema>;
