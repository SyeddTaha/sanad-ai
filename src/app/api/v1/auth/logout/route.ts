import type { NextRequest } from "next/server";
import { handleLogout } from "@/backend/auth/password";

export function POST(request: NextRequest) { return handleLogout(request); }
