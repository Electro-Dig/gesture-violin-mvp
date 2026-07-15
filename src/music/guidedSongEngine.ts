import type { BowingFrame } from "../gesture/types";
import type {
  AccompanimentEvent,
  ScoreBreakdown,
  SongDefinition,
  SongNote,
} from "./songTypes";

export type GuidedPhase = "idle" | "countIn" | "playing" | "complete";

export type GuidedSongFrame = {
  phase: GuidedPhase;
  countdown: number;
  transportBeat: number;
  progress: number;
  currentNote: SongNote;
  currentNoteIndex: number;
  targetPitch: number;
  handPitch: number;
  alignment: number;
  speedFactor: number;
  upcomingNotes: SongNote[];
  crossedAccompaniment: AccompanimentEvent[];
  score: ScoreBreakdown;
};

const COUNT_IN_MS = 3000;
const REVERSAL_GRACE_SECONDS = 0.35;
const MAX_DELTA_SECONDS = 0.25;

export class GuidedSongEngine {
  private phase: GuidedPhase = "idle";
  private countdownStartedMs = 0;
  private lastUpdateMs = 0;
  private transportBeat = 0;
  private nextAccompanimentIndex = 0;
  private idleVisibleSeconds = 0;
  private bowingSeconds = 0;
  private continuityPenaltySeconds = 0;
  private pitchWeightedSeconds = 0;
  private expressionWeightedSeconds = 0;
  private expressiveSeconds = 0;

  constructor(readonly song: SongDefinition) {
    if (song.melody.length === 0) throw new Error("Guided songs require melody notes");
  }

  start(nowMs: number): GuidedSongFrame {
    this.clearAccumulators();
    this.phase = "countIn";
    this.countdownStartedMs = nowMs;
    this.lastUpdateMs = nowMs;
    return this.buildFrame(neutralGesture(nowMs), [], 3);
  }

  reset(): GuidedSongFrame {
    this.clearAccumulators();
    this.phase = "idle";
    return this.buildFrame(neutralGesture(0), [], 0);
  }

  update(bowing: BowingFrame, nowMs: number): GuidedSongFrame {
    if (this.phase === "idle" || this.phase === "complete") {
      this.lastUpdateMs = nowMs;
      return this.buildFrame(bowing, [], 0);
    }

    if (this.phase === "countIn") {
      const elapsedMs = Math.max(0, nowMs - this.countdownStartedMs);
      this.lastUpdateMs = nowMs;
      if (elapsedMs >= COUNT_IN_MS) {
        this.phase = "playing";
        return this.buildFrame(bowing, [], 0);
      }
      const countdown = Math.max(1, Math.ceil((COUNT_IN_MS - elapsedMs) / 1000));
      return this.buildFrame(bowing, [], countdown);
    }

    const deltaSeconds = Math.min(
      MAX_DELTA_SECONDS,
      Math.max(0, (nowMs - this.lastUpdateMs) / 1000),
    );
    this.lastUpdateMs = nowMs;
    const crossedAccompaniment: AccompanimentEvent[] = [];

    if (bowing.active && bowing.bowing) {
      const currentNote = noteAtBeat(this.song, this.transportBeat).note;
      const targetPitch = noteTargetPitch(this.song, currentNote);
      const spacing = laneSpacing(this.song);
      const error = Math.abs(clamp01(bowing.pitch) - targetPitch);
      const alignment = alignmentFromError(error, spacing);
      const speedFactor = softGateFactor(error, spacing);
      const expression = clamp01(1 - Math.abs(clamp01(bowing.intensity) - currentNote.dynamic));

      this.bowingSeconds += deltaSeconds;
      this.pitchWeightedSeconds += alignment * deltaSeconds;
      this.expressionWeightedSeconds += expression * deltaSeconds;
      this.expressiveSeconds += deltaSeconds;
      this.idleVisibleSeconds = 0;

      const beatsPerSecond = this.song.bpm / 60;
      const nextBeat = Math.min(
        this.song.totalBeats,
        this.transportBeat + deltaSeconds * beatsPerSecond * speedFactor,
      );
      while (
        this.nextAccompanimentIndex < this.song.accompaniment.length &&
        this.song.accompaniment[this.nextAccompanimentIndex]!.startBeat <= nextBeat
      ) {
        crossedAccompaniment.push(this.song.accompaniment[this.nextAccompanimentIndex]!);
        this.nextAccompanimentIndex += 1;
      }
      this.transportBeat = nextBeat;
      if (this.transportBeat >= this.song.totalBeats) this.phase = "complete";
    } else if (bowing.active) {
      const previousIdle = this.idleVisibleSeconds;
      this.idleVisibleSeconds += deltaSeconds;
      const previousPenalty = Math.max(0, previousIdle - REVERSAL_GRACE_SECONDS);
      const nextPenalty = Math.max(0, this.idleVisibleSeconds - REVERSAL_GRACE_SECONDS);
      this.continuityPenaltySeconds += nextPenalty - previousPenalty;
    } else {
      this.idleVisibleSeconds = 0;
    }

    return this.buildFrame(bowing, crossedAccompaniment, 0);
  }

