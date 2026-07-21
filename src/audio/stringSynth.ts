import type { PerformanceState } from "../music/performanceModel";
import type { AccompanimentEvent } from "../music/songTypes";
import { AccompanimentSynth } from "./accompanimentSynth";
import { VIOLIN_SAMPLE_MANIFEST } from "./generated/violinSampleManifest";
import { SampledViolinVoice } from "./sampledViolinVoice";
import { SyntheticStringVoice } from "./syntheticStringVoice";
import {
  shouldLoadSamples,
  shouldNotifySampleFailure,
  type SampleReadiness,
  type ToneMode,
} from "./toneBackendMode";
import { loadViolinSamples } from "./violinSampleLoader";

export type StringSynthOptions = {
  toneMode?: ToneMode;
  onSampleFailure?: (error: Error) => void;
};

export class StringSynth {
  private readonly accompaniment = new AccompanimentSynth();
  private readonly toneMode: ToneMode;
  private readonly onSampleFailure?: (error: Error) => void;
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private syntheticBus: GainNode | null = null;
  private sampleBus: GainNode | null = null;
  private syntheticVoice: SyntheticStringVoice | null = null;
  private sampledVoice: SampledViolinVoice | null = null;
  private sampleReadiness: SampleReadiness = "disabled";
  private latestState: PerformanceState | null = null;
  private loadGeneration = 0;

  constructor(options: StringSynthOptions = {}) {
    this.toneMode = options.toneMode ?? "sample";
    this.onSampleFailure = options.onSampleFailure;
  }

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
    if (this.latestState) this.syntheticVoice?.update(this.latestState);
    const generation = ++this.loadGeneration;
    if (shouldLoadSamples(this.toneMode)) {
      this.setSampleReadiness("loading");
      void this.loadSampleBackend(context, generation);
    }
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
    this.latestState = state;
    this.syntheticVoice?.update(state);
    this.sampledVoice?.update(state);
  }

  async dispose(): Promise<void> {
    const context = this.context;
    if (!context) return;

    this.loadGeneration += 1;
    this.syntheticVoice?.dispose();
    this.sampledVoice?.dispose();
    await new Promise((resolve) => window.setTimeout(resolve, 120));
    this.accompaniment.dispose();
    await context.close();
    this.context = null;
    this.masterGain = null;
    this.syntheticBus = null;
    this.sampleBus = null;
    this.syntheticVoice = null;
    this.sampledVoice = null;
    this.latestState = null;
    this.sampleReadiness = "disabled";
  }

  private buildGraph(context: AudioContext): void {
    const master = context.createGain();
    master.gain.value = 0.72;
    master.connect(context.destination);
    this.accompaniment.start(context, master);

    const syntheticBus = context.createGain();
    syntheticBus.gain.value = 1;
    syntheticBus.connect(master);
    const sampleBus = context.createGain();
    sampleBus.gain.value = 0;
    sampleBus.connect(master);

    this.syntheticVoice = new SyntheticStringVoice(context, syntheticBus);
    this.masterGain = master;
    this.syntheticBus = syntheticBus;
    this.sampleBus = sampleBus;
  }

  private async loadSampleBackend(context: AudioContext, generation: number): Promise<void> {
    try {
      const buffers = await loadViolinSamples(
        VIOLIN_SAMPLE_MANIFEST,
        async (url) => await fetch(url, { cache: "force-cache" }),
        async (bytes) => await context.decodeAudioData(bytes.slice(0)),
      );
      if (generation !== this.loadGeneration || context !== this.context || !this.sampleBus) return;

      this.sampledVoice = new SampledViolinVoice(context, this.sampleBus, buffers);
      if (this.latestState) this.sampledVoice.update(this.latestState);
      this.setSampleReadiness("ready");
      this.crossfadeToSamples(context);
    } catch (error) {
      if (generation !== this.loadGeneration || context !== this.context) return;
      const failure = error instanceof Error ? error : new Error(String(error));
      const shouldNotify = shouldNotifySampleFailure(this.sampleReadiness, "failed");
      this.setSampleReadiness("failed");
      if (shouldNotify) this.onSampleFailure?.(failure);
    }
  }

  private crossfadeToSamples(context: AudioContext): void {
    if (!this.syntheticBus || !this.sampleBus) return;
    const now = context.currentTime;
    const end = now + 0.12;
    this.syntheticBus.gain.cancelScheduledValues(now);
    this.sampleBus.gain.cancelScheduledValues(now);
    this.syntheticBus.gain.setValueAtTime(this.syntheticBus.gain.value, now);
    this.sampleBus.gain.setValueAtTime(this.sampleBus.gain.value, now);
    this.syntheticBus.gain.linearRampToValueAtTime(0, end);
    this.sampleBus.gain.linearRampToValueAtTime(1, end);
  }

  private setSampleReadiness(next: SampleReadiness): void {
    this.sampleReadiness = next;
  }
}
