import type {
  GuidedSongFrame,
  RhythmJudgment,
} from "../music/guidedSongEngine";
import { midiToNoteName } from "../music/scale";
import type { SongDefinition } from "../music/songTypes";
import { buildRhythmCues, type RhythmCue } from "./rhythmStripModel";

export type TimingTone = "neutral" | "perfect" | "good" | "miss";

export type GuidedDisplay = {
  noteName: string;
  upcomingLabel: string;
  progressPercent: number;
  progressLabel: string;
  scoreLabel: string;
  cues: RhythmCue[];
  directionMessage: string;
  directionSymbol: "←" | "→";
  cursorLeft: number;
  timingLabel: string;
  timingTone: TimingTone;
  helperMessage: string;
};

export function buildGuidedDisplay(
  song: SongDefinition,
  frame: GuidedSongFrame,
): GuidedDisplay {
  const timing = timingCopy(frame.phase, frame.lastJudgment);
  return {
    noteName: midiToNoteName(frame.currentNote.midi),
    upcomingLabel: frame.upcomingNotes
      .map((note) => midiToNoteName(note.midi))
      .join("  ·  ") || "终止线",
    progressPercent: Math.round(clamp01(frame.progress) * 1000) / 10,
    progressLabel: `${Math.min(song.totalBeats, Math.floor(frame.transportBeat) + 1)} / ${song.totalBeats} 拍`,
    scoreLabel: String(frame.score.total).padStart(2, "0"),
    cues: buildRhythmCues(song, frame),
    directionMessage: frame.expectedDirection > 0 ? "向右换弓" : "向左换弓",
    directionSymbol: frame.expectedDirection > 0 ? "→" : "←",
    cursorLeft: Math.round(clamp01(frame.bowX) * 1000) / 10,
    timingLabel: timing.label,
    timingTone: timing.tone,
    helperMessage: frame.phase === "complete"
      ? "演奏完成"
      : "音符到达红线时，改变拉弓方向",
  };
}

function timingCopy(
  phase: GuidedSongFrame["phase"],
  judgment: RhythmJudgment,
): { label: string; tone: TimingTone } {
  if (phase === "countIn" || phase === "idle") return { label: "准备", tone: "neutral" };
  if (phase === "complete") return { label: "完成", tone: "perfect" };
  if (judgment === "perfect") return { label: "精准", tone: "perfect" };
  if (judgment === "good") return { label: "很好", tone: "good" };
  if (judgment === "miss") return { label: "继续", tone: "miss" };
  return { label: "跟随节奏", tone: "neutral" };
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
