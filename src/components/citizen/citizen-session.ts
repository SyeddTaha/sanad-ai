import { createContext, useContext } from "react";

export type CitizenRequestResult<T> =
  | { status: "current"; value: T }
  | { status: "stale" };

type CitizenSessionAction = {
  session: CitizenSessionCoordinator;
  resetLanguage: () => void;
  navigate: (href: "/citizen") => void;
  announce: (message: string) => void;
  confirmation: string;
};

export type CitizenSessionContextValue = {
  coordinator: CitizenSessionCoordinator;
  version: number;
  ended: boolean;
};

export const CitizenSessionContext = createContext<CitizenSessionContextValue | null>(null);

export function useCitizenSession(): CitizenSessionContextValue {
  const context = useContext(CitizenSessionContext);
  if (!context) {
    throw new Error("Citizen session context is unavailable outside CitizenShell");
  }
  return context;
}

export class CitizenSessionCoordinator {
  private version = 0;
  private ended = false;
  private readonly listeners = new Set<() => void>();
  private readonly clearers = new Set<() => void>();
  private readonly audioStoppers = new Set<() => void>();
  private readonly requests = new Set<AbortController>();

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  readonly getVersion = (): number => this.version;

  get isEnded(): boolean {
    return this.ended;
  }

  registerPrivateStateClearer(clear: () => void): () => void {
    this.clearers.add(clear);
    return () => this.clearers.delete(clear);
  }

  registerAudioStopper(stop: () => void): () => void {
    this.audioStoppers.add(stop);
    if (this.ended) stop();
    return () => this.audioStoppers.delete(stop);
  }

  async runRequest<T>(
    request: (signal: AbortSignal) => Promise<T>,
  ): Promise<CitizenRequestResult<T>> {
    if (this.ended) return { status: "stale" };

    const controller = new AbortController();
    const requestVersion = this.version;
    this.requests.add(controller);

    try {
      const value = await request(controller.signal);
      if (controller.signal.aborted || requestVersion !== this.version) {
        return { status: "stale" };
      }
      return { status: "current", value };
    } catch (error) {
      if (controller.signal.aborted || requestVersion !== this.version) {
        return { status: "stale" };
      }
      throw error;
    } finally {
      this.requests.delete(controller);
    }
  }

  endSession(): void {
    this.version += 1;
    this.ended = true;

    for (const controller of this.requests) {
      controller.abort();
    }
    this.requests.clear();

    for (const stop of this.audioStoppers) {
      stop();
    }
    for (const clear of this.clearers) {
      clear();
    }
    for (const listener of this.listeners) {
      listener();
    }
  }
}

export function endCitizenSession({
  session,
  resetLanguage,
  navigate,
  announce,
  confirmation,
}: CitizenSessionAction): void {
  session.endSession();
  resetLanguage();
  navigate("/citizen");
  announce(confirmation);
}
