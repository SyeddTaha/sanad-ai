import type { NextRequest } from "next/server";
import { handleLogin } from "@/backend/auth/password";

export function POST(request: NextRequest) { return handleLogin(request); }
