import type { NextRequest } from "next/server";
import { handleConsent } from "@/backend/consent/http";
export async function POST(request: NextRequest, { params }: { params: Promise<{ grantId: string }> }) {
  return handleConsent(request, "revoke", (await params).grantId);
}
