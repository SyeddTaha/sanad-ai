"use client";

import { citizenText, useCitizenLanguage } from "./citizen-language";
import { useCitizenAudioGuidance, type UrduAudioStatus } from "./citizen-audio";
import { citizenNarration, type CitizenAudioTopic } from "./citizen-narration";
import type { CitizenMessageKey } from "./citizen-copy";

const statusMessage: Partial<Record<UrduAudioStatus, CitizenMessageKey>> = {
  starting: "audioStarting",
  playing: "audioPlaying",
  complete: "audioComplete",
  stopped: "audioStopped",
  unavailable: "audioUnavailable",
  failed: "audioFailed",
};

export function CitizenAudioControl({ topic }: { topic: CitizenAudioTopic }) {
  const { language } = useCitizenLanguage();
  const { guidance, status } = useCitizenAudioGuidance();
  const messageKey = statusMessage[status];

  return (
    <div
      aria-label={citizenText(language, "audioGroup")}
      className="citizen-audio-control"
      role="group"
    >
      <button
        aria-label={citizenText(language, status === "complete" || status === "stopped" ? "audioReplay" : "audioPlay")}
        className="citizen-button citizen-button-outline citizen-audio-play"
        onClick={() => guidance.play(citizenNarration(topic))}
        type="button"
      >
        {citizenText(language, status === "complete" || status === "stopped" ? "audioReplay" : "audioPlay")}
      </button>
      <button
        aria-label={citizenText(language, "audioStop")}
        className="citizen-button citizen-button-quiet"
        disabled={status !== "starting" && status !== "playing"}
        onClick={() => guidance.stop()}
        type="button"
      >
        {citizenText(language, "audioStop")}
      </button>
      <span aria-live="polite" className="citizen-audio-status" role="status">
        {messageKey ? citizenText(language, messageKey) : ""}
      </span>
    </div>
  );
}
