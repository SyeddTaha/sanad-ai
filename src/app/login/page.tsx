"use client";

import { useState, type FormEvent } from "react";
import { login, logout, session } from "@/lib/auth/browser";
import type { SessionContext } from "@/lib/auth/session-contract";

export default function LoginPage() {
  const [context, setContext] = useState<SessionContext | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const input = new FormData(form);
    setContext(null);
    setMessage("");
    setBusy(true);
    try {
      setContext(await login(String(input.get("email")), String(input.get("password"))));
      form.reset();
      setMessage("Signed in. Your session expires within one hour; sign in again after expiry.");
    } catch { setMessage("Sign-in failed. Check your credentials and active account, or try again later."); }
    finally { setBusy(false); }
  }

  async function checkSession() {
    setBusy(true);
    setContext(null);
    try { setContext(await session()); setMessage("Session verified."); }
    catch { setMessage("No active session. Please sign in."); }
    finally { setBusy(false); }
  }

  async function signOut() {
    setBusy(true);
    setContext(null);
    try { await logout(); setMessage("Signed out. Private views and drafts must be cleared before switching citizens."); }
    catch { setMessage("Sign-out could not be confirmed. Retry before switching citizens."); }
    finally { setBusy(false); }
  }

  return <main className="mx-auto w-full max-w-md space-y-5 p-8">
    <h1 className="text-2xl font-semibold">SANAD sign in</h1>
    <p>Use your synthetic demo account.</p>
    <form onSubmit={submit} className="space-y-4">
      <label className="block">Email<input className="block w-full rounded border p-2" name="email" type="email" autoComplete="username" required maxLength={254} /></label>
      <label className="block">Password<input className="block w-full rounded border p-2" name="password" type="password" autoComplete="current-password" required maxLength={1024} /></label>
      <button className="rounded border p-3" disabled={busy}>Sign in</button>
    </form>
    <div className="flex gap-3">
      <button className="rounded border p-3" onClick={checkSession} disabled={busy}>Check session</button>
      <button className="rounded border p-3" onClick={signOut} disabled={busy}>Sign out</button>
    </div>
    <p role="status" aria-live="polite">{message}</p>
    {context && <p>Signed in as {context.principal.roles.join(", ")}. Account: {context.principal.id}</p>}
  </main>;
}
