import assert from "node:assert/strict";
import test from "node:test";

import { planAccompanimentVoices } from "../audio/accompanimentModel";

test("accompaniment creates a quiet chord plus an octave-low bass", () => {
  const plan = planAccompanimentVoices(
    { startBeat: 0, midi: [50, 57, 62], velocity: 0.4, durationBeats: 4 },
    60,
  );

  assert.equal(plan.voices.length, 4);
  assert.equal(plan.voices[0]?.midi, 38);
  assert.equal(plan.voices[0]?.waveform, "sine");
  assert.equal(plan.voices[1]?.waveform, "triangle");
});

test("accompaniment release and summed gain remain conservative", () => {
  const plan = planAccompanimentVoices(
    { startBeat: 0, midi: [48, 55, 60, 64], velocity: 1, durationBeats: 8 },
    40,
  );

  assert.equal(plan.releaseSeconds, 1.8);
  assert.ok(plan.voices.reduce((sum, voice) => sum + voice.gain, 0) <= 0.11);
  assert.ok(plan.voices.every((voice) => voice.frequencyHz > 20));
});
