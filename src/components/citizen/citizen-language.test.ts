import assert from "node:assert/strict";
import { test } from "node:test";
import { CitizenLanguageController } from "./citizen-language";

test("Citizen language switches from Urdu to English and back to Urdu", () => {
  const language = new CitizenLanguageController();
  const observed: string[] = [];
  language.subscribe(() => observed.push(language.getSnapshot()));

  language.toggle();
  assert.equal(language.getSnapshot(), "en");
  language.toggle();
  assert.equal(language.getSnapshot(), "ur");
  assert.deepEqual(observed, ["en", "ur"]);
});

test("ending a session resets the language to Urdu", () => {
  const language = new CitizenLanguageController();
  language.toggle();

  language.reset();

  assert.equal(language.getSnapshot(), "ur");
});
