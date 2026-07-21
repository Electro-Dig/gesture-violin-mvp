export type SongId = "ode-to-joy" | "canon-in-d";

export type SongNote = {
  midi: number;
  startBeat: number;
  durationBeats: number;
  dynamic: number;
  phrase: number;
};

export type AccompanimentEvent = {
  startBeat: number;
  midi: number[];
  velocity: number;
  durationBeats: number;
};

export type ScoreBreakdown = {
  total: number;
  stars: 1 | 2 | 3;
  timing: number;
  continuity: number;
  expression: number;
};

export type SongSource = {
  url: string;
  license: "Public Domain" | "CC BY 3.0";
  sourceFile: string;
  sourceTrack: number;
  sourceBeats: readonly [number, number];
  sha256: string;
};

export type SongArrangement = {
  kind: "tutorial-excerpt";
  transposeSemitones: number;
  melodyStrategy: "skyline" | "monophonic-track";
  transformations: string[];
};

export type SongDefinition = {
  id: SongId;
  title: string;
  composer: string;
  bpm: number;
  beatsPerBar: number;
  difficulty: 1 | 2 | 3;
  durationLabel: string;
  totalBeats: number;
  source: SongSource;
  arrangement: SongArrangement;
  pitchLanes: number[];
  melody: SongNote[];
  accompaniment: AccompanimentEvent[];
};


export function pitchLanesFromMelody(
  melody: readonly SongNote[],
): number[] {
  return [...new Set(melody.map((note) => note.midi))]
    .sort((a, b) => a - b);
}
export type SequentialNote = Omit<SongNote, "startBeat">;

export function sequenceToMelody(sequence: SequentialNote[]): SongNote[] {
  let startBeat = 0;
  return sequence.map((note) => {
    const authored = { ...note, startBeat };
    startBeat += note.durationBeats;
    return authored;
  });
}
