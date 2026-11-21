"use client";

import { createContext, useContext } from "react";
import { message, type CitizenLanguage, type CitizenMessageKey } from "./citizen-copy";

type CitizenLanguageContextValue = {
  language: CitizenLanguage;
  toggleLanguage: () => void;
  resetLanguage: () => void;
};

export const CitizenLanguageContext = createContext<CitizenLanguageContextValue | null>(null);

export class CitizenLanguageController {
  private language: CitizenLanguage = "ur";
  private readonly listeners = new Set<() => void>();

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  readonly getSnapshot = (): CitizenLanguage => this.language;
  readonly getServerSnapshot = (): CitizenLanguage => "ur";

  readonly toggle = (): void => {
    this.update(this.language === "ur" ? "en" : "ur");
  };

  readonly reset = (): void => {
    this.update("ur");
  };

  private update(language: CitizenLanguage): void {
    if (language === this.language) return;
    this.language = language;
    for (const listener of this.listeners) listener();
  }
}

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
