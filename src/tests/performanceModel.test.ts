import assert from "node:assert/strict";
import test from "node:test";

import type { BowingFrame } from "../gesture/types";
import { FRIENDLY_SCALE, mapPerformance } from "../music/performanceModel";

function frame(overrides: Partial<BowingFrame> = {}): BowingFrame {
  return {
    timestampMs: 1000,
    active: true,
    bowing: true,
    x: 0.5,
    pitch: 0.5,
    horizontalSpeed: 0.8,
    intensity: 0.5,
    direction: 1,
    confidence: 0.95,
    ...overrides,
  };
}

test("higher hand positions select higher notes", () => {
  const low = mapPerformance(frame({ pitch: 0 }));
  const high = mapPerformance(frame({ pitch: 1 }));

  assert.ok(high.midi > low.midi);
  assert.ok(high.frequencyHz > low.frequencyHz);
});

test("all selected notes belong to the friendly C-major pentatonic range", () => {
  for (let index = 0; index <= 100; index += 1) {
    const state = mapPerformance(frame({ pitch: index / 100 }));
    assert.ok(FRIENDLY_SCALE.some((note) => note.midi === state.midi));
  }
});

test("stationary hands produce silence while preserving the selected note", () => {
  const state = mapPerformance(
    frame({ bowing: false, horizontalSpeed: 0, intensity: 0, pitch: 0.5 }),
  );

  assert.equal(state.voiceActive, false);
  assert.ok(state.frequencyHz > 0);
  assert.notEqual(state.noteName, "");
});

test("faster bowing increases intensity and brightness", () => {
  const quiet = mapPerformance(frame({ intensity: 0.2, horizontalSpeed: 0.3 }));
  const loud = mapPerformance(frame({ intensity: 0.9, horizontalSpeed: 1.4 }));

  assert.ok(loud.intensity > quiet.intensity);
  assert.ok(loud.brightness > quiet.brightness);
});

test("lost tracking releases the voice", () => {
  const state = mapPerformance(frame({ active: false, confidence: 0 }));

  assert.equal(state.voiceActive, false);
  assert.equal(state.intensity, 0);
  assert.equal(state.phase, "idle");
});

test("an active stationary hand stays ready without sounding", () => {
  const state = mapPerformance(frame({ bowing: false, intensity: 0 }));

  assert.equal(state.phase, "ready");
  assert.equal(state.voiceActive, false);
});
