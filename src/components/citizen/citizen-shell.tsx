"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { message, type CitizenLanguage, type CitizenMessageKey } from "./citizen-copy";
import { CitizenLanguageContext } from "./citizen-language";

export function CitizenShell({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<CitizenLanguage>("ur");
  const pathname = usePathname();

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === "ur" ? "rtl" : "ltr";
  }, [language]);

  const toggleLanguage = () => {
    setLanguage((current) => current === "ur" ? "en" : "ur");
  };
  const text = (key: CitizenMessageKey) => message(language, key);
  const navItems = [
    { href: "/citizen", key: "navHome" },
    { href: "/citizen/verify", key: "navVerify" },
    { href: "/citizen/case", key: "navTrack" },
    { href: "/citizen/consent", key: "navConsent" },
  ] as const;

  return (
    <CitizenLanguageContext.Provider value={{ language, toggleLanguage }}>
      <div className="citizen-root" lang={language} dir={language === "ur" ? "rtl" : "ltr"}>
        <a className="citizen-skip-link" href="#main-content">{text("skip")}</a>
        <header className="citizen-header">
          <div className="citizen-header-top">
            <Link aria-label={text("navHome")} className="citizen-brand" href="/citizen">
              <span className="citizen-brand-mark" aria-hidden="true">س</span>
              <span>{text("brand")}</span>
            </Link>
            <div className="citizen-header-actions">
              <span className="citizen-prototype-tag">
                <strong>{text("prototype")}</strong>
                <span>{text("subtitle")}</span>
              </span>
              <button
                aria-describedby="audio-unavailable-description"
                className="citizen-button citizen-button-quiet citizen-audio-button"
                disabled
                type="button"
              >
                {text("audioUnavailable")}
              </button>
              <span className="citizen-visually-hidden" id="audio-unavailable-description">
                {text("audioDescription")}
              </span>
              <button
                aria-label={text("languageButton")}
                className="citizen-button citizen-button-language"
                onClick={toggleLanguage}
                type="button"
              >
                {text("languageButton")}
              </button>
            </div>
          </div>
          <nav aria-label={text("navLabel")} className="citizen-nav">
            {navItems.map(({ href, key }) => (
              <Link
                aria-current={pathname === href ? "page" : undefined}
                className="citizen-nav-link"
                href={href}
                key={href}
              >
                {text(key)}
              </Link>
            ))}
          </nav>
        </header>

        <div aria-live="polite" className="citizen-connection-note" role="status">
          <span aria-hidden="true" className="citizen-connection-mark" />
          <div>
            <strong>{text("disconnectedTitle")}</strong>
            <span>{text("disconnectedBody")}</span>
          </div>
        </div>

        {children}

        <footer className="citizen-footer">
          <span>{text("footerText")}</span>
          <span>{text("subtitle")}</span>
        </footer>
      </div>
    </CitizenLanguageContext.Provider>
  );
}
