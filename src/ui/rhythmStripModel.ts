import {
  directionForNote,
  type GuidedSongFrame,
  type RhythmJudgment,
} from "../music/guidedSongEngine";
import { midiToNoteName } from "../music/scale";
import type { SongDefinition } from "../music/songTypes";

export type RhythmCueState = "future" | "window" | "past";

export type RhythmCue = {
  noteIndex: number;
  noteName: string;
  expectedDirection: -1 | 1;
  topPercent: number;
  heightPercent: number;
  state: RhythmCueState;
  judged: boolean;
  judgment: RhythmJudgment;
};

const JUDGMENT_LINE_PERCENT = 68;
const LOOK_AHEAD_BEATS = 4;
const HISTORY_BEATS = 1;
const GOOD_WINDOW_BEATS = 0.32;

export function buildRhythmCues(
  song: SongDefinition,
  frame: GuidedSongFrame,
): RhythmCue[] {
  return song.melody.flatMap((note, noteIndex) => {
    const distanceBeats = note.startBeat - frame.transportBeat;
    if (distanceBeats > LOOK_AHEAD_BEATS || distanceBeats < -HISTORY_BEATS) return [];
    const topPercent = clamp(
      JUDGMENT_LINE_PERCENT - distanceBeats * (JUDGMENT_LINE_PERCENT / LOOK_AHEAD_BEATS),
      0,
      100,
    );
    const judgment = frame.lastJudgmentNoteIndex === noteIndex
      ? frame.lastJudgment
      : "none";

    return [{
      noteIndex,
      noteName: midiToNoteName(note.midi),
      expectedDirection: directionForNote(noteIndex),
      topPercent: round(topPercent),
      heightPercent: round(clamp(note.durationBeats * 5.5, 4.5, 14)),
      state: Math.abs(distanceBeats) <= GOOD_WINDOW_BEATS
        ? "window"
        : distanceBeats < 0
          ? "past"
          : "future",
      judged: noteIndex < frame.judgedNoteCount,
      judgment,
    }];
  });
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
