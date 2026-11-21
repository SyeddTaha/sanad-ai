import type { NextRequest } from "next/server";
import { handleRules } from "@/backend/rules/http";
export async function GET(request: NextRequest) { return handleRules(request, "current"); }
