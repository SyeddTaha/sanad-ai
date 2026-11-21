import type { NextRequest } from "next/server";
import { handleConsent } from "@/backend/consent/http";
type Context = { params: Promise<{ caseId: string }> };
export async function GET(request: NextRequest, { params }: Context) { return handleConsent(request, "list", (await params).caseId); }
export async function POST(request: NextRequest, { params }: Context) { return handleConsent(request, "grant", (await params).caseId); }
