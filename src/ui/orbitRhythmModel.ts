import { directionForNote } from "../music/guidedSongEngine";
import { midiToNoteName } from "../music/scale";
import type { SongDefinition } from "../music/songTypes";

export type OrbitCueState = "past" | "current" | "upcoming";

export type OrbitCue = {
  id: string;
  angleDeg: number;
  sweepDeg: number;
  midi: number;
  noteName: string;
  expectedDirection: -1 | 1;
  state: OrbitCueState;
  beatDistance: number;
};

export type MeasureOverviewInput = {
  currentBeat: number;
  totalBeats: number;
  beatsPerBar: number;
  phraseBeats: number;
};

export type MeasureOverview = {
  currentBeat: number;
  totalBeats: number;
  currentMeasure: number;
  totalMeasures: number;
  currentPhrase: number;
  totalPhrases: number;
  progress: number;
};

const HIT_ANGLE_DEG = 214;
const DEGREES_PER_BEAT = 38;
const LOOKAHEAD_BEATS = 6;
const HISTORY_BEATS = 0.75;
const MIN_SWEEP_DEG = 7;
const MAX_SWEEP_DEG = 48;

export function buildOrbitCues(
  song: SongDefinition,
  currentBeat: number,
): OrbitCue[] {
  return song.melody.flatMap((note, noteIndex) => {
    const beatDistance = note.startBeat - currentBeat;
    const endDistance = note.startBeat + note.durationBeats - currentBeat;
    if (beatDistance > LOOKAHEAD_BEATS || endDistance < -HISTORY_BEATS) {
      return [];
    }

    const state: OrbitCueState =
      currentBeat >= note.startBeat
      && currentBeat < note.startBeat + note.durationBeats
        ? "current"
        : endDistance <= 0
          ? "past"
          : "upcoming";

    return [{
      id: `${song.id}-${noteIndex}`,
      angleDeg: roundToTenth(
        HIT_ANGLE_DEG + beatDistance * DEGREES_PER_BEAT,
      ),
      sweepDeg: roundToTenth(
        clamp(
          note.durationBeats * DEGREES_PER_BEAT,
          MIN_SWEEP_DEG,
          MAX_SWEEP_DEG,
        ),
      ),
      midi: note.midi,
      noteName: midiToNoteName(note.midi),
      expectedDirection: directionForNote(noteIndex),
      state,
      beatDistance: roundToThousandth(beatDistance),
    }];
  });
}

export function buildMeasureOverview(
  input: MeasureOverviewInput,
): MeasureOverview {
  const totalBeats = Math.max(input.totalBeats, 0);
  const currentBeat = clamp(input.currentBeat, 0, totalBeats);
  const beatsPerBar = Math.max(input.beatsPerBar, 1);
  const phraseBeats = Math.max(input.phraseBeats, 1);
  const totalMeasures = Math.max(1, Math.ceil(totalBeats / beatsPerBar));
  const totalPhrases = Math.max(1, Math.ceil(totalBeats / phraseBeats));

  return {
    currentBeat,
    totalBeats,
    currentMeasure: Math.min(
      totalMeasures,
      Math.floor(currentBeat / beatsPerBar) + 1,
    ),
    totalMeasures,
    currentPhrase: Math.min(
      totalPhrases,
      Math.floor(currentBeat / phraseBeats) + 1,
    ),
    totalPhrases,
    progress: totalBeats > 0 ? currentBeat / totalBeats : 0,
  };
}

function roundToTenth(value: number): number {
  return Math.round(value * 10) / 10;
}

function roundToThousandth(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
