import type { HandFrame } from "./types";

export type GuidedDemoCue = {
  active: boolean;
  direction: -1 | 1;
  durationMs: number;
  noteIndex: number;
};

export class DemoHandSource {
  private guidedX = 0.5;
  private guidedCueNoteIndex: number | null = null;
  private guidedCueStartedAtMs: number | null = null;

  sample(
    timestampMs: number,
    mode: "free" | "guided" = "free",
    cue?: GuidedDemoCue,
  ): HandFrame {
    const x = mode === "guided" && cue
      ? this.sampleGuidedCue(timestampMs, cue)
      : 0.5 + Math.sin(timestampMs * 0.00215) * 0.4;
    const freeY = 0.52 + Math.sin(timestampMs * 0.00063 + 0.8) * 0.24;
    const guidedY = 0.52 + Math.sin(timestampMs * 0.0017) * 0.018;
    const y = mode === "guided" ? guidedY : freeY;

    if (mode === "free") {
      this.guidedCueNoteIndex = null;
      this.guidedCueStartedAtMs = null;
    }

    return {
      timestampMs,
      landmarks: Array.from({ length: 21 }, () => ({ x, y })),
      handedness: "right",
      confidence: 1,
    };
  }

  private sampleGuidedCue(timestampMs: number, cue: GuidedDemoCue): number {
    const start = cue.direction === 1 ? 0.22 : 0.78;
    const end = cue.direction === 1 ? 0.78 : 0.22;

    if (!cue.active) {
      this.guidedX = start;
      this.guidedCueNoteIndex = cue.noteIndex;
      this.guidedCueStartedAtMs = timestampMs;
      return this.guidedX;
    }

    if (this.guidedCueNoteIndex !== cue.noteIndex || this.guidedCueStartedAtMs === null) {
      this.guidedX = start;
      this.guidedCueNoteIndex = cue.noteIndex;
      this.guidedCueStartedAtMs = timestampMs;
      return this.guidedX;
    }

    const effectiveDurationMs = Math.max(cue.durationMs - 120, 120);
    const progress = clamp((timestampMs - this.guidedCueStartedAtMs) / effectiveDurationMs, 0, 1);
    this.guidedX = start + (end - start) * progress;
    return this.guidedX;
  }
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}
