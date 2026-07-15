export type SongId = "ode-to-joy";

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

export type SongDefinition = {
  id: SongId;
  title: string;
  composer: string;
  bpm: number;
  beatsPerBar: number;
  difficulty: 1 | 2 | 3;
  durationLabel: string;
  totalBeats: number;
  pitchLanes: number[];
  melody: SongNote[];
  accompaniment: AccompanimentEvent[];
};

export type SequentialNote = Omit<SongNote, "startBeat">;

export function sequenceToMelody(sequence: SequentialNote[]): SongNote[] {
  let startBeat = 0;
  return sequence.map((note) => {
    const authored = { ...note, startBeat };
    startBeat += note.durationBeats;
    return authored;
  });
}
