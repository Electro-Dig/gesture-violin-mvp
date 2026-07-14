import type { PerformanceState } from "../music/performanceModel";

export type StringVoiceParams = {
  frequencyHz: number;
  gain: number;
  filterHz: number;
  noiseGain: number;
  vibratoHz: number;
  vibratoDepth: number;
  attackSeconds: number;
  releaseSeconds: number;
};

export function mapStringVoice(state: PerformanceState): StringVoiceParams {
  const intensity = clamp01(state.intensity);
  const brightness = clamp01(state.brightness);
  const voiceActive = state.voiceActive && state.phase === "bowing";

  return {
    frequencyHz: Math.max(20, state.frequencyHz),
    gain: voiceActive ? 0.025 + intensity * 0.155 : 0,
    filterHz: 650 + brightness * 3850,
    noiseGain: voiceActive ? 0.008 + intensity * 0.056 : 0,
    vibratoHz: 5.15,
    vibratoDepth: voiceActive ? 1.3 + intensity * 2.7 : 0,
    attackSeconds: 0.028,
    releaseSeconds: 0.11,
  };
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
