import type { BowingFrame } from "../gesture/types";
import type { GuidedSongFrame } from "./guidedSongEngine";
import type { PerformanceState } from "./performanceModel";
import { midiToFrequency, midiToNoteName } from "./scale";

export function mapGuidedPerformance(
  bowing: BowingFrame,
  guided: GuidedSongFrame,
): PerformanceState {
  const voiceActive =
    guided.phase === "playing" && bowing.active && bowing.bowing && bowing.intensity > 0;
  const intensity = voiceActive ? clamp01(bowing.intensity) : 0;
  const midi = guided.currentNote.midi;

  return {
    timestampMs: bowing.timestampMs,
    phase: !bowing.active ? "idle" : voiceActive ? "bowing" : "ready",
    voiceActive,
    midi,
    noteName: midiToNoteName(midi),
    frequencyHz: midiToFrequency(midi),
    intensity,
    brightness: (0.18 + intensity * 0.82) * (0.72 + clamp01(guided.alignment) * 0.28),
    bowX: clamp01(bowing.x),
    pitch: clamp01(guided.targetPitch),
    horizontalSpeed: Math.max(0, bowing.horizontalSpeed),
    direction: bowing.direction,
    confidence: clamp01(bowing.confidence),
  };
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
