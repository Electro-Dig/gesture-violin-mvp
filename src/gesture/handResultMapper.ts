import type { HandFrame, Vec2 } from "./types";

export type VisionResultLike = {
  landmarks: ReadonlyArray<ReadonlyArray<Vec2>>;
  handedness?: ReadonlyArray<
    ReadonlyArray<{
      categoryName?: string;
      score?: number;
    }>
  >;
};

export function resultToHandFrames(
  result: VisionResultLike,
  timestampMs: number,
): HandFrame[] {
  return result.landmarks.map((landmarks, index) => {
    const category = result.handedness?.[index]?.[0];
    const label = category?.categoryName?.toLowerCase();

    return {
      timestampMs,
      landmarks: landmarks.map((landmark) => ({
        x: clamp01(1 - landmark.x),
        y: clamp01(landmark.y),
      })),
      handedness:
        label === "left" ? "left" : label === "right" ? "right" : "unknown",
      confidence: clamp01(category?.score ?? 0.8),
    };
  });
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
