import assert from "node:assert/strict";
import test from "node:test";

import type { BowingFrame } from "../gesture/types";
import {
  GuidedSongEngine,
  calculateScore,
  softGateFactor,
} from "../music/guidedSongEngine";
import type { SongDefinition } from "../music/songTypes";

const SONG: SongDefinition = {
  id: "ode-to-joy",
  title: "Fixture",
  composer: "Test",
  bpm: 60,
  beatsPerBar: 4,
  difficulty: 1,
  durationLabel: "4 seconds",
  totalBeats: 4,
  pitchLanes: [60, 62, 64],
  melody: [
    { midi: 60, startBeat: 0, durationBeats: 2, dynamic: 0.5, phrase: 0 },
    { midi: 64, startBeat: 2, durationBeats: 2, dynamic: 0.5, phrase: 1 },
  ],
  accompaniment: [
    { startBeat: 0, midi: [48, 55, 60], velocity: 0.3, durationBeats: 2 },
    { startBeat: 2, midi: [52, 59, 64], velocity: 0.3, durationBeats: 2 },
  ],
};

function frame(overrides: Partial<BowingFrame> = {}): BowingFrame {
  return {
    timestampMs: 0,
    active: true,
    bowing: true,
    x: 0.5,
    pitch: 0,
    horizontalSpeed: 0.8,
    intensity: 0.5,
    direction: 1,
    confidence: 1,
    ...overrides,
  };
}

function startedEngine(): GuidedSongEngine {
  const engine = new GuidedSongEngine(SONG);
  engine.start(0);
  const playing = engine.update(frame({ bowing: false }), 3000);
  assert.equal(playing.phase, "playing");
  return engine;
}

test("a guided song begins with a three-second count-in", () => {
  const engine = new GuidedSongEngine(SONG);
  assert.equal(engine.start(100).countdown, 3);
  assert.equal(engine.update(frame(), 2099).countdown, 2);
  assert.equal(engine.update(frame(), 3100).phase, "playing");
});

test("transport advances only while bowing", () => {
  const engine = startedEngine();
  const stopped = engine.update(frame({ bowing: false }), 3250);
  assert.equal(stopped.transportBeat, 0);
  const moving = engine.update(frame({ bowing: true }), 3500);
  assert.ok(moving.transportBeat > 0);
});

test("soft gating is full speed near target and bottoms out at thirty percent", () => {
  assert.equal(softGateFactor(0, 0.2), 1);
  assert.equal(softGateFactor(0.09, 0.2), 1);
  assert.equal(softGateFactor(0.3, 0.2), 0.3);
  assert.equal(softGateFactor(1, 0.2), 0.3);
});

test("accurate pitch advances faster than a distant hand", () => {
  const accurate = startedEngine();
  const distant = startedEngine();

  const fast = accurate.update(frame({ pitch: 0 }), 3250);
  const slow = distant.update(frame({ pitch: 1 }), 3250);

  assert.equal(fast.speedFactor, 1);
  assert.equal(slow.speedFactor, 0.3);
  assert.ok(fast.transportBeat > slow.transportBeat * 3);
});

test("note changes and accompaniment cues cross each beat only once", () => {
  const engine = startedEngine();
  const first = engine.update(frame(), 3250);
  assert.deepEqual(first.crossedAccompaniment.map((event) => event.startBeat), [0]);

  let current = first;
  for (let now = 3500; now <= 5000; now += 250) current = engine.update(frame(), now);
  assert.equal(current.currentNote.midi, 64);
  assert.deepEqual(current.crossedAccompaniment.map((event) => event.startBeat), [2]);

  const next = engine.update(frame(), 5250);
  assert.deepEqual(next.crossedAccompaniment, []);
});

test("tracking loss freezes transport and does not reduce continuity", () => {
  const engine = startedEngine();
  const playing = engine.update(frame(), 3250);
  const lost = engine.update(frame({ active: false, bowing: false, confidence: 0 }), 3500);

  assert.equal(lost.transportBeat, playing.transportBeat);
  assert.equal(lost.score.continuity, 100);
});

test("brief bow reversals receive grace before continuity falls", () => {
  const engine = startedEngine();
  engine.update(frame(), 3250);
  const grace = engine.update(frame({ bowing: false, intensity: 0 }), 3500);
  assert.equal(grace.score.continuity, 100);

  const paused = engine.update(frame({ bowing: false, intensity: 0 }), 4000);
  assert.ok(paused.score.continuity < 100);
});

test("score weights and star thresholds are stable", () => {
  assert.deepEqual(calculateScore(1, 1, 1), {
    total: 100,
    stars: 3,
    pitch: 100,
    continuity: 100,
    expression: 100,
  });
  assert.equal(calculateScore(1, 0.5, 0).total, 63);
  assert.equal(calculateScore(1, 0.5, 0).stars, 2);
  assert.equal(calculateScore(0, 0, 0).stars, 1);
});

test("the song completes after its elastic transport reaches the final beat", () => {
  const engine = startedEngine();
  let state = engine.update(frame(), 3250);
  for (let now = 3500; now <= 7000; now += 250) {
    state = engine.update(frame({ pitch: now <= 5000 ? 0 : 1 }), now);
  }

  assert.equal(state.phase, "complete");
  assert.equal(state.progress, 1);
  assert.equal(state.transportBeat, SONG.totalBeats);
  assert.equal(state.score.total, 100);
});
