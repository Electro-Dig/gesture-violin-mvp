import { midiToFrequency } from "../music/scale";
import type { AccompanimentEvent } from "../music/songTypes";

export type AccompanimentVoice = {
  midi: number;
  frequencyHz: number;
  gain: number;
  waveform: OscillatorType;
};

export type AccompanimentVoicePlan = {
  releaseSeconds: number;
  voices: AccompanimentVoice[];
};

export function planAccompanimentVoices(
  event: AccompanimentEvent,
  bpm: number,
): AccompanimentVoicePlan {
  const chord = event.midi.length > 0 ? event.midi : [48];
  const bassMidi = Math.min(...chord) - 12;
  const weighted = [
    { midi: bassMidi, weight: 0.55, waveform: "sine" as const },
    ...chord.map((midi) => ({ midi, weight: 1, waveform: "triangle" as const })),
  ];
  const weightTotal = weighted.reduce((sum, voice) => sum + voice.weight, 0);
  const totalGain = 0.035 + clamp01(event.velocity) * 0.075;
  const seconds = event.durationBeats * (60 / Math.max(1, bpm));

  return {
    releaseSeconds: Math.min(1.8, Math.max(0.35, seconds * 0.55)),
    voices: weighted.map((voice) => ({
      midi: voice.midi,
      frequencyHz: midiToFrequency(voice.midi),
      gain: (totalGain * voice.weight) / weightTotal,
      waveform: voice.waveform,
    })),
  };
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
