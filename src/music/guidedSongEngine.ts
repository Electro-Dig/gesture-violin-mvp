import type { BowingFrame } from "../gesture/types";
import type {
  AccompanimentEvent,
  ScoreBreakdown,
  SongDefinition,
  SongNote,
} from "./songTypes";

export type GuidedPhase = "idle" | "countIn" | "playing" | "complete";
export type RhythmJudgment = "none" | "perfect" | "good" | "miss";

export type GuidedSongFrame = {
  phase: GuidedPhase;
  countdown: number;
  transportBeat: number;
  progress: number;
  currentNote: SongNote;
  currentNoteIndex: number;
  expectedDirection: -1 | 1;
  bowDirection: -1 | 0 | 1;
  bowX: number;
  bowEngaged: boolean;
  lastJudgment: RhythmJudgment;
  lastJudgmentNoteIndex: number;
  judgedNoteCount: number;
  upcomingNotes: SongNote[];
  crossedAccompaniment: AccompanimentEvent[];
  score: ScoreBreakdown;
};

const COUNT_IN_MS = 3000;
const TURNAROUND_GRACE_MS = 280;
const PERFECT_WINDOW_BEATS = 0.12;
const GOOD_WINDOW_BEATS = 0.32;
const MAX_DELTA_SECONDS = 0.25;

export class GuidedSongEngine {
  private phase: GuidedPhase = "idle";
  private countdownStartedMs = 0;
  private lastUpdateMs = 0;
  private lastBowingMs = Number.NEGATIVE_INFINITY;
  private transportBeat = 0;
  private nextAccompanimentIndex = 0;
  private nextJudgmentIndex = 0;
  private lastJudgment: RhythmJudgment = "none";
  private lastJudgmentNoteIndex = -1;
  private timingScoreSum = 0;
  private bowEngagedSeconds = 0;
  private trackableIdleSeconds = 0;
  private expressionScoreSum = 0;
  private expressionSeconds = 0;

  constructor(readonly song: SongDefinition) {
    if (song.melody.length === 0) throw new Error("Guided songs require melody notes");
  }

  start(nowMs: number): GuidedSongFrame {
    this.clearAccumulators();
    this.phase = "countIn";
    this.countdownStartedMs = nowMs;
    this.lastUpdateMs = nowMs;
    return this.buildFrame(neutralGesture(nowMs), [], 3, false);
  }

  reset(): GuidedSongFrame {
    this.clearAccumulators();
    this.phase = "idle";
    return this.buildFrame(neutralGesture(0), [], 0, false);
  }

  update(bowing: BowingFrame, nowMs: number): GuidedSongFrame {
    if (this.phase === "idle" || this.phase === "complete") {
      this.lastUpdateMs = nowMs;
      return this.buildFrame(bowing, [], 0, false);
    }

    if (this.phase === "countIn") {
      const elapsedMs = Math.max(0, nowMs - this.countdownStartedMs);
      this.lastUpdateMs = nowMs;
      if (elapsedMs >= COUNT_IN_MS) {
        this.phase = "playing";
        return this.buildFrame(bowing, [], 0, false);
      }
      const countdown = Math.max(1, Math.ceil((COUNT_IN_MS - elapsedMs) / 1000));
      return this.buildFrame(bowing, [], countdown, false);
    }

    const deltaSeconds = Math.min(
      MAX_DELTA_SECONDS,
      Math.max(0, (nowMs - this.lastUpdateMs) / 1000),
    );
    this.lastUpdateMs = nowMs;
    if (bowing.active && bowing.bowing) this.lastBowingMs = nowMs;
    const bowEngaged = bowing.active && (
      bowing.bowing || nowMs - this.lastBowingMs <= TURNAROUND_GRACE_MS
    );
    const crossedAccompaniment: AccompanimentEvent[] = [];

    if (bowing.active) {
      if (bowEngaged) this.bowEngagedSeconds += deltaSeconds;
      else this.trackableIdleSeconds += deltaSeconds;
    }

    if (bowing.active && bowing.bowing) {
      const note = noteAtBeat(this.song, this.transportBeat).note;
      const expression = clamp01(1 - Math.abs(clamp01(bowing.intensity) - note.dynamic));
      this.expressionScoreSum += expression * deltaSeconds;
      this.expressionSeconds += deltaSeconds;
    }

    if (bowEngaged) {
      const beatsPerSecond = this.song.bpm / 60;
      const nextBeat = Math.min(
        this.song.totalBeats,
        this.transportBeat + deltaSeconds * beatsPerSecond,
      );
      while (
        this.nextAccompanimentIndex < this.song.accompaniment.length &&
        this.song.accompaniment[this.nextAccompanimentIndex]!.startBeat <= nextBeat
      ) {
        crossedAccompaniment.push(this.song.accompaniment[this.nextAccompanimentIndex]!);
        this.nextAccompanimentIndex += 1;
      }
      this.transportBeat = nextBeat;
    }

    this.judgeNotes(bowing.bowing ? bowing.direction : 0);
    if (this.transportBeat >= this.song.totalBeats) this.phase = "complete";

    return this.buildFrame(bowing, crossedAccompaniment, 0, bowEngaged);
  }

