import type { NextRequest } from "next/server";
import { handleCase } from "@/backend/cases/http";
import { handleCaseRecords } from "@/backend/officers/reads";
export async function GET(request: NextRequest, { params }: { params: Promise<{ caseId: string }> }) {
  return handleCaseRecords(request, "evidence", (await params).caseId);
}
export async function POST(request: NextRequest, { params }: { params: Promise<{ caseId: string }> }) {
  return handleCase(request, "evidence-add", (await params).caseId);
}
