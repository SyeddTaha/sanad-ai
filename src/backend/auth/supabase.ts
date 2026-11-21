import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseConfiguration } from "./environment";

export function authClients(url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL,
  publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY,
  secret = process.env.SUPABASE_SECRET_KEY, transport: typeof fetch = fetch) {
  const config = supabaseConfiguration(url, publicKey, secret);
  const options = {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input: RequestInfo | URL, init?: RequestInit) => transport(input, { ...init, cache: "no-store" }) },
  };
  // Separate request-local instances: a login must never replace the privileged client's identity.
  return { user: createClient(config.url, config.publicKey, options), server: createClient(config.url, config.secret, options) };
}

export type AuthClients = ReturnType<typeof authClients>;
