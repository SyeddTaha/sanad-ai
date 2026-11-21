import type { NextRequest } from "next/server";
import { handleRules } from "@/backend/rules/http";
export async function POST(request: NextRequest) { return handleRules(request, "publish"); }
