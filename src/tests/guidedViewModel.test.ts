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
  const current = display.orbitCues.find((cue) => cue.id === "ode-to-joy-0");

  assert.equal(current?.angleDeg, 214);
  assert.equal(current?.expectedDirection, 1);
  assert.equal(display.directionMessage, "向右换弓");
});

test("the rhythm orbit looks ahead and reports measure progress", () => {
  const song = getSong("ode-to-joy");
  const engine = new GuidedSongEngine(song);
  engine.start(0);
  const frame = engine.update(bow({ bowing: false, direction: 0 }), 3000);
  const display = buildGuidedDisplay(song, frame);

  assert.ok(display.orbitCues.length >= 3);
  assert.ok(display.orbitCues.every((cue) => cue.sweepDeg >= 7 && cue.sweepDeg <= 48));
  assert.equal(display.measureOverview.currentMeasure, 1);
  assert.equal(display.measureOverview.totalMeasures, 12);
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
  const song = getSong("canon-in-d");
  const engine = new GuidedSongEngine(song);
  const frame = engine.start(0);
  const display = buildGuidedDisplay(song, frame);

  assert.equal(display.timingLabel, "准备");
  assert.equal(display.helperMessage, "音符抵达左下命中点时，改变拉弓方向");
});

test("creates one pulse key for each judged score note", () => {
  const song = getSong("ode-to-joy");
  const engine = new GuidedSongEngine(song);
  engine.start(0);
  engine.update(bow({ bowing: false, direction: 0 }), 3000);
  const judged = engine.update(bow({ direction: 1 }), 3050);
  const display = buildGuidedDisplay(song, judged);

  assert.equal(display.judgmentPulseKey, `${judged.lastJudgmentNoteIndex}:${judged.lastJudgment}`);
});
