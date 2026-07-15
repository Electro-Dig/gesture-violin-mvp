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

test("guided demo stays vertically central while reversing the bow", () => {
  const source = new DemoHandSource();
  const positions = Array.from({ length: 24 }, (_, index) => source.sample(index * 250, "guided"));
  const xs = positions.map((frame) => frame.landmarks[0]!.x);
  const ys = positions.map((frame) => frame.landmarks[0]!.y);

  assert.ok(Math.max(...xs) - Math.min(...xs) > 0.6);
  assert.ok(Math.max(...ys) - Math.min(...ys) < 0.08);
});
