import type { BowingFrame } from "../gesture/types";
import { FRIENDLY_SCALE } from "./scale";

export { FRIENDLY_SCALE } from "./scale";

export type PerformancePhase = "idle" | "ready" | "bowing";

export type PerformanceState = {
  timestampMs: number;
  phase: PerformancePhase;
  voiceActive: boolean;
  midi: number;
  noteName: string;
  frequencyHz: number;
  intensity: number;
  brightness: number;
  bowX: number;
  pitch: number;
  horizontalSpeed: number;
  direction: -1 | 0 | 1;
  confidence: number;
};

export function mapPerformance(frame: BowingFrame): PerformanceState {
  const pitch = clamp01(frame.pitch);
  const scaleIndex = Math.round(pitch * (FRIENDLY_SCALE.length - 1));
  const note = FRIENDLY_SCALE[scaleIndex] ?? FRIENDLY_SCALE[0]!;
  const voiceActive = frame.active && frame.bowing && frame.intensity > 0;
  const intensity = voiceActive ? clamp01(frame.intensity) : 0;

  return {
    timestampMs: frame.timestampMs,
    phase: !frame.active ? "idle" : voiceActive ? "bowing" : "ready",
    voiceActive,
    midi: note.midi,
    noteName: note.noteName,
    frequencyHz: note.frequencyHz,
    intensity,
    brightness: 0.18 + intensity * 0.82,
    bowX: clamp01(frame.x),
    pitch,
    horizontalSpeed: Math.max(0, frame.horizontalSpeed),
    direction: frame.direction,
    confidence: clamp01(frame.confidence),
  };
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
