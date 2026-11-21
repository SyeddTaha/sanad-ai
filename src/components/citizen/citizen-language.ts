"use client";

import { createContext, useContext } from "react";
import { message, type CitizenLanguage, type CitizenMessageKey } from "./citizen-copy";

type CitizenLanguageContextValue = {
  language: CitizenLanguage;
  toggleLanguage: () => void;
};

export const CitizenLanguageContext = createContext<CitizenLanguageContextValue | null>(null);

export function useCitizenLanguage(): CitizenLanguageContextValue {
  const context = useContext(CitizenLanguageContext);
  if (!context) {
    throw new Error("Citizen language context is unavailable outside CitizenShell");
  }
  return context;
}

export function citizenText(language: CitizenLanguage, key: CitizenMessageKey): string {
  return message(language, key);
}
