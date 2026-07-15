import type { GuidedSongFrame } from "../music/guidedSongEngine";
import { midiToNoteName } from "../music/scale";
import type { SongDefinition } from "../music/songTypes";

export type GuidedGateTone = "ready" | "slow" | "paused";

export type GuidedDisplay = {
  noteName: string;
  upcomingLabel: string;
  progressPercent: number;
  progressLabel: string;
  scoreLabel: string;
  targetTop: number;
  handTop: number;
  alignmentPercent: number;
  gateTone: GuidedGateTone;
  gateMessage: string;
};

export function buildGuidedDisplay(
  song: SongDefinition,
  frame: GuidedSongFrame,
): GuidedDisplay {
  const upcomingLabel = frame.upcomingNotes
    .map((note) => midiToNoteName(note.midi))
    .join("  ·  ");
  const gate = gateCopy(frame);

  return {
    noteName: midiToNoteName(frame.currentNote.midi),
    upcomingLabel: upcomingLabel || "终止线",
    progressPercent: Math.round(clamp01(frame.progress) * 1000) / 10,
    progressLabel: `${Math.min(song.totalBeats, Math.floor(frame.transportBeat) + 1)} / ${song.totalBeats} 拍`,
    scoreLabel: String(frame.score.total).padStart(2, "0"),
    targetTop: (1 - clamp01(frame.targetPitch)) * 100,
    handTop: (1 - clamp01(frame.handPitch)) * 100,
    alignmentPercent: Math.round(clamp01(frame.alignment) * 100),
    gateTone: gate.tone,
    gateMessage: gate.message,
  };
}

function gateCopy(frame: GuidedSongFrame): { tone: GuidedGateTone; message: string } {
  if (frame.phase === "countIn") {
    return { tone: "paused", message: "倒数结束后，左右移动开始拉弓" };
  }
  if (frame.phase === "complete") {
    return { tone: "ready", message: "演奏完成" };
  }
  if (frame.speedFactor < 0.72) {
    return { tone: "slow", message: "靠近目标音高，旋律会前进得更快" };
  }
  if (frame.speedFactor < 0.96) {
    return { tone: "slow", message: "很好，再靠近一点" };
  }
  return { tone: "ready", message: "音高对准 · 保持流畅拉弓" };
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
