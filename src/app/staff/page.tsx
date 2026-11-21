"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { session } from "@/lib/auth/browser";

export default function StaffPage() {
  const router = useRouter();
  useEffect(() => {
    session().then((context) => {
      if (context.principal.roles.includes("ADMIN")) router.replace("/staff/admin");
      else if (context.principal.roles.includes("OFFICER")) router.replace("/staff/officer");
      else router.replace("/login");
    }).catch(() => router.replace("/login"));
  }, [router]);
  return <p role="status">Selecting staff dashboard...</p>;
}