  private buildFrame(
    bowing: BowingFrame,
    crossedAccompaniment: AccompanimentEvent[],
    countdown: number,
  ): GuidedSongFrame {
    const { note: currentNote, index: currentNoteIndex } = noteAtBeat(
      this.song,
      this.transportBeat,
    );
    const targetPitch = noteTargetPitch(this.song, currentNote);
    const handPitch = clamp01(bowing.pitch);
    const spacing = laneSpacing(this.song);
    const error = Math.abs(handPitch - targetPitch);
    const alignment = alignmentFromError(error, spacing);
    const speedFactor = softGateFactor(error, spacing);
    const pitchAverage = this.bowingSeconds > 0
      ? this.pitchWeightedSeconds / this.bowingSeconds
      : 1;
    const continuityTotal = this.bowingSeconds + this.continuityPenaltySeconds;
    const continuityAverage = continuityTotal > 0 ? this.bowingSeconds / continuityTotal : 1;
    const expressionAverage = this.expressiveSeconds > 0
      ? this.expressionWeightedSeconds / this.expressiveSeconds
      : 1;

    return {
      phase: this.phase,
      countdown,
      transportBeat: this.transportBeat,
      progress: this.phase === "complete"
        ? 1
        : clamp01(this.transportBeat / this.song.totalBeats),
      currentNote,
      currentNoteIndex,
      targetPitch,
      handPitch,
      alignment,
      speedFactor,
      upcomingNotes: this.song.melody.slice(currentNoteIndex + 1, currentNoteIndex + 4),
      crossedAccompaniment,
      score: calculateScore(pitchAverage, continuityAverage, expressionAverage),
    };
  }

  private clearAccumulators(): void {
    this.transportBeat = 0;
    this.nextAccompanimentIndex = 0;
    this.idleVisibleSeconds = 0;
    this.bowingSeconds = 0;
    this.continuityPenaltySeconds = 0;
    this.pitchWeightedSeconds = 0;
    this.expressionWeightedSeconds = 0;
    this.expressiveSeconds = 0;
  }
}

export function softGateFactor(error: number, spacing: number): number {
  const safeSpacing = Math.max(spacing, 0.0001);
  const laneError = Math.abs(error) / safeSpacing;
  if (laneError <= 0.45) return 1;
  if (laneError >= 1.5 - 1e-9) return 0.3;
  const amount = (laneError - 0.45) / (1.5 - 0.45);
  return 1 - amount * 0.7;
}

export function calculateScore(
  pitchAverage: number,
  continuityAverage: number,
  expressionAverage: number,
): ScoreBreakdown {
  const pitch = clamp01(pitchAverage);
  const continuity = clamp01(continuityAverage);
  const expression = clamp01(expressionAverage);
  const total = Math.round(pitch * 45 + continuity * 35 + expression * 20);
  return {
    total,
    stars: total >= 82 ? 3 : total >= 60 ? 2 : 1,
    pitch: Math.round(pitch * 100),
    continuity: Math.round(continuity * 100),
    expression: Math.round(expression * 100),
  };
}

function noteAtBeat(song: SongDefinition, beat: number): { note: SongNote; index: number } {
  let index = song.melody.length - 1;
  for (let candidate = 0; candidate < song.melody.length; candidate += 1) {
    const note = song.melody[candidate]!;
    if (beat < note.startBeat + note.durationBeats) {
      index = candidate;
      break;
    }
  }
  return { note: song.melody[index]!, index };
}

function noteTargetPitch(song: SongDefinition, note: SongNote): number {
  const index = Math.max(0, song.pitchLanes.indexOf(note.midi));
  return song.pitchLanes.length <= 1 ? 0.5 : index / (song.pitchLanes.length - 1);
}

function laneSpacing(song: SongDefinition): number {
  return song.pitchLanes.length <= 1 ? 1 : 1 / (song.pitchLanes.length - 1);
}

function alignmentFromError(error: number, spacing: number): number {
  return clamp01(1 - Math.abs(error) / (Math.max(spacing, 0.0001) * 1.5));
}

function neutralGesture(timestampMs: number): BowingFrame {
  return {
    timestampMs,
    active: false,
    bowing: false,
    x: 0.5,
    pitch: 0.5,
    horizontalSpeed: 0,
    intensity: 0,
    direction: 0,
    confidence: 0,
  };
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
