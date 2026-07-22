import type { PerformanceState } from "../music/performanceModel";
import { createRoomImpulseBuffer } from "./roomImpulse";
import {
  BOW_CROSSFADE_SECONDS,
  CONTINUATION_CROSSFADE_SECONDS,
  RELEASE_SECONDS,
  layerGains,
  needsFreshBow,
  playbackRate,
  selectSampleRoot,
  shouldContinue,
  type SampleVoiceFrame,
} from "./sampleVoiceModel";
import { mapStringVoice } from "./stringVoiceModel";

type VoiceInstance = {
  rootMidi: number;
  piano: AudioBufferSourceNode;
  forte: AudioBufferSourceNode;
  pianoGain: GainNode;
  forteGain: GainNode;
  envelope: GainNode;
  endsAt: number;
  released: boolean;
};

export class SampledViolinVoice {
  private readonly sourceBus: GainNode;
  private readonly noiseGain: GainNode;
  private readonly noiseSource: AudioBufferSourceNode;
  private readonly instances = new Set<VoiceInstance>();
  private current: VoiceInstance | null = null;
  private previousFrame: SampleVoiceFrame | null = null;

  constructor(
    private readonly context: AudioContext,
    destination: AudioNode,
    private readonly samples: ReadonlyMap<string, AudioBuffer>,
  ) {
    const sourceBus = context.createGain();
    const dry = context.createGain();
    dry.gain.value = 0.86;
    const convolver = context.createConvolver();
    convolver.buffer = createRoomImpulseBuffer(context);
    const wet = context.createGain();
    wet.gain.value = 0.14;
    sourceBus.connect(dry).connect(destination);
    sourceBus.connect(convolver).connect(wet).connect(destination);

    const noiseSource = context.createBufferSource();
    noiseSource.buffer = createBowNoiseBuffer(context, 2);
    noiseSource.loop = true;
    const noiseFilter = context.createBiquadFilter();
    noiseFilter.type = "bandpass";
    noiseFilter.frequency.value = 2200;
    noiseFilter.Q.value = 0.7;
    const noiseGain = context.createGain();
    noiseGain.gain.value = 0;
    noiseSource.connect(noiseFilter).connect(noiseGain).connect(sourceBus);
    noiseSource.start();

    this.sourceBus = sourceBus;
    this.noiseGain = noiseGain;
    this.noiseSource = noiseSource;
  }

  update(state: PerformanceState): void {
    const frame = toSampleFrame(state);
    const now = this.context.currentTime;
    const sounding = state.voiceActive && state.phase === "bowing";
    const expressive = mapStringVoice(state);
    this.noiseGain.gain.setTargetAtTime(
      sounding ? expressive.noiseGain * 0.2 : 0,
      now,
      sounding ? 0.025 : RELEASE_SECONDS,
    );

    if (!sounding) {
      this.releaseAll(RELEASE_SECONDS);
      this.previousFrame = frame;
      return;
    }

    if (!this.current || needsFreshBow(this.previousFrame, frame)) {
      this.replaceCurrent(state, 0, BOW_CROSSFADE_SECONDS);
    } else {
      this.updateInstance(this.current, state);
      const remainingSeconds = this.current.endsAt - now;
      if (shouldContinue(true, remainingSeconds)) {
        const root = selectSampleRoot(state.midi);
        const piano = this.requireSample(root.rootMidi, "p");
        const steadyOffset = Math.min(2.2, Math.max(0.8, piano.duration * 0.28));
        this.replaceCurrent(state, steadyOffset, CONTINUATION_CROSSFADE_SECONDS);
      }
    }

    this.previousFrame = frame;
  }

  dispose(): void {
    this.releaseAll(0.02);
    this.noiseGain.gain.cancelScheduledValues(this.context.currentTime);
    this.noiseGain.gain.setValueAtTime(0, this.context.currentTime);
    this.noiseSource.stop(this.context.currentTime + 0.03);
    this.previousFrame = null;
  }

  private replaceCurrent(state: PerformanceState, offset: number, crossfadeSeconds: number): void {
    const previous = this.current;
    const next = this.startInstance(state, offset, crossfadeSeconds);
    this.current = next;
    if (previous) this.releaseInstance(previous, crossfadeSeconds);
  }

