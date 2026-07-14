import type { PerformancePhase } from "../music/performanceModel";

export type BowPoseInput = {
  bowX: number;
  pitch: number;
  intensity: number;
  direction: -1 | 0 | 1;
  phase: PerformancePhase;
};

export type BowPose = {
  x: number;
  y: number;
  rotationZ: number;
  opacity: number;
  glow: number;
  stringIndex: number;
};

export function mapBowPose(input: BowPoseInput): BowPose {
  const x = clamp01(input.bowX);
  const pitch = clamp01(input.pitch);
  const intensity = clamp01(input.intensity);

  return {
    x: lerp(-1.55, 1.55, x),
    y: lerp(-0.17, 0.2, pitch),
    rotationZ: input.direction * (0.025 + intensity * 0.055),
    opacity: input.phase === "idle" ? 0.38 : input.phase === "ready" ? 0.72 : 1,
    glow: input.phase === "bowing" ? 0.2 + intensity * 2.8 : 0.05,
    stringIndex: Math.min(3, Math.floor(pitch * 4)),
  };
}

function lerp(start: number, end: number, amount: number): number {
  return start + (end - start) * amount;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