  private judgeNotes(direction: BowingFrame["direction"]): void {
    while (this.nextJudgmentIndex < this.song.melody.length) {
      const noteIndex = this.nextJudgmentIndex;
      const note = this.song.melody[noteIndex]!;
      const timingError = this.transportBeat - note.startBeat;
      const expectedDirection = directionForNote(noteIndex);

      if (
        direction === expectedDirection &&
        Math.abs(timingError) <= GOOD_WINDOW_BEATS
      ) {
        const judgment: RhythmJudgment = Math.abs(timingError) <= PERFECT_WINDOW_BEATS
          ? "perfect"
          : "good";
        this.recordJudgment(noteIndex, judgment, judgment === "perfect" ? 1 : 0.72);
        continue;
      }

      if (timingError > GOOD_WINDOW_BEATS) {
        this.recordJudgment(noteIndex, "miss", 0);
        continue;
      }
      break;
    }
  }

  private recordJudgment(
    noteIndex: number,
    judgment: RhythmJudgment,
    timingScore: number,
  ): void {
    this.lastJudgment = judgment;
    this.lastJudgmentNoteIndex = noteIndex;
    this.timingScoreSum += timingScore;
    this.nextJudgmentIndex += 1;
  }

  private buildFrame(
    bowing: BowingFrame,
    crossedAccompaniment: AccompanimentEvent[],
    countdown: number,
    bowEngaged: boolean,
  ): GuidedSongFrame {
    const { note: currentNote, index: currentNoteIndex } = noteAtBeat(
      this.song,
      this.transportBeat,
    );
    const timingAverage = this.nextJudgmentIndex > 0
      ? this.timingScoreSum / this.nextJudgmentIndex
      : 1;
    const continuityTotal = this.bowEngagedSeconds + this.trackableIdleSeconds;
    const continuityAverage = continuityTotal > 0
      ? this.bowEngagedSeconds / continuityTotal
      : 1;
    const expressionAverage = this.expressionSeconds > 0
      ? this.expressionScoreSum / this.expressionSeconds
      : 1;
    const promptIndex = Math.min(this.nextJudgmentIndex, this.song.melody.length - 1);

    return {
      phase: this.phase,
      countdown,
      transportBeat: this.transportBeat,
      progress: this.phase === "complete"
        ? 1
        : clamp01(this.transportBeat / this.song.totalBeats),
      currentNote,
      currentNoteIndex,
      expectedDirection: directionForNote(promptIndex),
      bowDirection: bowing.direction,
      bowX: clamp01(bowing.x),
      bowEngaged,
      lastJudgment: this.lastJudgment,
      lastJudgmentNoteIndex: this.lastJudgmentNoteIndex,
      judgedNoteCount: this.nextJudgmentIndex,
      upcomingNotes: this.song.melody.slice(currentNoteIndex + 1, currentNoteIndex + 4),
      crossedAccompaniment,
      score: calculateScore(timingAverage, continuityAverage, expressionAverage),
    };
  }

  private clearAccumulators(): void {
    this.transportBeat = 0;
    this.nextAccompanimentIndex = 0;
    this.nextJudgmentIndex = 0;
    this.lastBowingMs = Number.NEGATIVE_INFINITY;
    this.lastJudgment = "none";
    this.lastJudgmentNoteIndex = -1;
    this.timingScoreSum = 0;
    this.bowEngagedSeconds = 0;
    this.trackableIdleSeconds = 0;
    this.expressionScoreSum = 0;
    this.expressionSeconds = 0;
  }
}

export function directionForNote(noteIndex: number): -1 | 1 {
  return noteIndex % 2 === 0 ? 1 : -1;
}

export function calculateScore(
  timingAverage: number,
  continuityAverage: number,
  expressionAverage: number,
): ScoreBreakdown {
  const timing = clamp01(timingAverage);
  const continuity = clamp01(continuityAverage);
  const expression = clamp01(expressionAverage);
  const total = Math.round(timing * 45 + continuity * 35 + expression * 20);
  return {
    total,
    stars: total >= 82 ? 3 : total >= 60 ? 2 : 1,
    timing: Math.round(timing * 100),
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
