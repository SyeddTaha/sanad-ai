import type { NextRequest } from "next/server";
import { handleCaseRecords } from "@/backend/officers/reads";
export async function GET(request: NextRequest, { params }: { params: Promise<{ caseId: string }> }) {
  return handleCaseRecords(request, "decisions", (await params).caseId);
}
