import type { Metadata } from "next";
import type { ReactNode } from "react";
import { CitizenShell } from "@/components/citizen/citizen-shell";
import "@/components/citizen/citizen.css";

export const metadata: Metadata = {
  title: "SANAD Citizen | Prototype",
  description: "Urdu-first synthetic relief notice and case prototype.",
};

export default function CitizenLayout({ children }: { children: ReactNode }) {
  return <CitizenShell>{children}</CitizenShell>;
}
