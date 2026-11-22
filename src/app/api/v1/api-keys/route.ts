import type { NextRequest } from "next/server";
import { handleApiKeys } from "@/backend/api-keys/http";
export const GET = (request: NextRequest) => handleApiKeys(request, "list");
export const POST = (request: NextRequest) => handleApiKeys(request, "issue");
