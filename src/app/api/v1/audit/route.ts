import type { NextRequest } from "next/server";
import { handleAudit } from "@/backend/officers/reads";
export async function GET(request: NextRequest) {
  return handleAudit(request, request.nextUrl.searchParams.get("caseId") ?? "");
}
