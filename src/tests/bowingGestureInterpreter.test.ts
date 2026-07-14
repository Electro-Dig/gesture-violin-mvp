import assert from "node:assert/strict";
import test from "node:test";

import { BowingGestureInterpreter } from "../gesture/bowingGestureInterpreter";
import type { HandFrame, Vec2 } from "../gesture/types";

function landmarks(x: number, y: number): Vec2[] {
  const points = Array.from({ length: 21 }, () => ({ x, y }));
  points[0] = { x: x - 0.015, y: y + 0.035 };
  points[5] = { x: x + 0.025, y: y - 0.01 };
  points[9] = { x: x + 0.01, y: y - 0.035 };
  points[17] = { x: x - 0.02, y: y - 0.005 };
  return points;
}

function handAt(
  x: number,
  y: number,
  timestampMs: number,
  confidence = 0.95,
): HandFrame {
  return {
    timestampMs,
    landmarks: landmarks(x, y),
    handedness: "right",
    confidence,
  };
}

test("vertical palm position selects pitch while horizontal position tracks the bow", () => {
  const interpreter = new BowingGestureInterpreter({ smoothingTauSeconds: 0 });
  const frame = interpreter.update(handAt(0.8, 0.2, 1000));

  assert.ok(frame.x > 0.75);
  assert.ok(frame.pitch > 0.75);
  assert.equal(frame.active, true);
});

test("fast horizontal motion starts bowing and maps speed to intensity", () => {
  const interpreter = new BowingGestureInterpreter({ smoothingTauSeconds: 0 });
  interpreter.update(handAt(0.2, 0.5, 1000));
  const frame = interpreter.update(handAt(0.7, 0.5, 1100));

  assert.equal(frame.bowing, true);
  assert.equal(frame.direction, 1);
  assert.ok(frame.intensity > 0.8);
  assert.ok(frame.horizontalSpeed > 4);
});

test("vertical-only movement does not start a bow stroke", () => {
  const interpreter = new BowingGestureInterpreter({ smoothingTauSeconds: 0 });
  interpreter.update(handAt(0.5, 0.8, 1000));
  const frame = interpreter.update(handAt(0.5, 0.2, 1100));

  assert.equal(frame.bowing, false);
  assert.equal(frame.direction, 0);
  assert.equal(frame.intensity, 0);
});

test("bowing stops when movement stays below the release threshold", () => {
  const interpreter = new BowingGestureInterpreter({ smoothingTauSeconds: 0 });
  interpreter.update(handAt(0.2, 0.5, 1000));
  interpreter.update(handAt(0.7, 0.5, 1100));
  const frame = interpreter.update(handAt(0.701, 0.5, 1300));

  assert.equal(frame.bowing, false);
  assert.equal(frame.intensity, 0);
});

test("missing or low-confidence hands release immediately", () => {
  const interpreter = new BowingGestureInterpreter({ smoothingTauSeconds: 0 });
  interpreter.update(handAt(0.2, 0.5, 1000));
  interpreter.update(handAt(0.8, 0.5, 1100));

  const missing = interpreter.update(null, 1200);
  const uncertain = interpreter.update(handAt(0.5, 0.5, 1300, 0.2));

  assert.equal(missing.active, false);
  assert.equal(missing.bowing, false);
  assert.equal(uncertain.active, false);
  assert.equal(uncertain.intensity, 0);
});

test("camera coordinates are stabilized by exponential smoothing", () => {
  const interpreter = new BowingGestureInterpreter({ smoothingTauSeconds: 0.06 });
  interpreter.update(handAt(0.5, 0.5, 1000));
  const frame = interpreter.update(handAt(1, 0.5, 1016));

  assert.ok(frame.x > 0.5);
  assert.ok(frame.x < 1);
});

test("leftward strokes report a negative direction", () => {
  const interpreter = new BowingGestureInterpreter({ smoothingTauSeconds: 0 });
  interpreter.update(handAt(0.8, 0.5, 1000));
  const frame = interpreter.update(handAt(0.3, 0.5, 1100));

  assert.equal(frame.bowing, true);
  assert.equal(frame.direction, -1);
});
