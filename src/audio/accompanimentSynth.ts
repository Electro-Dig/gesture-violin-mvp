import type { AccompanimentEvent } from "../music/songTypes";
import { planAccompanimentVoices } from "./accompanimentModel";

export class AccompanimentSynth {
  private context: AudioContext | null = null;
  private mix: GainNode | null = null;
  private readonly active = new Set<OscillatorNode>();

  start(context: AudioContext, destination: AudioNode): void {
    if (this.context) return;
    this.context = context;
    this.mix = context.createGain();
    this.mix.gain.value = 1;
    this.mix.connect(destination);
  }

  trigger(event: AccompanimentEvent, bpm: number): void {
    if (!this.context || !this.mix) return;
    const context = this.context;
    const plan = planAccompanimentVoices(event, bpm);
    const now = context.currentTime;

    plan.voices.forEach((voice) => {
      const oscillator = context.createOscillator();
      oscillator.type = voice.waveform;
      oscillator.frequency.value = voice.frequencyHz;
      const gain = context.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, voice.gain), now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + plan.releaseSeconds);
      oscillator.connect(gain).connect(this.mix!);
      oscillator.addEventListener("ended", () => {
        this.active.delete(oscillator);
        oscillator.disconnect();
        gain.disconnect();
      }, { once: true });
      this.active.add(oscillator);
      oscillator.start(now);
      oscillator.stop(now + plan.releaseSeconds + 0.05);
    });
  }

  setMuted(muted: boolean): void {
    if (!this.context || !this.mix) return;
    this.mix.gain.setTargetAtTime(muted ? 0 : 1, this.context.currentTime, 0.025);
  }

  dispose(): void {
    this.active.forEach((oscillator) => {
      try {
        oscillator.stop();
      } catch {
        // The oscillator may already have reached its scheduled stop.
      }
      oscillator.disconnect();
    });
    this.active.clear();
    this.mix?.disconnect();
    this.mix = null;
    this.context = null;
  }
}
