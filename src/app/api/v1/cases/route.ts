import type { NextRequest } from "next/server";
import { handleCase } from "@/backend/cases/http";
import { handleStaffQueue } from "@/backend/officers/http";
export async function GET(request: NextRequest) { return handleStaffQueue(request, "officer"); }
export async function POST(request: NextRequest) {
  return handleCase(request, "submit", "");
}
