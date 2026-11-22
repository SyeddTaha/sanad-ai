import type { NextRequest } from "next/server";
import { handleOfficerAction } from "@/backend/officers/http";
export async function POST(request: NextRequest, { params }: { params: Promise<{ caseId: string }> }) {
  return handleOfficerAction(request, "close", (await params).caseId);
}
