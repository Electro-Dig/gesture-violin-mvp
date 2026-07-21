import assert from "node:assert/strict";
import test from "node:test";

import {
  activeBackend,
  readToneMode,
  shouldLoadSamples,
  shouldNotifySampleFailure,
} from "../audio/toneBackendMode";

test("defaults to sample priority and accepts only the synth override", () => {
  assert.equal(readToneMode(""), "sample");
  assert.equal(readToneMode("?tone=sample"), "sample");
  assert.equal(readToneMode("?tone=invalid"), "sample");
  assert.equal(readToneMode("?demo=1&tone=synth"), "synth");
  assert.equal(shouldLoadSamples("sample"), true);
  assert.equal(shouldLoadSamples("synth"), false);
});

test("keeps synth active until a complete sample set is ready", () => {
  assert.equal(activeBackend("sample", "loading"), "synth");
  assert.equal(activeBackend("sample", "failed"), "synth");
  assert.equal(activeBackend("sample", "ready"), "sample");
  assert.equal(activeBackend("synth", "disabled"), "synth");
  assert.equal(activeBackend("synth", "ready"), "synth");
});

test("notifies only on the first transition into failed readiness", () => {
  assert.equal(shouldNotifySampleFailure("loading", "failed"), true);
  assert.equal(shouldNotifySampleFailure("failed", "failed"), false);
  assert.equal(shouldNotifySampleFailure("ready", "failed"), true);
  assert.equal(shouldNotifySampleFailure("loading", "ready"), false);
});
