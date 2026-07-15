import assert from "node:assert/strict";
import test from "node:test";

import type { BowingFrame } from "../gesture/types";
import type { GuidedSongFrame } from "../music/guidedSongEngine";
import { mapGuidedPerformance } from "../music/guidedPerformance";

function bow(overrides: Partial<BowingFrame> = {}): BowingFrame {
  return {
    timestampMs: 100,
    active: true,
    bowing: true,
    x: 0.3,
    pitch: 0,
    horizontalSpeed: 0.9,
    intensity: 0.7,
    direction: -1,
    confidence: 0.96,
    ...overrides,
  };
}

function guided(overrides: Partial<GuidedSongFrame> = {}): GuidedSongFrame {
  const currentNote = { midi: 67, startBeat: 0, durationBeats: 1, dynamic: 0.7, phrase: 0 };
  return {
    phase: "playing",
    countdown: 0,
    transportBeat: 0.5,
    progress: 0.1,
    currentNote,
    currentNoteIndex: 0,
    targetPitch: 0.75,
    handPitch: 0,
    alignment: 0.4,
    speedFactor: 0.5,
    upcomingNotes: [],
    crossedAccompaniment: [],
    score: { total: 80, stars: 2, pitch: 70, continuity: 90, expression: 80 },
    ...overrides,
  };
}

test("guided melody always uses the score note instead of the raw hand lane", () => {
  const state = mapGuidedPerformance(bow({ pitch: 0 }), guided());

  assert.equal(state.midi, 67);
  assert.equal(state.noteName, "G4");
  assert.ok(Math.abs(state.frequencyHz - 392) < 1);
});

test("count-in and completion stay silent", () => {
  assert.equal(mapGuidedPerformance(bow(), guided({ phase: "countIn" })).voiceActive, false);
  assert.equal(mapGuidedPerformance(bow(), guided({ phase: "complete" })).voiceActive, false);
});

test("guided visuals follow target pitch while expression follows the real bow", () => {
  const state = mapGuidedPerformance(
    bow({ intensity: 0.82, direction: -1, x: 0.2 }),
    guided({ targetPitch: 0.75, alignment: 1 }),
  );

  assert.equal(state.pitch, 0.75);
  assert.equal(state.intensity, 0.82);
  assert.equal(state.direction, -1);
  assert.equal(state.bowX, 0.2);
  assert.equal(state.voiceActive, true);
});

test("lost tracking releases a guided melody immediately", () => {
  const state = mapGuidedPerformance(
    bow({ active: false, bowing: false, confidence: 0 }),
    guided(),
  );

  assert.equal(state.voiceActive, false);
  assert.equal(state.intensity, 0);
  assert.equal(state.phase, "idle");
});
