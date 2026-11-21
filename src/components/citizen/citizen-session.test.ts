import assert from "node:assert/strict";
import { test } from "node:test";
import { endCitizenSession, CitizenSessionCoordinator } from "./citizen-session";

test("ending a Citizen session clears local state, stops audio, resets language, and returns home", () => {
  const session = new CitizenSessionCoordinator();
  let privateDraft = "synthetic notice input";
  let audioStopped = false;
  let languageReset = false;
  let destination = "";
  let announcement = "";

  session.registerPrivateStateClearer(() => {
    privateDraft = "";
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
