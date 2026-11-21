"use client";

import { createClient } from "@supabase/supabase-js";

// Optional public SDK client. SANAD login uses HttpOnly cookies via /api/v1/auth/login.
// No SDK session or private data is persisted in browser storage.
export function browserSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key?.startsWith("sb_publishable_")) throw new Error("Missing public Supabase configuration");
  return createClient(url, key, { auth: {
    persistSession: false, autoRefreshToken: false, detectSessionInUrl: false,
  } });
}
