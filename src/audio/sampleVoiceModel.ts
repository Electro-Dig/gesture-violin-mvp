import type { PerformanceState } from "../music/performanceModel";

export const BOW_CROSSFADE_SECONDS = 0.035;
export const CONTINUATION_CROSSFADE_SECONDS = 0.09;
export const RELEASE_SECONDS = 0.11;
export const CONTINUATION_THRESHOLD_SECONDS = 0.18;

export type SampleVoiceFrame = Pick<
  PerformanceState,
  "voiceActive" | "phase" | "midi" | "intensity" | "direction" | "articulationId"
>;

export type SampleRoot = {
  rootMidi: number;
  rootNote: "C4" | "E4" | "G4" | "A4" | "C5" | "E5";
  lowMidi: number;
  highMidi: number;
};

const SAMPLE_ROOTS: readonly SampleRoot[] = [
  { rootMidi: 60, rootNote: "C4", lowMidi: 59, highMidi: 61 },
  { rootMidi: 64, rootNote: "E4", lowMidi: 62, highMidi: 65 },
  { rootMidi: 67, rootNote: "G4", lowMidi: 66, highMidi: 67 },
  { rootMidi: 69, rootNote: "A4", lowMidi: 68, highMidi: 70 },
  { rootMidi: 72, rootNote: "C5", lowMidi: 71, highMidi: 73 },
  { rootMidi: 76, rootNote: "E5", lowMidi: 74, highMidi: 77 },
];

export function selectSampleRoot(targetMidi: number): SampleRoot {
  const mapped = SAMPLE_ROOTS.find(
    (root) => targetMidi >= root.lowMidi && targetMidi <= root.highMidi,
  );
  if (mapped) return mapped;

  return SAMPLE_ROOTS.reduce((best, candidate) =>
    Math.abs(candidate.rootMidi - targetMidi) < Math.abs(best.rootMidi - targetMidi)
      ? candidate
      : best,
  );
}

export function playbackRate(targetMidi: number, rootMidi: number): number {
  return 2 ** ((targetMidi - rootMidi) / 12);
}

export function layerGains(intensity: number): { piano: number; forte: number } {
  const mix = clamp01(intensity);
  return {
    piano: Math.cos((mix * Math.PI) / 2),
    forte: Math.sin((mix * Math.PI) / 2),
  };
}

export function needsFreshBow(
  previous: SampleVoiceFrame | null,
  next: SampleVoiceFrame,
): boolean {
  if (!isSounding(next)) return false;
  if (!previous || !isSounding(previous)) return true;
  if (previous.midi !== next.midi) return true;
  if (selectSampleRoot(previous.midi).rootMidi !== selectSampleRoot(next.midi).rootMidi) return true;
  if (previous.articulationId !== undefined && next.articulationId !== undefined) {
    return previous.articulationId !== next.articulationId;
  }
  return previous.direction !== 0
    && next.direction !== 0
    && previous.direction !== next.direction;
}

export function shouldContinue(active: boolean, remainingSeconds: number): boolean {
  return (
    active &&
    Number.isFinite(remainingSeconds) &&
    remainingSeconds >= 0 &&
    remainingSeconds <= CONTINUATION_THRESHOLD_SECONDS
  );
}

function isSounding(frame: SampleVoiceFrame): boolean {
  return frame.voiceActive && frame.phase === "bowing";
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
