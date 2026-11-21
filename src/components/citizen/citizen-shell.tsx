"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { message, type CitizenMessageKey } from "./citizen-copy";
import { CitizenLanguageContext, CitizenLanguageController } from "./citizen-language";
import { CitizenAudioContext, CitizenUrduAudioGuidance, createBrowserSpeechOutput } from "./citizen-audio";
import {
  CitizenSessionContext,
  createCitizenSession,
  endCitizenSession,
  startNewCitizenSession,
} from "./citizen-session";

export function CitizenShell({ children }: { children: ReactNode }) {
  const [languageController] = useState(() => new CitizenLanguageController());
  const [session, setSession] = useState(() => createCitizenSession());
  const [audioGuidance, setAudioGuidance] = useState(
    () => new CitizenUrduAudioGuidance(createBrowserSpeechOutput()),
  );
  const { coordinator, generation } = session;
  const [switchAnnouncement, setSwitchAnnouncement] = useState("");
  const language = useSyncExternalStore(
    languageController.subscribe,
    languageController.getSnapshot,
    languageController.getServerSnapshot,
  );
  const sessionVersion = useSyncExternalStore(
    coordinator.subscribe,
    coordinator.getVersion,
    coordinator.getVersion,
  );
  const ended = coordinator.isEnded;
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => coordinator.registerAudioStopper(() => audioGuidance.stop()), [coordinator, audioGuidance]);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === "ur" ? "rtl" : "ltr";
  }, [language]);

  const handleEndSession = () => {
    endCitizenSession({
      session: coordinator,
      resetLanguage: languageController.reset,
      navigate: (href) => router.replace(href),
      announce: setSwitchAnnouncement,
      confirmation: message("ur", "sessionCleared"),
    });
  };
  const handleStartNewSession = () => {
    const nextSession = startNewCitizenSession(session);
    if (nextSession === session) return;

    setSession(nextSession);
    setAudioGuidance(new CitizenUrduAudioGuidance(createBrowserSpeechOutput()));
    languageController.reset();
    setSwitchAnnouncement(message("ur", "newLocalSessionStarted"));
    router.replace("/citizen");
  };
  const text = (key: CitizenMessageKey) => message(language, key);
  const navItems = [
    { href: "/citizen", key: "navHome" },
    { href: "/citizen/verify", key: "navVerify" },
    { href: "/citizen/case", key: "navTrack" },
    { href: "/citizen/consent", key: "navConsent" },
  ] as const;

  return (
    <CitizenLanguageContext.Provider
      value={{
        language,
        toggleLanguage: languageController.toggle,
        resetLanguage: languageController.reset,
      }}
    >
      <CitizenAudioContext.Provider value={audioGuidance}>
        <CitizenSessionContext.Provider
          value={{
            coordinator,
            version: sessionVersion,
            ended,
            startNewSession: handleStartNewSession,
          }}
        >
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
                  {!ended ? (
                    <button
                      aria-label={text("switchSession")}
                      className="citizen-button citizen-button-language citizen-switch-session"
                      onClick={handleEndSession}
                      type="button"
                    >
                      <span className="citizen-switch-wide">{text("switchSession")}</span>
                      <span className="citizen-switch-compact">{text("switchSessionCompact")}</span>
                    </button>
                  ) : null}
                  <button
                    aria-label={text("languageButton")}
                    className="citizen-button citizen-button-language"
                    onClick={languageController.toggle}
                    type="button"
                  >
                    {text("languageButton")}
                  </button>
                </div>
              </div>
              <nav aria-label={text("navLabel")} className="citizen-nav">
                {(ended ? navItems.slice(0, 1) : navItems).map(({ href, key }) => (
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

            <div aria-live="polite" className="citizen-switch-announcement" role="status">
              {switchAnnouncement}
            </div>
            <div aria-live="polite" className="citizen-connection-note" role="status">
              <span aria-hidden="true" className="citizen-connection-mark" />
              <div>
                <strong>{text("disconnectedTitle")}</strong>
                <span>{text("disconnectedBody")}</span>
              </div>
            </div>

            <div key={generation}>{children}</div>

            <footer className="citizen-footer">
              <span>{text("footerText")}</span>
              <span>{text("subtitle")}</span>
            </footer>
          </div>
        </CitizenSessionContext.Provider>
      </CitizenAudioContext.Provider>
    </CitizenLanguageContext.Provider>
  );
}
