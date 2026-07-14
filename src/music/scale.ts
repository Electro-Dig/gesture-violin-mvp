export type ScaleNote = {
  midi: number;
  noteName: string;
  frequencyHz: number;
};

const NOTE_NAMES = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];

export const FRIENDLY_SCALE: readonly ScaleNote[] = [60, 62, 64, 67, 69, 72, 74, 76].map(
  (midi) => ({
    midi,
    noteName: `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`,
    frequencyHz: midiToFrequency(midi),
  }),
);

export function midiToFrequency(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}
