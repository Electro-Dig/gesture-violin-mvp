import assert from "node:assert/strict";
import test from "node:test";

import {
  VideoFrameGate,
  createWithDelegateFallback,
} from "../gesture/videoFrameRuntime";

test("VideoFrameGate accepts each media frame once", () => {
  const gate = new VideoFrameGate();

  assert.equal(gate.accept(1.25), true);
  assert.equal(gate.accept(1.25), false);
  assert.equal(gate.accept(1.251), true);
});

test("VideoFrameGate rejects invalid times and can reset", () => {
  const gate = new VideoFrameGate();

  assert.equal(gate.accept(Number.NaN), false);
  assert.equal(gate.accept(0), true);
  assert.equal(gate.accept(-1), false);
  gate.reset();
  assert.equal(gate.accept(0), true);
});

test("delegate creation falls back from GPU to CPU", async () => {
  const attempts: string[] = [];
  const result = await createWithDelegateFallback(async (delegate) => {
    attempts.push(delegate);
    if (delegate === "GPU") throw new Error("GPU unavailable");
    return { delegate };
  });

  assert.deepEqual(attempts, ["GPU", "CPU"]);
  assert.equal(result.delegate, "CPU");
});

test("delegate creation keeps the GPU result when available", async () => {
  const attempts: string[] = [];
  const result = await createWithDelegateFallback(async (delegate) => {
    attempts.push(delegate);
    return { delegate };
  });

  assert.deepEqual(attempts, ["GPU"]);
  assert.equal(result.delegate, "GPU");
});
