"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { session } from "@/lib/auth/browser";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    let active = true;
    session().then((context) => {
      if (!active) return;
      const roles = context.principal.roles;
      if (roles.includes("ADMIN")) router.replace("/staff/admin");
      else if (roles.includes("OFFICER")) router.replace("/staff/officer");
      else if (roles.includes("HELPER")) router.replace("/helper");
      else if (roles.includes("CITIZEN")) router.replace("/citizen");
      else router.replace("/login");
    }).catch(() => {
      if (active) router.replace("/login");
    });
    return () => { active = false; };
  }, [router]);

  return <main className="mx-auto w-full max-w-md p-8" role="status">Checking your SANAD session…</main>;
}
