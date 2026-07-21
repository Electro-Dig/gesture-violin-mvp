import { sequenceToMelody, type AccompanimentEvent, type SequentialNote, type SongDefinition } from "../songTypes";

const E = 64;
const F = 65;
const G = 67;
const D = 62;
const C = 60;

function phrase(ending: "d" | "c", phraseIndex: number): SequentialNote[] {
  const endingNotes = ending === "d"
    ? [{ midi: E, durationBeats: 1.5 }, { midi: D, durationBeats: 0.5 }, { midi: D, durationBeats: 2 }]
    : [{ midi: D, durationBeats: 1.5 }, { midi: C, durationBeats: 0.5 }, { midi: C, durationBeats: 2 }];
  return [E, E, F, G, G, F, E, D, C, C, D, E]
    .map((midi, index) => ({
      midi,
      durationBeats: 1,
      dynamic: 0.5 + (index / 11) * 0.18,
      phrase: phraseIndex,
    }))
    .concat(
      endingNotes.map((note, index) => ({
        ...note,
        dynamic: index === 2 ? 0.46 : 0.62,
        phrase: phraseIndex,
      })),
    );
}

const accompaniment: AccompanimentEvent[] = Array.from({ length: 12 }, (_, index) => {
  const chords = [
    [48, 55, 60],
    [50, 57, 62],
    [48, 55, 60],
    [43, 50, 55],
  ];
  return {
    startBeat: index * 4,
    midi: [...chords[index % chords.length]!],
    velocity: index % 4 === 0 ? 0.34 : 0.27,
    durationBeats: 3.5,
  };
});

export const ODE_TO_JOY: SongDefinition = {
  id: "ode-to-joy",
  title: "欢乐颂",
  composer: "Ludwig van Beethoven",
  bpm: 76,
  beatsPerBar: 4,
  difficulty: 1,
  durationLabel: "约 38 秒",
  totalBeats: 48,
  source: {
    url: "https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=528",
    license: "Public Domain",
    sourceFile: "Beethoven-Ode-to-Joy-Mutopia-PD.mid",
    sourceTrack: 1,
    sourceBeats: [0, 48],
    sha256: "fb1604c08c865b275b464d74e5a7c526ff1a8acccdf9853cb92f0778daaed14b",
  },
  arrangement: {
    kind: "tutorial-excerpt",
    transposeSemitones: -7,
    melodyStrategy: "skyline",
    transformations: [
      "Extracted the highest active voice from the upper-staff MIDI track.",
      "Quantized boundaries to eighth beats and transposed down seven semitones.",
      "Retained the app's original tutorial accompaniment.",
    ],
  },
  pitchLanes: [60, 62, 64, 65, 67],
  melody: sequenceToMelody([
    ...phrase("d", 0),
    ...phrase("c", 1),
    ...phrase("d", 2),
  ]),
  accompaniment,
};
