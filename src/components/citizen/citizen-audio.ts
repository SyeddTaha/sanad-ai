import { createContext, useContext, useSyncExternalStore } from "react";

export type UrduAudioStatus =
  | "idle"
  | "starting"
  | "playing"
  | "stopped"
  | "complete"
  | "unavailable"
  | "failed";

export type SpeechVoice = {
  lang: string;
  nativeVoice?: SpeechSynthesisVoice;
};

export type SpeechCallbacks = {
  onStart: () => void;
  onEnd: () => void;
  onError: () => void;
};

export interface SpeechOutput {
  voices(): readonly SpeechVoice[];
  speak(text: string, voice: SpeechVoice, callbacks: SpeechCallbacks): void;
  cancel(): void;
}

export const CitizenAudioContext = createContext<CitizenUrduAudioGuidance | null>(null);

export function useCitizenAudioGuidance(): {
  guidance: CitizenUrduAudioGuidance;
  status: UrduAudioStatus;
} {
  const guidance = useContext(CitizenAudioContext);
  if (!guidance) {
    throw new Error("Citizen audio guidance is unavailable outside CitizenShell");
  }
  const status = useSyncExternalStore(
    guidance.subscribe,
    guidance.getSnapshot,
    guidance.getSnapshot,
  );
  return { guidance, status };
}

export class CitizenUrduAudioGuidance {
  private status: UrduAudioStatus = "idle";
  private playbackId = 0;
  private readonly listeners = new Set<() => void>();

  constructor(private readonly output: SpeechOutput) {}

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  readonly getSnapshot = (): UrduAudioStatus => this.status;

  play(text: string): void {
    this.stop();
    let voices: readonly SpeechVoice[];
    try {
      voices = this.output.voices();
    } catch {
      this.update("failed");
      return;
    }
    const voice = voices
      .filter((candidate) => candidate.lang.toLowerCase().split("-")[0] === "ur")
      .sort((left, right) => Number(right.lang.toLowerCase() === "ur-pk") - Number(left.lang.toLowerCase() === "ur-pk"))[0];

    if (!voice) {
      this.update("unavailable");
      return;
    }

    const playbackId = ++this.playbackId;
    this.update("starting");
    try {
      this.output.speak(text, voice, {
        onStart: () => this.updateIfCurrent(playbackId, "playing"),
        onEnd: () => this.updateIfCurrent(playbackId, "complete"),
        onError: () => this.updateIfCurrent(playbackId, "failed"),
      });
    } catch {
      this.updateIfCurrent(playbackId, "failed");
    }
  }

  stop(): void {
    this.playbackId += 1;
    if (this.status === "starting" || this.status === "playing") {
      try {
        this.output.cancel();
      } catch {
        this.update("failed");
        return;
      }
    }
    this.update("stopped");
  }

  private updateIfCurrent(playbackId: number, status: UrduAudioStatus): void {
    if (playbackId === this.playbackId) this.update(status);
  }

  private update(status: UrduAudioStatus): void {
    this.status = status;
    for (const listener of this.listeners) listener();
  }
}

export function createBrowserSpeechOutput(): SpeechOutput {
  return {
    voices: () => {
      if (typeof window === "undefined" || !window.speechSynthesis) return [];
      return window.speechSynthesis.getVoices().map((nativeVoice) => ({
        lang: nativeVoice.lang,
        nativeVoice,
      }));
    },
    speak: (text, voice, callbacks) => {
      if (typeof window === "undefined" || !window.speechSynthesis || typeof SpeechSynthesisUtterance === "undefined") {
        throw new Error("Speech synthesis is unavailable");
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = voice.lang;
      if (voice.nativeVoice) utterance.voice = voice.nativeVoice;
      utterance.onstart = callbacks.onStart;
      utterance.onend = callbacks.onEnd;
      utterance.onerror = callbacks.onError;
      window.speechSynthesis.speak(utterance);
    },
    cancel: () => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    },
  };
}
