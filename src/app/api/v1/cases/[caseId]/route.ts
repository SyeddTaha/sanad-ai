import type { NextRequest } from "next/server";
import { handleCase } from "@/backend/cases/http";
export async function GET(request: NextRequest, { params }: { params: Promise<{ caseId: string }> }) {
  return handleCase(request, "detail", (await params).caseId);
}
