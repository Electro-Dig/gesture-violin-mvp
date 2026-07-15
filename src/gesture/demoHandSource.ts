import type { HandFrame } from "./types";

export class DemoHandSource {
  sample(timestampMs: number, targetPitch?: number): HandFrame {
    const x = 0.5 + Math.sin(timestampMs * 0.00215) * 0.4;
    const freeY = 0.52 + Math.sin(timestampMs * 0.00063 + 0.8) * 0.24;
    const guidedDrift = Math.sin(timestampMs * 0.0017) * 0.018;
    const y = targetPitch === undefined
      ? freeY
      : clamp(1 - targetPitch + guidedDrift, 0.03, 0.97);

    return {
      timestampMs,
      landmarks: Array.from({ length: 21 }, () => ({ x, y })),
      handedness: "right",
      confidence: 1,
    };
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
