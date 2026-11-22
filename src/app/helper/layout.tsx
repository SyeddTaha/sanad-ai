import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@/components/citizen/citizen.css";
import "@/components/helper/helper.css";

export const metadata: Metadata = {
  title: "SANAD Helper",
  description: "Authorized synthetic case assistance.",
};

export default function HelperLayout({ children }: { children: ReactNode }) {
  return children;
}