  private startInstance(
    state: PerformanceState,
    offset: number,
    attackSeconds: number,
  ): VoiceInstance {
    const now = this.context.currentTime;
    const root = selectSampleRoot(state.midi);
    const pianoBuffer = this.requireSample(root.rootMidi, "p");
    const forteBuffer = this.requireSample(root.rootMidi, "f");
    const rate = playbackRate(state.midi, root.rootMidi);
    const safeOffset = Math.min(offset, Math.max(0, Math.min(pianoBuffer.duration, forteBuffer.duration) - 0.25));

    const piano = this.context.createBufferSource();
    piano.buffer = pianoBuffer;
    piano.playbackRate.value = rate;
    const forte = this.context.createBufferSource();
    forte.buffer = forteBuffer;
    forte.playbackRate.value = rate;
    const pianoGain = this.context.createGain();
    const forteGain = this.context.createGain();
    const envelope = this.context.createGain();
    envelope.gain.value = 0;
    piano.connect(pianoGain).connect(envelope);
    forte.connect(forteGain).connect(envelope);
    envelope.connect(this.sourceBus);

    const instance: VoiceInstance = {
      rootMidi: root.rootMidi,
      piano,
      forte,
      pianoGain,
      forteGain,
      envelope,
      endsAt: now + (Math.min(pianoBuffer.duration, forteBuffer.duration) - safeOffset) / rate,
      released: false,
    };
    this.instances.add(instance);
    this.updateInstance(instance, state, true);
    const targetGain = overallGain(state.intensity);
    envelope.gain.setValueAtTime(0, now);
    envelope.gain.linearRampToValueAtTime(targetGain, now + attackSeconds);

    let endedSources = 0;
    const handleEnded = () => {
      endedSources += 1;
      if (endedSources === 2) {
        this.instances.delete(instance);
        if (this.current === instance) this.current = null;
      }
    };
    piano.addEventListener("ended", handleEnded, { once: true });
    forte.addEventListener("ended", handleEnded, { once: true });
    piano.start(now, safeOffset);
    forte.start(now, safeOffset);
    return instance;
  }

  private updateInstance(instance: VoiceInstance, state: PerformanceState, immediate = false): void {
    const now = this.context.currentTime;
    const root = selectSampleRoot(state.midi);
    const rate = playbackRate(state.midi, root.rootMidi);
    const layers = layerGains(state.intensity);
    const glide = immediate ? 0.001 : 0.025;
    instance.piano.playbackRate.setTargetAtTime(rate, now, glide);
    instance.forte.playbackRate.setTargetAtTime(rate, now, glide);
    instance.pianoGain.gain.setTargetAtTime(layers.piano, now, glide);
    instance.forteGain.gain.setTargetAtTime(layers.forte, now, glide);
    if (!immediate) {
      instance.envelope.gain.setTargetAtTime(overallGain(state.intensity), now, 0.025);
    }
  }

  private releaseAll(seconds: number): void {
    this.instances.forEach((instance) => this.releaseInstance(instance, seconds));
    this.current = null;
  }

  private releaseInstance(instance: VoiceInstance, seconds: number): void {
    if (instance.released) return;
    instance.released = true;
    const now = this.context.currentTime;
    const stopAt = now + seconds + 0.02;
    instance.envelope.gain.cancelScheduledValues(now);
    instance.envelope.gain.setValueAtTime(instance.envelope.gain.value, now);
    instance.envelope.gain.linearRampToValueAtTime(0, now + seconds);
    instance.piano.stop(stopAt);
    instance.forte.stop(stopAt);
  }

  private requireSample(rootMidi: number, dynamic: "p" | "f"): AudioBuffer {
    const sample = this.samples.get(`${noteName(rootMidi).toLowerCase()}-${dynamic}`);
    if (!sample) throw new Error(`Missing decoded violin sample: ${rootMidi}-${dynamic}`);
    return sample;
  }
}

function toSampleFrame(state: PerformanceState): SampleVoiceFrame {
  return {
    voiceActive: state.voiceActive,
    phase: state.phase,
    midi: state.midi,
    intensity: state.intensity,
    direction: state.direction,
    articulationId: state.articulationId,
  };
}

function overallGain(intensity: number): number {
  const amount = Math.min(1, Math.max(0, intensity));
  return 0.045 + amount * 0.28;
}

function noteName(rootMidi: number): string {
  const root = selectSampleRoot(rootMidi);
  if (root.rootMidi !== rootMidi) throw new Error(`Unsupported violin sample root: ${rootMidi}`);
  return root.rootNote;
}

function createBowNoiseBuffer(context: AudioContext, seconds: number): AudioBuffer {
  const length = Math.ceil(context.sampleRate * seconds);
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  let state = 0xb077e5;
  let previous = 0;
  for (let index = 0; index < length; index += 1) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    const white = ((state >>> 0) / 0x1_0000_0000) * 2 - 1;
    previous = previous * 0.72 + white * 0.28;
    data[index] = previous;
  }
  return buffer;
}
