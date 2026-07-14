import assert from "node:assert/strict";
import test from "node:test";

import type { PerformanceState } from "../music/performanceModel";
import { mapStringVoice } from "../audio/stringVoiceModel";

function state(overrides: Partial<PerformanceState> = {}): PerformanceState {
  return {
    timestampMs: 100,
    phase: "bowing",
    voiceActive: true,
    midi: 69,
    noteName: "A4",
    frequencyHz: 440,
    intensity: 0.5,
    brightness: 0.6,
    bowX: 0.5,
    pitch: 0.5,
    horizontalSpeed: 0.8,
    direction: 1,
    confidence: 1,
    ...overrides,
  };
}

test("an inactive bow produces a silent voice", () => {
  const params = mapStringVoice(state({ voiceActive: false, phase: "ready", intensity: 0 }));

  assert.equal(params.gain, 0);
  assert.equal(params.noiseGain, 0);
});

test("bow intensity opens volume, brightness, and bow noise together", () => {
  const soft = mapStringVoice(state({ intensity: 0.15, brightness: 0.3 }));
  const strong = mapStringVoice(state({ intensity: 0.95, brightness: 0.95 }));

  assert.ok(strong.gain > soft.gain);
  assert.ok(strong.filterHz > soft.filterHz);
  assert.ok(strong.noiseGain > soft.noiseGain);
});

test("the synth model follows the selected musical frequency", () => {
  assert.equal(mapStringVoice(state({ frequencyHz: 523.25 })).frequencyHz, 523.25);
});

test("all generated parameters stay in conservative browser-audio bounds", () => {
  const params = mapStringVoice(state({ intensity: 4, brightness: -2 }));

  assert.ok(params.gain <= 0.2);
  assert.ok(params.filterHz >= 500 && params.filterHz <= 5000);
  assert.ok(params.noiseGain <= 0.08);
});
