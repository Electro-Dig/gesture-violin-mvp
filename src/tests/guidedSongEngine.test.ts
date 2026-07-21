import assert from "node:assert/strict";
import test from "node:test";

import type { BowingFrame } from "../gesture/types";
import { GuidedSongEngine, calculateScore } from "../music/guidedSongEngine";
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
  source: {
    url: "https://example.test/fixture.mid",
    license: "Public Domain",
    sourceFile: "fixture.mid",
    sourceTrack: 0,
    sourceBeats: [0, 4],
    sha256: "0000000000000000000000000000000000000000000000000000000000000000",
  },
  arrangement: {
    kind: "tutorial-excerpt",
    transposeSemitones: 0,
    melodyStrategy: "monophonic-track",
    transformations: ["Authored locally for deterministic unit tests."],
  },
  pitchLanes: [60, 62, 64, 65],
  melody: [
    { midi: 60, startBeat: 0, durationBeats: 1, dynamic: 0.5, phrase: 0 },
    { midi: 62, startBeat: 1, durationBeats: 1, dynamic: 0.6, phrase: 0 },
    { midi: 64, startBeat: 2, durationBeats: 1, dynamic: 0.7, phrase: 1 },
    { midi: 65, startBeat: 3, durationBeats: 1, dynamic: 0.6, phrase: 1 },
  ],
  accompaniment: [
    { startBeat: 0, midi: [48, 55, 60], velocity: 0.3, durationBeats: 2 },
    { startBeat: 2, midi: [53, 60, 65], velocity: 0.3, durationBeats: 2 },
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
  const playing = engine.update(frame({ bowing: false, direction: 0 }), 3000);
  assert.equal(playing.phase, "playing");
  return engine;
}

test("a guided song begins with a three-second count-in", () => {
  const engine = new GuidedSongEngine(SONG);
  assert.equal(engine.start(100).countdown, 3);
  assert.equal(engine.update(frame(), 2099).countdown, 2);
  assert.equal(engine.update(frame(), 3100).phase, "playing");
});

test("guided pitch no longer changes transport speed", () => {
  const low = startedEngine();
  const high = startedEngine();

  const lowState = low.update(frame({ pitch: 0 }), 3250);
  const highState = high.update(frame({ pitch: 1 }), 3250);

  assert.equal(lowState.transportBeat, highState.transportBeat);
  assert.equal(lowState.transportBeat, 0.25);
});

test("expected bow direction alternates for each score note", () => {
  const engine = startedEngine();
  const first = engine.update(frame({ direction: 1 }), 3050);
  assert.equal(first.lastJudgment, "perfect");
  assert.equal(first.expectedDirection, -1);

  let state = first;
  for (let now = 3150; now <= 3800; now += 100) {
    state = engine.update(frame({ direction: 1 }), now);
  }
  const second = engine.update(frame({ direction: -1 }), 3810);
  assert.equal(second.lastJudgment, "good");
  assert.equal(second.expectedDirection, 1);
});

test("perfect, good, and missed notes receive stable timing grades", () => {
  const perfectEngine = startedEngine();
  const perfect = perfectEngine.update(frame({ direction: 1 }), 3050);
  assert.equal(perfect.lastJudgment, "perfect");

  const goodEngine = startedEngine();
  goodEngine.update(frame({ direction: -1 }), 3200);
  const good = goodEngine.update(frame({ direction: 1 }), 3210);
  assert.equal(good.lastJudgment, "good");

  const missEngine = startedEngine();
  missEngine.update(frame({ direction: -1 }), 3250);
  const missed = missEngine.update(frame({ direction: -1 }), 3500);
  assert.equal(missed.lastJudgment, "miss");
});

test("a score note is judged at most once", () => {
  const engine = startedEngine();
  const first = engine.update(frame({ direction: 1 }), 3050);
  const repeated = engine.update(frame({ direction: 1 }), 3100);

  assert.equal(first.judgedNoteCount, 1);
  assert.equal(repeated.judgedNoteCount, 1);
});

test("turnaround grace keeps transport moving across a brief reversal", () => {
  const engine = startedEngine();
  const moving = engine.update(frame(), 3250);
  const turning = engine.update(frame({ bowing: false, direction: 0, intensity: 0 }), 3375);
  const stopped = engine.update(frame({ bowing: false, direction: 0, intensity: 0 }), 3700);

  assert.ok(turning.transportBeat > moving.transportBeat);
  assert.equal(stopped.transportBeat, turning.transportBeat);
});

test("tracking loss freezes transport and does not reduce continuity", () => {
  const engine = startedEngine();
  const playing = engine.update(frame(), 3250);
  const lost = engine.update(frame({ active: false, bowing: false, direction: 0, confidence: 0 }), 3500);

  assert.equal(lost.transportBeat, playing.transportBeat);
  assert.equal(lost.score.continuity, 100);
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

test("score weights and star thresholds use direction timing", () => {
  assert.deepEqual(calculateScore(1, 1, 1), {
    total: 100,
    stars: 3,
    timing: 100,
    continuity: 100,
    expression: 100,
  });
  assert.equal(calculateScore(1, 0.5, 0).total, 63);
  assert.equal(calculateScore(1, 0.5, 0).stars, 2);
  assert.equal(calculateScore(0, 0, 0).stars, 1);
});

test("the song completes without requiring correct vertical pitch", () => {
  const engine = startedEngine();
  let state = engine.update(frame({ pitch: 1 }), 3250);
  for (let now = 3500; now <= 7000; now += 250) {
    state = engine.update(frame({ pitch: now % 500 === 0 ? 0 : 1 }), now);
  }

  assert.equal(state.phase, "complete");
  assert.equal(state.progress, 1);
  assert.equal(state.transportBeat, SONG.totalBeats);
});
