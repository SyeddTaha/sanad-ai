import type { NextRequest } from "next/server";
import { handleConsent } from "@/backend/consent/http";
export function POST(request: NextRequest) { return handleConsent(request, "reserve"); }
