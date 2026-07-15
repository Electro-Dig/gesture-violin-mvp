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

test("guided score motion starts from rest and completes before the note boundary", () => {
  const source = new DemoHandSource();
  const ready = source.sample(2980, "guided", {
    active: false,
    direction: 1,
    durationMs: 600,
    noteIndex: 0,
  }).landmarks[0]!.x;
  const moving = source.sample(3100, "guided", {
    active: true,
    direction: 1,
    durationMs: 600,
    noteIndex: 0,
  }).landmarks[0]!.x;
  const boundary = source.sample(3460, "guided", {
    active: true,
    direction: 1,
    durationMs: 600,
    noteIndex: 0,
  }).landmarks[0]!.x;
  const reversed = source.sample(3470, "guided", {
    active: true,
    direction: -1,
    durationMs: 600,
    noteIndex: 1,
  }).landmarks[0]!.x;
  const leftward = source.sample(3670, "guided", {
    active: true,
    direction: -1,
    durationMs: 600,
    noteIndex: 1,
  }).landmarks[0]!.x;

  assert.ok(moving > ready);
  assert.ok(boundary > moving);
  assert.ok(Math.abs(reversed - boundary) < 1e-9);
  assert.ok(leftward < reversed);
});
