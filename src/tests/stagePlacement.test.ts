import assert from "node:assert/strict";
import test from "node:test";

import {
  mapStageCamera,
  mapStagePlacement,
} from "../scene/stagePlacement";

test("keeps the violin on the right at desktop aspect ratios", () => {
  assert.deepEqual(mapStagePlacement(16 / 9), {
    x: 1.72,
    y: -0.38,
    scale: 0.84,
  });
});

test("keeps the instrument visible on portrait screens", () => {
  assert.deepEqual(mapStagePlacement(9 / 16), {
    x: 1.15,
    y: -0.62,
    scale: 0.68,
  });
});

test("uses the middle composition at tablet ratios", () => {
  assert.deepEqual(mapStagePlacement(4 / 3), {
    x: 1.35,
    y: -0.48,
    scale: 0.76,
  });
});

test("reframes the camera to keep the right-side violin visible in portrait", () => {
  assert.deepEqual(mapStageCamera(9 / 16), {
    x: 0.72,
    z: 9.1,
  });
  assert.deepEqual(mapStageCamera(16 / 9), { x: 0, z: 8.1 });
});
