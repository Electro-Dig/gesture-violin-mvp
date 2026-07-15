import type { PerformanceState } from "../music/performanceModel";
import type { AccompanimentEvent } from "../music/songTypes";
import { AccompanimentSynth } from "./accompanimentSynth";
import { mapStringVoice } from "./stringVoiceModel";

export class StringSynth {
  private readonly accompaniment = new AccompanimentSynth();
  private context: AudioContext | null = null;
  private voiceGain: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private noiseGain: GainNode | null = null;
  private vibratoGain: GainNode | null = null;
  private masterGain: GainNode | null = null;
  private oscillators: OscillatorNode[] = [];
  private noiseSource: AudioBufferSourceNode | null = null;

  get isRunning(): boolean {
    return this.context?.state === "running";
  }

  async start(): Promise<void> {
    if (this.context) {
      await this.context.resume();
      return;
    }

    const context = new AudioContext({ latencyHint: "interactive" });
    this.context = context;
    this.buildGraph(context);
    await context.resume();
  }

  setMuted(muted: boolean): void {
    if (!this.context || !this.masterGain) return;
    this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.72, this.context.currentTime, 0.025);
  }

  triggerAccompaniment(events: AccompanimentEvent[], bpm: number): void {
    events.forEach((event) => this.accompaniment.trigger(event, bpm));
  }

  update(state: PerformanceState): void {
    const context = this.context;
    if (!context || !this.voiceGain || !this.filter || !this.noiseGain || !this.vibratoGain) {
      return;
    }

    const params = mapStringVoice(state);
    const now = context.currentTime;
    const glide = 0.025;

    this.oscillators.forEach((oscillator) => {
      oscillator.frequency.setTargetAtTime(params.frequencyHz, now, glide);
    });
    this.filter.frequency.setTargetAtTime(params.filterHz, now, 0.035);
    this.noiseGain.gain.setTargetAtTime(params.noiseGain, now, 0.025);
    this.vibratoGain.gain.setTargetAtTime(params.vibratoDepth, now, 0.05);
    this.voiceGain.gain.setTargetAtTime(
      params.gain,
      now,
      state.voiceActive ? params.attackSeconds : params.releaseSeconds,
    );
  }

  async dispose(): Promise<void> {
    const context = this.context;
    if (!context) return;

    const now = context.currentTime;
    this.voiceGain?.gain.setTargetAtTime(0, now, 0.03);
    await new Promise((resolve) => window.setTimeout(resolve, 100));
    this.accompaniment.dispose();
    await context.close();
    this.context = null;
    this.voiceGain = null;
    this.filter = null;
    this.noiseGain = null;
    this.vibratoGain = null;
    this.masterGain = null;
    this.oscillators = [];
    this.noiseSource = null;
  }

  private buildGraph(context: AudioContext): void {
    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 1300;
    filter.Q.value = 1.25;

    const voiceGain = context.createGain();
    voiceGain.gain.value = 0;
    const master = context.createGain();
    master.gain.value = 0.72;

    const dry = context.createGain();
    dry.gain.value = 0.86;
    const delay = context.createDelay(1);
    delay.delayTime.value = 0.19;
    const feedback = context.createGain();
    feedback.gain.value = 0.24;
    const wet = context.createGain();
    wet.gain.value = 0.22;

    filter.connect(voiceGain);
    voiceGain.connect(dry).connect(master);
    voiceGain.connect(delay);
    delay.connect(feedback).connect(delay);
    delay.connect(wet).connect(master);
    master.connect(context.destination);
    this.accompaniment.start(context, master);

    const oscillatorSettings: Array<{ type: OscillatorType; level: number; detune: number }> = [
      { type: "sawtooth", level: 0.5, detune: -5 },
      { type: "triangle", level: 0.62, detune: 4 },
    ];
    this.oscillators = oscillatorSettings.map((settings) => {
      const oscillator = context.createOscillator();
      oscillator.type = settings.type;
      oscillator.frequency.value = 220;
      oscillator.detune.value = settings.detune;
      const level = context.createGain();
      level.gain.value = settings.level;
      oscillator.connect(level).connect(filter);
      oscillator.start();
      return oscillator;
    });

    const noiseSource = context.createBufferSource();
    noiseSource.buffer = createNoiseBuffer(context, 2);
    noiseSource.loop = true;
    const noiseFilter = context.createBiquadFilter();
    noiseFilter.type = "bandpass";
    noiseFilter.frequency.value = 1800;
    noiseFilter.Q.value = 0.55;
    const noiseGain = context.createGain();
    noiseGain.gain.value = 0;
    noiseSource.connect(noiseFilter).connect(noiseGain).connect(filter);
    noiseSource.start();

    const vibrato = context.createOscillator();
    vibrato.type = "sine";
    vibrato.frequency.value = 5.15;
    const vibratoGain = context.createGain();
    vibratoGain.gain.value = 0;
    vibrato.connect(vibratoGain);
    this.oscillators.forEach((oscillator) => vibratoGain.connect(oscillator.frequency));
    vibrato.start();

    this.voiceGain = voiceGain;
    this.filter = filter;
    this.noiseGain = noiseGain;
    this.vibratoGain = vibratoGain;
    this.masterGain = master;
    this.noiseSource = noiseSource;
  }
}

function createNoiseBuffer(context: AudioContext, seconds: number): AudioBuffer {
  const length = Math.ceil(context.sampleRate * seconds);
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  let previous = 0;
  for (let index = 0; index < length; index += 1) {
    const white = Math.random() * 2 - 1;
    previous = previous * 0.72 + white * 0.28;
    data[index] = previous;
  }
  return buffer;
}
