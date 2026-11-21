import type { NextRequest } from "next/server";
import { handleCase } from "@/backend/cases/http";
export async function POST(request: NextRequest) {
  return handleCase(request, "submit", "");
}
