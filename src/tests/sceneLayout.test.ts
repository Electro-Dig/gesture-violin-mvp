import assert from "node:assert/strict";
import test from "node:test";

import { mapBowPose } from "../scene/sceneLayout";

test("horizontal hand travel spans the playable bow range", () => {
  const left = mapBowPose({ bowX: 0, pitch: 0.5, intensity: 0.5, direction: -1, phase: "bowing" });
  const right = mapBowPose({ bowX: 1, pitch: 0.5, intensity: 0.5, direction: 1, phase: "bowing" });

  assert.ok(left.x < 0);
  assert.ok(right.x > 0);
  assert.ok(right.x - left.x >= 2.5);
});

test("vertical hand position selects one of four visible strings", () => {
  assert.equal(mapBowPose({ bowX: 0.5, pitch: 0, intensity: 0, direction: 0, phase: "ready" }).stringIndex, 0);
  assert.equal(mapBowPose({ bowX: 0.5, pitch: 1, intensity: 0, direction: 0, phase: "ready" }).stringIndex, 3);
});

test("bow direction tilts the animated bow and idle mode recedes", () => {
  const left = mapBowPose({ bowX: 0.5, pitch: 0.5, intensity: 0.6, direction: -1, phase: "bowing" });
  const right = mapBowPose({ bowX: 0.5, pitch: 0.5, intensity: 0.6, direction: 1, phase: "bowing" });
  const idle = mapBowPose({ bowX: 0.5, pitch: 0.5, intensity: 0, direction: 0, phase: "idle" });

  assert.ok(left.rotationZ < 0);
  assert.ok(right.rotationZ > 0);
  assert.ok(idle.opacity < left.opacity);
});

test("keeps the violin body stable while bow expression moves", () => {
  const soft = mapBowPose({ bowX: 0.3, pitch: 0.5, intensity: 0.2, direction: 1, phase: "bowing" });
  const strong = mapBowPose({ bowX: 0.8, pitch: 0.5, intensity: 1, direction: -1, phase: "bowing" });

  assert.equal(soft.instrumentScale, 1);
  assert.equal(strong.instrumentScale, 1);
  assert.notEqual(soft.x, strong.x);
});
