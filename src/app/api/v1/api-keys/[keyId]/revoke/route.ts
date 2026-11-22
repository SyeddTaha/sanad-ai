import type { NextRequest } from "next/server";
import { handleApiKeys } from "@/backend/api-keys/http";
export async function POST(request: NextRequest, context: { params: Promise<{ keyId: string }> }) {
  return handleApiKeys(request, "revoke", (await context.params).keyId);
}
