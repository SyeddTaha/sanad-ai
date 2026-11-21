import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CitizenUrduAudioGuidance,
  type SpeechOutput,
  type SpeechVoice,
  type SpeechCallbacks,
} from "./citizen-audio";

class TestSpeechOutput implements SpeechOutput {
  availableVoices: readonly SpeechVoice[] = [{ lang: "ur-PK" }];
  spokenText = "";
  callbacks: SpeechCallbacks | undefined;
  cancelCount = 0;

  voices(): readonly SpeechVoice[] {
    return this.availableVoices;
  }

  speak(text: string, _voice: SpeechVoice, callbacks: SpeechCallbacks): void {
    this.spokenText = text;
    this.callbacks = callbacks;
  }

  cancel(): void {
    this.cancelCount += 1;
  }
}

test("Urdu guidance starts only with an Urdu voice and reports playback completion", () => {
  const speech = new TestSpeechOutput();
  const guidance = new CitizenUrduAudioGuidance(speech);

  guidance.play("اردو رہنمائی");
  assert.equal(guidance.getSnapshot(), "starting");
  assert.equal(speech.spokenText, "اردو رہنمائی");

  speech.callbacks?.onStart();
  assert.equal(guidance.getSnapshot(), "playing");
  speech.callbacks?.onEnd();
  assert.equal(guidance.getSnapshot(), "complete");
});

test("stopping Urdu guidance cancels playback and ignores late completion", () => {
  const speech = new TestSpeechOutput();
  const guidance = new CitizenUrduAudioGuidance(speech);

  guidance.play("اردو رہنمائی");
  speech.callbacks?.onStart();
  guidance.stop();
  speech.callbacks?.onEnd();

  assert.equal(speech.cancelCount, 1);
  assert.equal(guidance.getSnapshot(), "stopped");
});

test("missing Urdu voices are reported without claiming playback", () => {
  const speech = new TestSpeechOutput();
  speech.availableVoices = [{ lang: "en-US" }];
  const guidance = new CitizenUrduAudioGuidance(speech);

  guidance.play("اردو رہنمائی");

  assert.equal(guidance.getSnapshot(), "unavailable");
  assert.equal(speech.spokenText, "");
});

test("speech errors are reported as failed playback", () => {
  const speech = new TestSpeechOutput();
  const guidance = new CitizenUrduAudioGuidance(speech);

  guidance.play("اردو رہنمائی");
  speech.callbacks?.onError();

  assert.equal(guidance.getSnapshot(), "failed");
});
