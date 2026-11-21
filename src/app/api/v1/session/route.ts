import type { NextRequest } from "next/server";
import { handleSession } from "@/backend/auth/session";

export function GET(request: NextRequest) {
  return handleSession(request);
}
