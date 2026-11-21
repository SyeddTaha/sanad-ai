import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createCitizenSession,
  endCitizenSession,
  CitizenSessionCoordinator,
  startNewCitizenSession,
} from "./citizen-session";
import {
  CitizenUrduAudioGuidance,
  type SpeechCallbacks,
  type SpeechOutput,
} from "./citizen-audio";

test("ending a Citizen session clears local state, stops audio, resets language, and returns home", () => {
  const session = new CitizenSessionCoordinator();
  let privateDraft = "synthetic notice input";
  let consentPreview = "synthetic consent preview";
  let audioStopped = false;
  let languageReset = false;
  let destination = "";
  let announcement = "";

  session.registerPrivateStateClearer(() => {
    privateDraft = "";
  });
  session.registerPrivateStateClearer(() => {
    consentPreview = "";
  });
  session.registerAudioStopper(() => {
    audioStopped = true;
  });

  endCitizenSession({
    session,
    resetLanguage: () => { languageReset = true; },
    navigate: (href) => { destination = href; },
    announce: (message) => { announcement = message; },
    confirmation: "Local Citizen context cleared.",
  });

  assert.equal(privateDraft, "");
  assert.equal(consentPreview, "");
  assert.equal(audioStopped, true);
  assert.equal(languageReset, true);
  assert.equal(destination, "/citizen");
  assert.equal(announcement, "Local Citizen context cleared.");
});

test("late request results are discarded after ending the Citizen session", async () => {
  const session = new CitizenSessionCoordinator();
  let resolveResponse!: (value: string) => void;
  let requestSignal: AbortSignal | undefined;
  const request = session.runRequest((signal) => {
    requestSignal = signal;
    return new Promise<string>((resolve) => {
      resolveResponse = resolve;
    });
  });

  session.endSession();
  resolveResponse("previous Citizen evidence");

  assert.equal(requestSignal?.aborted, true);
  assert.deepEqual(await request, { status: "stale" });
});

test("starting a new Citizen session creates a fresh active coordinator generation", () => {
  const first = createCitizenSession();
  first.coordinator.endSession();

  const second = startNewCitizenSession(first);

  assert.notStrictEqual(second.coordinator, first.coordinator);
  assert.equal(first.coordinator.isEnded, true);
  assert.equal(second.coordinator.isEnded, false);
  assert.equal(second.generation, first.generation + 1);
});

test("a previous session response cannot replace data in the new session", async () => {
  const first = createCitizenSession();
  let resolveResponse!: (value: string) => void;
  const previousRequest = first.coordinator.runRequest(() => new Promise<string>((resolve) => {
    resolveResponse = resolve;
  }));

  first.coordinator.endSession();
  const second = startNewCitizenSession(first);
  resolveResponse("previous Citizen evidence");

  assert.deepEqual(await previousRequest, { status: "stale" });
  assert.deepEqual(
    await second.coordinator.runRequest(async () => "new Citizen evidence"),
    { status: "current", value: "new Citizen evidence" },
  );
});

test("previous-session audio stops and ignores callbacks after restart", () => {
  let callbacks: SpeechCallbacks | undefined;
  let cancelCount = 0;
  const speech: SpeechOutput = {
    voices: () => [{ lang: "ur-PK" }],
    speak: (_text, _voice, nextCallbacks) => { callbacks = nextCallbacks; },
    cancel: () => { cancelCount += 1; },
  };
  const first = createCitizenSession();
  const previousAudio = new CitizenUrduAudioGuidance(speech);
  first.coordinator.registerAudioStopper(() => previousAudio.stop());
  previousAudio.play("اردو رہنمائی");
  callbacks?.onStart();

  first.coordinator.endSession();
  const second = startNewCitizenSession(first);
  callbacks?.onStart();
  callbacks?.onEnd();

  assert.equal(cancelCount, 1);
  assert.equal(previousAudio.getSnapshot(), "stopped");
  assert.equal(new CitizenUrduAudioGuidance(speech).getSnapshot(), "idle");
  assert.equal(second.coordinator.isEnded, false);
});

test("repeated end and start cycles keep creating active session generations", () => {
  let session = createCitizenSession();

  for (let generation = 1; generation <= 3; generation += 1) {
    const previous = session;
    previous.coordinator.endSession();
    session = startNewCitizenSession(previous);

    assert.notStrictEqual(session.coordinator, previous.coordinator);
    assert.equal(session.coordinator.isEnded, false);
    assert.equal(session.generation, generation);
  }
});
