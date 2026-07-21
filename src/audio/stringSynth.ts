import type { PerformanceState } from "../music/performanceModel";
import type { AccompanimentEvent } from "../music/songTypes";
import { AccompanimentSynth } from "./accompanimentSynth";
import { SyntheticStringVoice } from "./syntheticStringVoice";

export class StringSynth {
  private readonly accompaniment = new AccompanimentSynth();
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private syntheticVoice: SyntheticStringVoice | null = null;

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
    this.syntheticVoice?.update(state);
  }

  async dispose(): Promise<void> {
    const context = this.context;
    if (!context) return;

    this.syntheticVoice?.dispose();
    await new Promise((resolve) => window.setTimeout(resolve, 120));
    this.accompaniment.dispose();
    await context.close();
    this.context = null;
    this.masterGain = null;
    this.syntheticVoice = null;
  }

  private buildGraph(context: AudioContext): void {
    const master = context.createGain();
    master.gain.value = 0.72;
    master.connect(context.destination);
    this.accompaniment.start(context, master);

    this.syntheticVoice = new SyntheticStringVoice(context, master);
    this.masterGain = master;
  }
}
