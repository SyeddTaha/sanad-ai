import type { NextRequest } from "next/server";
import { handleRules } from "@/backend/rules/http";
export async function GET(request: NextRequest, { params }: { params: Promise<{ ruleId: string }> }) {
  return handleRules(request, "version", {}, (await params).ruleId);
}
