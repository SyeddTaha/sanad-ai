import type { NextRequest } from "next/server";
import { handleCase } from "@/backend/cases/http";
export async function GET(request: NextRequest, { params }: { params: Promise<{ caseId: string; assessmentId: string }> }) {
  const { caseId, assessmentId } = await params;
  return handleCase(request, "trace", caseId, {}, assessmentId);
}
