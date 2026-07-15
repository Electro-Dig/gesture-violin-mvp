import assert from "node:assert/strict";
import test from "node:test";

import { GuidedSongEngine } from "../music/guidedSongEngine";
import { getSong } from "../music/songs/catalogue";
import { buildGuidedDisplay } from "../ui/guidedViewModel";

test("guided display translates score state into stable HUD labels", () => {
  const song = getSong("ode-to-joy");
  const engine = new GuidedSongEngine(song);
  engine.start(0);
  const frame = engine.update({
    timestampMs: 3100,
    active: true,
    bowing: true,
    x: 0.4,
    pitch: 0.5,
    horizontalSpeed: 0.8,
    intensity: 0.65,
    direction: 1,
    confidence: 1,
  }, 3100);
  const display = buildGuidedDisplay(song, frame);

  assert.equal(display.noteName, "E4");
  assert.equal(display.progressLabel, "1 / 48 拍");
  assert.equal(display.scoreLabel, "100");
  assert.match(display.upcomingLabel, /^[A-G]#?\d/);
  assert.ok(display.targetTop >= 0 && display.targetTop <= 100);
  assert.ok(display.handTop >= 0 && display.handTop <= 100);
});

test("guided display makes the elastic slowdown understandable", () => {
  const song = getSong("canon-in-d");
  const engine = new GuidedSongEngine(song);
  engine.start(0);
  const frame = engine.update({
    timestampMs: 3200,
    active: true,
    bowing: true,
    x: 0.6,
    pitch: 1,
    horizontalSpeed: 0.9,
    intensity: 0.5,
    direction: -1,
    confidence: 1,
  }, 3200);
  const display = buildGuidedDisplay(song, frame);

  assert.equal(display.gateTone, "slow");
  assert.equal(display.gateMessage, "靠近目标音高，旋律会前进得更快");
});
