import assert from "node:assert/strict";
import test from "node:test";

import { createRoomImpulseData } from "../audio/roomImpulse";

test("room impulse data is deterministic, bounded, and decays", () => {
  const first = createRoomImpulseData(8_000, 0.4, 0x51c0);
  const repeated = createRoomImpulseData(8_000, 0.4, 0x51c0);
  const different = createRoomImpulseData(8_000, 0.4, 0x51c1);

  assert.equal(first.length, 2);
  assert.equal(first[0].length, 3_200);
  assert.deepEqual(first, repeated);
  assert.notDeepEqual(first, different);

  first.forEach((channel) => {
    channel.forEach((sample) => {
      assert.ok(Number.isFinite(sample));
      assert.ok(sample >= -1 && sample <= 1);
    });
    const quarter = Math.floor(channel.length / 4);
    assert.ok(rms(channel.subarray(quarter * 3)) < rms(channel.subarray(0, quarter)));
  });
});

function rms(values: Float32Array): number {
  const energy = values.reduce((sum, value) => sum + value * value, 0);
  return Math.sqrt(energy / Math.max(1, values.length));
}
