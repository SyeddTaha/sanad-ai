import type { NextRequest } from "next/server";
import { handleCase } from "@/backend/cases/http";
export async function POST(request: NextRequest, { params }: { params: Promise<{ caseId: string }> }) {
  return handleCase(request, "evidence-add", (await params).caseId);
}
