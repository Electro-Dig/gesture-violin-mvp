import assert from "node:assert/strict";
import test from "node:test";

import { MouseRehearsalSource, normalizePointer } from "../gesture/mouseRehearsalSource";

test("mouse rehearsal stays inactive until the pointer is pressed", () => {
  const source = new MouseRehearsalSource();

  assert.equal(source.sample(100), null);
});

test("a pressed pointer produces a complete synthetic hand frame", () => {
  const source = new MouseRehearsalSource();
  source.press(0.25, 0.7);

  const frame = source.sample(800);
  assert.equal(frame?.timestampMs, 800);
  assert.equal(frame?.confidence, 1);
  assert.equal(frame?.landmarks.length, 21);
  assert.equal(frame?.landmarks[9]?.x, 0.25);
  assert.equal(frame?.landmarks[9]?.y, 0.7);
});

test("mouse coordinates clamp to the performance surface and release cleanly", () => {
  const source = new MouseRehearsalSource();
  source.press(-1, 2);
  assert.deepEqual(source.sample(10)?.landmarks[0], { x: 0, y: 1 });

  source.move(2, -1);
  assert.deepEqual(source.sample(20)?.landmarks[0], { x: 1, y: 0 });

  source.release();
  assert.equal(source.sample(30), null);
});

test("client coordinates normalize against a DOM rectangle", () => {
  assert.deepEqual(
    normalizePointer(150, 90, { left: 50, top: 40, width: 200, height: 100 }),
    { x: 0.5, y: 0.5 },
  );
});
