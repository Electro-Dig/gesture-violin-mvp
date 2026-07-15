import assert from "node:assert/strict";
import test from "node:test";

import type { BowingFrame } from "../gesture/types";
import { GuidedSongEngine } from "../music/guidedSongEngine";
import { getSong } from "../music/songs/catalogue";
import { buildGuidedDisplay } from "../ui/guidedViewModel";

function bow(overrides: Partial<BowingFrame> = {}): BowingFrame {
  return {
    timestampMs: 3000,
    active: true,
    bowing: true,
    x: 0.4,
    pitch: 0.5,
    horizontalSpeed: 0.8,
    intensity: 0.65,
    direction: 1,
    confidence: 1,
    ...overrides,
  };
}

test("the current note reaches a fixed judgment line", () => {
  const song = getSong("ode-to-joy");
  const engine = new GuidedSongEngine(song);
  engine.start(0);
  const frame = engine.update(bow({ bowing: false, direction: 0 }), 3000);
  const display = buildGuidedDisplay(song, frame);
  const current = display.cues.find((cue) => cue.noteIndex === 0);

  assert.equal(current?.topPercent, 68);
  assert.equal(current?.expectedDirection, 1);
  assert.equal(display.directionMessage, "向右换弓");
  assert.equal(display.cursorLeft, 40);
});

test("the rhythm strip looks ahead and removes vertical pitch chasing", () => {
  const song = getSong("ode-to-joy");
  const engine = new GuidedSongEngine(song);
  engine.start(0);
  const frame = engine.update(bow({ bowing: false, direction: 0 }), 3000);
  const display = buildGuidedDisplay(song, frame);

  assert.ok(display.cues.length >= 3);
  assert.ok(display.cues.every((cue) => cue.topPercent >= 0 && cue.topPercent <= 100));
  assert.ok(display.cues[1]!.topPercent < display.cues[0]!.topPercent);
  assert.equal("targetTop" in display, false);
  assert.equal("handTop" in display, false);
});

test("direction judgments become concise live feedback", () => {
  const song = getSong("ode-to-joy");
  const engine = new GuidedSongEngine(song);
  engine.start(0);
  engine.update(bow({ bowing: false, direction: 0 }), 3000);
  const frame = engine.update(bow({ direction: 1 }), 3050);
  const display = buildGuidedDisplay(song, frame);

  assert.equal(display.timingLabel, "精准");
  assert.equal(display.timingTone, "perfect");
  assert.equal(display.directionMessage, "向左换弓");
  assert.equal(display.progressLabel, "1 / 48 拍");
});

test("count-in explains the simplified bow-only interaction", () => {
  const song = getSong("ode-to-joy");
  const engine = new GuidedSongEngine(song);
  const frame = engine.start(0);
  const display = buildGuidedDisplay(song, frame);

  assert.equal(display.timingLabel, "准备");
  assert.equal(display.helperMessage, "音符到达红线时，改变拉弓方向");
});
