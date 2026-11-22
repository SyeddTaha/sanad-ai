import type { NextRequest } from "next/server";
import { handleStaffQueue } from "@/backend/officers/http";
export async function GET(request: NextRequest) { return handleStaffQueue(request, "dispatch"); }
