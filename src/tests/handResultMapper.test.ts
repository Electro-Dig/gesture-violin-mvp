import assert from "node:assert/strict";
import test from "node:test";

import { resultToHandFrames } from "../gesture/handResultMapper";

test("MediaPipe results are mirrored to match the camera preview", () => {
  const frames = resultToHandFrames(
    {
      landmarks: [[{ x: 0.2, y: 0.35 }, { x: 0.4, y: 0.5 }]],
      handedness: [[{ categoryName: "Right", score: 0.93 }]],
    },
    1250,
  );

  assert.equal(frames.length, 1);
  assert.equal(frames[0]?.timestampMs, 1250);
  assert.equal(frames[0]?.landmarks[0]?.x, 0.8);
  assert.equal(frames[0]?.landmarks[0]?.y, 0.35);
  assert.equal(frames[0]?.handedness, "right");
  assert.equal(frames[0]?.confidence, 0.93);
});

test("unknown handedness receives a stable confidence fallback", () => {
  const frames = resultToHandFrames({ landmarks: [[{ x: 0.5, y: 0.5 }]] }, 10);

  assert.equal(frames[0]?.handedness, "unknown");
  assert.equal(frames[0]?.confidence, 0.8);
});
