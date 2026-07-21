import { sequenceToMelody, type AccompanimentEvent, type SongDefinition } from "../songTypes";

const variations = [
  [66, 64, 62, 73, 71, 69, 71, 73, 62, 73, 71, 69, 67, 66, 64, 62],
  [69, 67, 66, 64, 62, 64, 66, 67, 69, 71, 73, 71, 69, 67, 66, 64],
  [62, 64, 66, 69, 67, 66, 64, 62, 71, 73, 71, 69, 67, 69, 66, 64],
  [66, 69, 71, 73, 71, 69, 67, 66, 64, 66, 67, 69, 66, 64, 62, 64],
  [69, 71, 73, 71, 69, 67, 66, 64, 62, 64, 66, 67, 69, 66, 64, 62],
];

const progression = [
  [50, 57, 62],
  [45, 52, 57],
  [47, 54, 59],
  [42, 49, 54],
  [43, 50, 55],
  [50, 57, 62],
  [43, 50, 55],
  [45, 52, 57],
];

const accompaniment: AccompanimentEvent[] = Array.from({ length: 20 }, (_, index) => ({
  startBeat: index * 4,
  midi: [...progression[index % progression.length]!],
  velocity: index % 8 === 0 ? 0.31 : 0.24,
  durationBeats: 3.75,
}));

export const CANON_IN_D: SongDefinition = {
  id: "canon-in-d",
  title: "D 大调卡农",
  composer: "Johann Pachelbel",
  bpm: 72,
  beatsPerBar: 4,
  difficulty: 2,
  durationLabel: "约 67 秒",
  totalBeats: 80,
  source: {
    url: "https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1700",
    license: "CC BY 3.0",
    sourceFile: "Pachelbel-Canon-in-D-Mutopia-CC-BY-3.0.mid",
    sourceTrack: 1,
    sourceBeats: [0, 80],
    sha256: "1358ba0799aeb727be0ef155fc9090ea55762a3b41f85d3dbb02918f4ac66515",
  },
  arrangement: {
    kind: "tutorial-excerpt",
    transposeSemitones: 0,
    melodyStrategy: "monophonic-track",
    transformations: [
      "Selected the opening monophonic violin line.",
      "Quantized boundaries to eighth beats and clipped the tutorial to 80 beats.",
      "Retained the app's original tutorial accompaniment.",
    ],
  },
  pitchLanes: [62, 64, 66, 67, 69, 71, 73],
  melody: sequenceToMelody(
    variations.flatMap((variation, phrase) =>
      variation.map((midi, index) => ({
        midi,
        durationBeats: 1,
        dynamic: 0.44 + phrase * 0.08 + (index % 4) * 0.025,
        phrase,
      })),
    ),
  ),
  accompaniment,
};
