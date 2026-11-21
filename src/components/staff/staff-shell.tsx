"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { logout, session } from "@/lib/auth/browser";
import type { SessionContext } from "@/lib/auth/session-contract";
import { getStaffApiMode, getStaffModeLabel } from "@/lib/staff-api";

export default function StaffShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [context, setContext] = useState<SessionContext | null>(null);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;
    session().then((value) => {
      if (!active) return;
      setContext(value);
      const role = value.principal.roles;
      if (pathname.startsWith("/staff/admin") && !role.includes("ADMIN")) {
        setError("FORBIDDEN: This route requires the ADMIN role.");
      } else if (pathname.startsWith("/staff/officer") && !role.includes("OFFICER")) {
        setError("FORBIDDEN: This route requires the OFFICER role.");
      }
    }).catch((cause: unknown) => {
      if (!active) return;
      if (cause instanceof Error && cause.message === "FORBIDDEN") {
        setError("FORBIDDEN: The authenticated session has no permitted staff role.");
        setChecking(false);
        return;
      }
      router.replace("/login");
    }).finally(() => {
      if (active) setChecking(false);
    });
    return () => { active = false; };
  }, [pathname, router]);

  async function signOut() {
    try {
      await logout();
      router.replace("/login");
    } catch {
      setError("Sign-out could not be confirmed. The session remains active.");
    }
  }

  if (checking) return <main className="p-6" role="status">Checking staff session...</main>;
  if (!context) return null;

  const canOfficer = context.principal.roles.includes("OFFICER");
  const canAdmin = context.principal.roles.includes("ADMIN");
  const apiMode = getStaffApiMode();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 lg:grid lg:grid-cols-[220px_1fr]">
      <aside className="border-b border-slate-200 bg-white p-4 lg:min-h-screen lg:border-r lg:border-b-0">
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">SANAD staff</p>
          <p className="mt-1 text-sm">{context.principal.id}</p>
        </div>
        <nav className="flex gap-2 lg:flex-col" aria-label="Staff navigation">
          {canOfficer && <Link className="rounded px-3 py-2 text-sm hover:bg-slate-100" href="/staff/officer">Officer queue</Link>}
          {canAdmin && <Link className="rounded px-3 py-2 text-sm hover:bg-slate-100" href="/staff/admin">Admin</Link>}
          <button className="rounded px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100" onClick={signOut}>Sign out</button>
        </nav>
      </aside>
      <main className="min-w-0 p-4 md:p-6">
        {apiMode === "fixture" ? (
          <div className="mb-4 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            Fixture demo mode: all queue data and mutations are synthetic demonstrations.
          </div>
        ) : (
          <div className="mb-4 rounded border border-sky-300 bg-sky-50 px-3 py-2 text-sm text-sky-950">
            {getStaffModeLabel("live")}. No live result is assumed until a server confirmation is received.
          </div>
        )}
        {error && <div className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-900" role="alert">{error}</div>}
        {!error && children}
      </main>
    </div>
  );
}
