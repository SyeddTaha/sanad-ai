import "server-only";
import type { NextRequest } from "next/server";
import { inAuthorizationTransaction, audit } from "@/backend/authorization/transaction";
import { AuthFailure } from "@/backend/auth/principal";
import { privateJson } from "@/backend/auth/session";
import { errorJson } from "@/backend/consent/http";
import { IdSchema } from "@/contracts/v1";

export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();
  try {
    const data = await inAuthorizationTransaction(request, requestId, "STAFF_OFFICER_DIRECTORY", async (tx) => {
      if (!tx.identity.principal.roles.includes("ADMIN")) throw new AuthFailure("FORBIDDEN");
      const departmentId = request.nextUrl.searchParams.get("departmentId");
      if (!departmentId || !IdSchema.safeParse(departmentId).success) throw new AuthFailure("VALIDATION_FAILED");
      if (!tx.identity.departmentIds.includes(departmentId)) throw new AuthFailure("FORBIDDEN");
      const { rows } = await tx.db.query(
        `select distinct p.id
         from public.profiles p
         join public.role_assignments r on r.profile_id = p.id
         join public.department_memberships m on m.profile_id = p.id
         where p.active and r.role = 'OFFICER' and m.department_id = $1
         order by p.id`,
        [departmentId],
      );
      await audit(tx, "STAFF_OFFICER_DIRECTORY", "ALLOWED", departmentId);
      return { items: rows.map((row) => ({ id: IdSchema.parse(row.id) })) };
    });
    return privateJson({ data, requestId });
  } catch (error) {
    return errorJson(error, requestId);
  }
}
