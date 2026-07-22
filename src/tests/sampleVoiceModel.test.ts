import assert from "node:assert/strict";
import test from "node:test";

import type { PerformanceState } from "../music/performanceModel";
import {
  CONTINUATION_CROSSFADE_SECONDS,
  layerGains,
  needsFreshBow,
  playbackRate,
  selectSampleRoot,
  shouldContinue,
  type SampleVoiceFrame,
} from "../audio/sampleVoiceModel";

function frame(overrides: Partial<SampleVoiceFrame> = {}): SampleVoiceFrame {
  return {
    voiceActive: true,
    phase: "bowing",
    midi: 69,
    intensity: 0.5,
    direction: 1,
    ...overrides,
  };
}

test("maps all eight playable notes to an official root within two semitones", () => {
  const playable = [60, 62, 64, 67, 69, 72, 74, 76];
  const roots = playable.map((midi) => selectSampleRoot(midi).rootMidi);

  assert.deepEqual(roots, [60, 64, 64, 67, 69, 72, 76, 76]);
  playable.forEach((midi, index) => {
    assert.ok(Math.abs(midi - roots[index]!) <= 2);
  });
});

test("computes the chromatic playback rate from target and root MIDI", () => {
  assert.equal(playbackRate(64, 64), 1);
  assert.ok(Math.abs(playbackRate(62, 64) - 2 ** (-2 / 12)) < 1e-12);
});

test("crossfades piano and forte layers with finite equal-power gains", () => {
  assert.deepEqual(layerGains(0), { piano: 1, forte: 0 });
  assert.ok(Math.abs(layerGains(0.5).piano - Math.SQRT1_2) < 1e-12);
  assert.ok(Math.abs(layerGains(0.5).forte - Math.SQRT1_2) < 1e-12);
  assert.ok(layerGains(1).piano < 1e-12);
  assert.equal(layerGains(1).forte, 1);

  let previous = layerGains(0);
  for (let step = 1; step <= 20; step += 1) {
    const current = layerGains(step / 20);
    assert.ok(Number.isFinite(current.piano) && Number.isFinite(current.forte));
    assert.ok(current.piano <= previous.piano);
    assert.ok(current.forte >= previous.forte);
    previous = current;
  }
});

test("requests a fresh bow only for a real articulation boundary", () => {
  assert.equal(needsFreshBow(null, frame()), true);
  assert.equal(needsFreshBow(frame({ voiceActive: false, phase: "ready" }), frame()), true);
  assert.equal(needsFreshBow(frame(), frame({ midi: 72 })), true);
  assert.equal(needsFreshBow(frame({ direction: 1 }), frame({ direction: -1 })), true);
  assert.equal(needsFreshBow(frame(), frame({ intensity: 0.8 })), false);
  assert.equal(needsFreshBow(frame({ direction: 0 }), frame({ direction: 1 })), false);
  assert.equal(needsFreshBow(frame(), frame({ voiceActive: false, phase: "ready" })), false);
});

test("continues only an active voice near the source tail", () => {
  assert.equal(shouldContinue(true, 0.181), false);
  assert.equal(shouldContinue(true, 0.18), true);
  assert.equal(shouldContinue(false, 0.1), false);
  assert.equal(CONTINUATION_CROSSFADE_SECONDS, 0.09);
});

test("sample frames stay structurally compatible with performance state", () => {
  const state = {} as PerformanceState;
  const sampleFrame: SampleVoiceFrame = {
    voiceActive: state.voiceActive,
    phase: state.phase,
    midi: state.midi,
    intensity: state.intensity,
    direction: state.direction,
  };
  assert.equal(Object.keys(sampleFrame).length, 5);
});

test("does not restart the previous guided note for an early reversal", () => {
  const previous = frame({ direction: 1, articulationId: 7 });
  const earlyReverse = frame({ direction: -1, articulationId: 7 });
  assert.equal(needsFreshBow(previous, earlyReverse), false);
});

test("restarts at a new guided note even when the pitch repeats", () => {
  const previous = frame({ midi: 64, articulationId: 7 });
  const repeatedPitch = frame({ midi: 64, articulationId: 8 });
  assert.equal(needsFreshBow(previous, repeatedPitch), true);
});

test("keeps direction articulation in free performance", () => {
  assert.equal(
    needsFreshBow(frame({ direction: 1 }), frame({ direction: -1 })),
    true,
  );
});
