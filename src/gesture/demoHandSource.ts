import type { HandFrame } from "./types";

export class DemoHandSource {
  sample(timestampMs: number, mode: "free" | "guided" = "free"): HandFrame {
    const x = 0.5 + Math.sin(timestampMs * 0.00215) * 0.4;
    const freeY = 0.52 + Math.sin(timestampMs * 0.00063 + 0.8) * 0.24;
    const guidedY = 0.52 + Math.sin(timestampMs * 0.0017) * 0.018;
    const y = mode === "guided" ? guidedY : freeY;

    return {
      timestampMs,
      landmarks: Array.from({ length: 21 }, () => ({ x, y })),
      handedness: "right",
      confidence: 1,
    };
  }
}
