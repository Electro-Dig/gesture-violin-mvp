import assert from "node:assert/strict";
import test from "node:test";

import { DemoHandSource } from "../gesture/demoHandSource";

test("demo input stays normalized while moving on both axes", () => {
  const source = new DemoHandSource();
  const positions = Array.from({ length: 20 }, (_, index) => source.sample(index * 250));
  const xs = positions.map((frame) => frame.landmarks[0]?.x ?? 0);
  const ys = positions.map((frame) => frame.landmarks[0]?.y ?? 0);

  assert.ok(xs.every((value) => value >= 0 && value <= 1));
  assert.ok(ys.every((value) => value >= 0 && value <= 1));
  assert.ok(Math.max(...xs) - Math.min(...xs) > 0.5);
  assert.ok(Math.max(...ys) - Math.min(...ys) > 0.2);
});

test("demo input emits the same 21-landmark contract as camera input", () => {
  const frame = new DemoHandSource().sample(1000);

  assert.equal(frame.landmarks.length, 21);
  assert.equal(frame.confidence, 1);
});

test("guided demo input follows a requested pitch while keeping a bow stroke", () => {
  const source = new DemoHandSource();
  const lowTarget = source.sample(1000, 0.2);
  const highTarget = source.sample(1250, 0.8);

  assert.ok(Math.abs((1 - lowTarget.landmarks[0]!.y) - 0.2) < 0.04);
  assert.ok(Math.abs((1 - highTarget.landmarks[0]!.y) - 0.8) < 0.04);
  assert.notEqual(lowTarget.landmarks[0]!.x, highTarget.landmarks[0]!.x);
});
