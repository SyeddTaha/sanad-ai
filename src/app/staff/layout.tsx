import { Suspense, type ReactNode } from "react";
import StaffShell from "@/components/staff/staff-shell";

export const instant = false;

export default function StaffLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<main className="p-6" role="status">Loading staff workspace...</main>}>
      <StaffShell>{children}</StaffShell>
    </Suspense>
  );
}
