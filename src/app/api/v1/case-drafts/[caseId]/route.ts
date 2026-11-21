import type { NextRequest } from "next/server";
import { handleCase } from "@/backend/cases/http";
type Context = { params: Promise<{ caseId: string }> };
export async function GET(request: NextRequest, { params }: Context) {
  return handleCase(request, "draft-read", (await params).caseId);
}
export async function PATCH(request: NextRequest, { params }: Context) {
  return handleCase(request, "draft-save", (await params).caseId);
}
