# Sampled Violin Voice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the default oscillator-led violin voice with a responsive, CC0 VSCO 2 CE sampled solo violin while preserving instant sound, graceful synth fallback, and the existing gesture/MIDI behavior.

**Architecture:** A reproducible importer turns twelve pinned `Arco Vib` WAV sources into a checked-in MP3 runtime set and a typed manifest. Pure functions decide root selection, p/f layer gains, bow attacks, continuation, and backend readiness. `StringSynth` remains the public coordinator: it starts the extracted synthetic voice immediately, loads the sampled voice asynchronously into the same `AudioContext`, and crossfades only after the complete sample set is decoded.

**Tech Stack:** TypeScript 7, Vite 8, native Web Audio API, Node test runner + tsx, Node fetch/crypto/fs APIs, FFmpeg 8, Netlify draft deploys.

---

## Task 1: Make the VSCO asset pipeline reproducible

**Files:**
- Create: `audio-sources/vsco2-ce/README.md`
- Create: `audio-sources/vsco2-ce/LICENSE-CC0.txt`
- Create: `audio-sources/vsco2-ce/source-manifest.json`
- Create: `audio-sources/vsco2-ce/source-lock.json`
- Create: `scripts/lib/violinSampleImporter.ts`
- Create: `scripts/import-violin-samples.ts`
- Create: `src/tests/violinSampleImporter.test.ts`
- Modify: `package.json`
- Modify: `.gitignore`

- [ ] **Step 1: Add failing importer tests for the immutable twelve-file matrix**

Write `src/tests/violinSampleImporter.test.ts` against pure exports from `scripts/lib/violinSampleImporter.ts`. Assert that six roots (`C4`, `E4`, `G4`, `A4`, `C5`, `E5`) multiplied by two dynamics (`p`, `f`) produce exactly twelve unique entries; every URL contains `/1.1.0/Strings/Solo%20Violin/Arco%20Vib/`; output filenames are lowercase and end in `.mp3`; and raw WAV destinations stay below `audio-sources/vsco2-ce/.cache/`.

- [ ] **Step 2: Run the focused test and observe the missing-module failure**

Run: `pnpm exec tsx --test src/tests/violinSampleImporter.test.ts`

Expected: FAIL because `scripts/lib/violinSampleImporter.ts` does not exist.

- [ ] **Step 3: Implement the manifest parser and deterministic command plan**

Define these types and pure helpers in `scripts/lib/violinSampleImporter.ts`:

```ts
export type ViolinSourceEntry = {
  id: string;
  rootMidi: number;
  rootNote: string;
  dynamic: "p" | "f";
  sourceUrl: string;
  sourceFile: string;
  outputFile: string;
};

export function buildSourceEntries(manifest: ViolinSourceManifest): ViolinSourceEntry[];
export function ffmpegArguments(sourcePath: string, outputPath: string): string[];
export function sha256File(filePath: string): Promise<string>;
```

Use the exact FFmpeg transform `-ac 1 -ar 44100 -af aresample=resampler=soxr,alimiter=limit=0.92 -codec:a libmp3lame -b:a 128k -write_xing 0`. Do not loudness-normalize p and f independently; the limiter only prevents unsafe peaks and retains the recorded dynamic relationship.

- [ ] **Step 4: Add the checked-in source manifest and CC0 provenance**

`source-manifest.json` must pin GitHub tag `1.1.0`, list the twelve `LLVln_ArcoVib_{root}_{dynamic}.wav` files, and set output directory `public/audio/violin/vsco2-ce`. `README.md` must link the official VSCO page, repository, release, sample folder, and SFZ mapping and explain the transformation. Copy the repository's CC0 license text into `LICENSE-CC0.txt` with the repository attribution.

- [ ] **Step 5: Implement download, lock, conversion, and generated-manifest behavior**

`scripts/import-violin-samples.ts` must:

1. load and validate the source manifest;
2. download each pinned URL only into the ignored `.cache/` directory;
3. compute SHA-256 and either create `source-lock.json` with `--update-lock` or verify the checked-in lock during a normal run;
4. invoke `ffmpeg` and `ffprobe` using `spawn` with argument arrays, never a shell string;
5. write the twelve MP3 files;
6. generate `src/audio/generated/violinSampleManifest.ts` with URL, root MIDI, dynamic, duration, source SHA-256, output SHA-256, and bytes;
7. fail if output count is not twelve or total bytes exceed `1_500_000`.

Add scripts:

```json
"audio:import": "tsx scripts/import-violin-samples.ts",
"audio:lock": "tsx scripts/import-violin-samples.ts --update-lock"
```

Ignore only `audio-sources/vsco2-ce/.cache/`; keep provenance, locks, generated metadata, and compressed assets tracked.

- [ ] **Step 6: Run the focused tests and importer unit checks**

Run: `pnpm exec tsx --test src/tests/violinSampleImporter.test.ts`

Expected: PASS with twelve deterministic entries and stable FFmpeg arguments.

- [ ] **Step 7: Commit the pipeline**

```bash
git add .gitignore package.json audio-sources/vsco2-ce scripts/import-violin-samples.ts scripts/lib/violinSampleImporter.ts src/tests/violinSampleImporter.test.ts
git commit -m "feat: add reproducible violin sample pipeline"
```

## Task 2: Import and verify the runtime sample set

**Files:**
- Create: `public/audio/violin/vsco2-ce/*.mp3`
- Create: `src/audio/generated/violinSampleManifest.ts`
- Create: `src/tests/violinSampleAssets.test.ts`
- Modify: `audio-sources/vsco2-ce/source-lock.json`

- [ ] **Step 1: Add the failing runtime asset test**

Write `src/tests/violinSampleAssets.test.ts` to import the generated manifest and verify:

- exactly twelve files and all root/dynamic pairs;
- each `public` file exists and its computed SHA-256 equals the generated hash;
- every source SHA-256 equals `source-lock.json`;
- every duration is finite and positive;
- `LICENSE-CC0.txt` exists;
- total bytes are positive and at most `1_500_000`.

- [ ] **Step 2: Run the test and observe the missing-assets failure**

Run: `pnpm exec tsx --test src/tests/violinSampleAssets.test.ts`

Expected: FAIL because the generated manifest and MP3 assets do not yet exist.

- [ ] **Step 3: Generate the source lock and compressed assets**

Run:

```bash
ffmpeg -version
pnpm audio:lock
pnpm audio:import
```

Expected: twelve verified downloads, twelve MP3 outputs, a generated TypeScript manifest, and a reported total no larger than 1.5 MB. If the first 128 kbps encode exceeds the budget, trim only trailing silence beyond the steady sustain area and re-run with the same transform for all files; do not lower below 96 kbps without recording the change in `audio-sources/vsco2-ce/README.md`.

- [ ] **Step 4: Run the asset test and a clean regeneration check**

Run:

```bash
pnpm exec tsx --test src/tests/violinSampleAssets.test.ts
pnpm audio:import
git diff --exit-code -- audio-sources/vsco2-ce/source-lock.json src/audio/generated/violinSampleManifest.ts public/audio/violin/vsco2-ce
```

Expected: PASS and no diff after the second deterministic import.

- [ ] **Step 5: Commit the licensed runtime assets**

```bash
git add audio-sources/vsco2-ce public/audio/violin/vsco2-ce src/audio/generated/violinSampleManifest.ts src/tests/violinSampleAssets.test.ts
git commit -m "feat: add CC0 sampled violin assets"
```

## Task 3: Implement the pure sampled-voice decisions

**Files:**
- Create: `src/audio/sampleVoiceModel.ts`
- Create: `src/tests/sampleVoiceModel.test.ts`

- [ ] **Step 1: Write failing root-selection and layer-mix tests**

Cover the playable MIDI values `60, 62, 64, 67, 69, 72, 74, 76`. Assert roots `60, 64, 64, 67, 69, 72, 76, 76`, maximum absolute shift two semitones, and:

```ts
layerGains(0)   // { piano: 1, forte: 0 }
layerGains(0.5) // both approximately Math.SQRT1_2
layerGains(1)   // { piano: 0, forte: 1 }
```

Also assert all gains are finite and monotonic across intensities from 0 to 1.

- [ ] **Step 2: Write failing articulation and continuation tests**

Create previous/current frame fixtures and assert a fresh attack for inactive-to-active, target MIDI change, root change, or non-zero direction reversal. Assert no attack for ordinary same-note/same-direction frames. Assert continuation only while active and when `remainingSeconds <= 0.18`, with a steady restart offset and `0.09` second crossfade.

- [ ] **Step 3: Run the focused test and observe the missing-module failure**

Run: `pnpm exec tsx --test src/tests/sampleVoiceModel.test.ts`

Expected: FAIL because `sampleVoiceModel.ts` does not exist.

- [ ] **Step 4: Implement the minimal pure model**

Export:

```ts
export type SampleVoiceFrame = Pick<PerformanceState,
  "voiceActive" | "phase" | "midi" | "intensity" | "direction"
>;

export function selectSampleRoot(targetMidi: number): SampleRoot;
export function playbackRate(targetMidi: number, rootMidi: number): number;
export function layerGains(intensity: number): { piano: number; forte: number };
export function needsFreshBow(previous: SampleVoiceFrame | null, next: SampleVoiceFrame): boolean;
export function shouldContinue(active: boolean, remainingSeconds: number): boolean;
```

Use `cos(intensity * PI / 2)` and `sin(intensity * PI / 2)` for equal-power layers. Use constants `BOW_CROSSFADE_SECONDS = 0.035`, `CONTINUATION_CROSSFADE_SECONDS = 0.09`, `RELEASE_SECONDS = 0.11`, and `CONTINUATION_THRESHOLD_SECONDS = 0.18`.

- [ ] **Step 5: Run the focused tests**

Run: `pnpm exec tsx --test src/tests/sampleVoiceModel.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit the model**

```bash
git add src/audio/sampleVoiceModel.ts src/tests/sampleVoiceModel.test.ts
git commit -m "feat: model sampled violin articulation"
```

## Task 4: Extract the current synth and add deterministic room ambience

**Files:**
- Create: `src/audio/syntheticStringVoice.ts`
- Create: `src/audio/roomImpulse.ts`
- Create: `src/tests/roomImpulse.test.ts`
- Modify: `src/audio/stringSynth.ts`

- [ ] **Step 1: Add a failing deterministic impulse test**

Test a pure `createRoomImpulseData(sampleRate, seconds, seed)` helper. Two calls with the same arguments must be byte-for-byte equal, two different seeds must differ, all samples must be finite and within `[-1, 1]`, and the final quarter RMS must be lower than the first quarter RMS.

- [ ] **Step 2: Run the focused test and observe the missing-module failure**

Run: `pnpm exec tsx --test src/tests/roomImpulse.test.ts`

Expected: FAIL because `roomImpulse.ts` does not exist.

- [ ] **Step 3: Move the existing oscillator graph without changing its model**

Extract the existing oscillators, filter, pink-ish bow noise, vibrato LFO, voice gain, `update`, and release/dispose behavior into `SyntheticStringVoice`. Its constructor receives `AudioContext` and a destination node. Keep `mapStringVoice` values unchanged so `?tone=synth` remains a valid baseline.

- [ ] **Step 4: Implement the seeded short-room impulse**

Use a tiny integer PRNG and an exponential decay envelope to generate a stereo `AudioBuffer` of `0.42` seconds. Connect the future sample bus `86%` dry and `14%` convolver wet. This adds no network asset and produces identical output data for the same seed.

- [ ] **Step 5: Keep `StringSynth` behavior green with only the extracted synth active**

Refactor `StringSynth.buildGraph()` to create master/accompaniment once, instantiate `SyntheticStringVoice`, and delegate update/mute/dispose. Do not add sample loading yet. Run:

```bash
pnpm exec tsx --test src/tests/stringVoiceModel.test.ts src/tests/roomImpulse.test.ts
pnpm build
```

Expected: PASS and a successful production bundle.

- [ ] **Step 6: Commit the safe extraction**

```bash
git add src/audio/syntheticStringVoice.ts src/audio/roomImpulse.ts src/audio/stringSynth.ts src/tests/roomImpulse.test.ts
git commit -m "refactor: isolate synthetic violin fallback"
```

## Task 5: Implement sample loading and Web Audio playback

**Files:**
- Create: `src/audio/violinSampleLoader.ts`
- Create: `src/audio/sampledViolinVoice.ts`
- Create: `src/tests/violinSampleLoader.test.ts`
- Modify: `src/audio/sampleVoiceModel.ts`

- [ ] **Step 1: Add failing all-or-nothing loader tests**

Inject `fetch` and `decodeAudioData` functions into `loadViolinSamples`. Test that it returns a complete keyed buffer map only after all twelve entries succeed; a single non-2xx response or decode rejection rejects with the failing asset id; duplicate or missing root/dynamic keys are rejected before fetching.

- [ ] **Step 2: Run the focused loader test and observe the failure**

Run: `pnpm exec tsx --test src/tests/violinSampleLoader.test.ts`

Expected: FAIL because the loader does not exist.

- [ ] **Step 3: Implement the all-or-nothing loader**

Use the generated manifest, parallel `fetch` calls, `response.arrayBuffer()`, and `context.decodeAudioData()`. Return `Map<string, AudioBuffer>` only when all entries are present. Preserve the first concrete asset id in thrown errors and do not retry in a loop.

- [ ] **Step 4: Implement `SampledViolinVoice`**

For every sounding instance:

- create synchronized p/f `AudioBufferSourceNode`s for the selected root;
- set identical `playbackRate` and independent p/f gains;
- route both through an instance gain into the dry/room bus;
- schedule fresh-bow/note/root/direction crossfades over `0.035` seconds;
- update gain and playback rate with short `setTargetAtTime` ramps;
- start continuation sources from a steady offset before the tail and overlap for `0.09` seconds;
- release all active instances over `0.11` seconds and stop them after the fade;
- mix a lightweight generated bow-noise source at `20%` of the old noise model;
- omit the synthetic vibrato LFO because the Arco Vib recordings already contain vibrato.

Keep an explicit `dispose()` that cancels continuation scheduling and stops every source.

- [ ] **Step 5: Run model, loader, asset, and build checks**

Run:

```bash
pnpm exec tsx --test src/tests/sampleVoiceModel.test.ts src/tests/violinSampleLoader.test.ts src/tests/violinSampleAssets.test.ts
pnpm build
```

Expected: PASS with no TypeScript DOM-audio type errors.

- [ ] **Step 6: Commit the sampled backend**

```bash
git add src/audio/violinSampleLoader.ts src/audio/sampledViolinVoice.ts src/audio/sampleVoiceModel.ts src/tests/violinSampleLoader.test.ts
git commit -m "feat: play expressive sampled violin voice"
```

## Task 6: Coordinate instant fallback, readiness, and A/B modes

**Files:**
- Create: `src/audio/toneBackendMode.ts`
- Create: `src/tests/toneBackendMode.test.ts`
- Modify: `src/audio/stringSynth.ts`
- Modify: `src/app.ts`

- [ ] **Step 1: Add failing backend-state tests**

Cover query parsing and backend decisions:

- no parameter, invalid parameter, and `tone=sample` produce sample-priority mode;
- `tone=synth` produces synth-only mode and never requests sample loading;
- `loading` and `failed` use synth output;
- only a complete `ready` sample set selects sample output;
- a failure callback fires once, not every animation frame.

- [ ] **Step 2: Run the focused test and observe the missing-module failure**

Run: `pnpm exec tsx --test src/tests/toneBackendMode.test.ts`

Expected: FAIL because `toneBackendMode.ts` does not exist.

- [ ] **Step 3: Implement the pure backend state machine**

Export a small discriminated state model:

```ts
export type ToneMode = "sample" | "synth";
export type SampleReadiness = "disabled" | "loading" | "ready" | "failed";
export function readToneMode(search: string): ToneMode;
export function activeBackend(mode: ToneMode, readiness: SampleReadiness): "sample" | "synth";
```

Keep default and `tone=sample` identical so the A/B URL changes only the synth override.

- [ ] **Step 4: Upgrade `StringSynth` into the coordinator**

Accept options `{ toneMode, onSampleFailure }`. On first `start()`:

1. create the interactive `AudioContext`, master gain, accompaniment, and synthetic voice;
2. resume immediately so gestures already produce synth sound;
3. unless synth-only, load and decode the entire manifest asynchronously;
4. instantiate `SampledViolinVoice` only after complete success;
5. crossfade backend bus gains over `0.12` seconds;
6. on any failure, retain synth at full gain and call `onSampleFailure` exactly once.

Send every `PerformanceState` to the active voice and also send the latest state once when sample readiness flips, preventing a silent wait for the next gesture frame. Muting and disposal must affect both backends and accompaniment through the shared master.

- [ ] **Step 5: Wire the URL mode and non-blocking UI notice**

Instantiate `StringSynth` inside the `GestureViolinApp` constructor after `AppView` exists:

```ts
this.synth = new StringSynth({
  toneMode: readToneMode(window.location.search),
  onSampleFailure: () => this.view.setError("真实提琴音色加载失败 · 已自动使用合成音色"),
});
```

Do not add a permanent tone selector. Preserve the camera retry control and clear the sample warning only on an intentional new audio start, not on every tracking update.

- [ ] **Step 6: Run focused and full automated verification**

Run:

```bash
pnpm exec tsx --test src/tests/toneBackendMode.test.ts src/tests/stringVoiceModel.test.ts src/tests/sampleVoiceModel.test.ts
pnpm test
pnpm build
pnpm audio:import
git diff --exit-code -- audio-sources/vsco2-ce/source-lock.json src/audio/generated/violinSampleManifest.ts public/audio/violin/vsco2-ce
```

Expected: every test passes, build succeeds, and regeneration creates no diff.

- [ ] **Step 7: Commit integration**

```bash
git add src/audio/toneBackendMode.ts src/audio/stringSynth.ts src/app.ts src/tests/toneBackendMode.test.ts
git commit -m "feat: prefer sampled violin with instant fallback"
```

## Task 7: Document, listen-test, and preserve the production deployment

**Files:**
- Modify: `README.md`
- Create: `docs/verification/2026-07-22-sampled-violin-voice.md`

- [ ] **Step 1: Update user and maintainer documentation**

Replace the README claim that the main violin is entirely synthesized. Document VSCO 2 CE CC0 provenance, the twelve compressed samples, `pnpm audio:import`, the 1.5 MB budget, synth fallback, and the `?tone=synth` A/B override. Keep accompaniment described as browser synthesis.

- [ ] **Step 2: Start a local production preview and verify both modes**

Run:

```bash
pnpm build
pnpm preview --host 127.0.0.1
```

In a Chromium browser, compare `/?demo=1` and `/?demo=1&tone=synth`. Verify immediate sound after the audio button, a click-free 120 ms handoff, all eight pitches, p/f timbre response, audible direction attacks without double-triggering, sustained notes longer than one source duration, mute/unmute, and the absence of console errors.

- [ ] **Step 3: Record evidence and final size numbers**

Write `docs/verification/2026-07-22-sampled-violin-voice.md` with the exact commit, commands, test count, build output sizes, sample total bytes, browser/version, URLs tested, A/B listening findings, and any residual limitations. Do not mark subjective listening checks as automated.

- [ ] **Step 4: Run the final clean-tree verification set**

Run:

```bash
pnpm test
pnpm build
pnpm audio:import
git diff --check
git status --short
```

Expected: tests and build pass, importer is deterministic, `git diff --check` is clean, and only intended documentation changes remain.

- [ ] **Step 5: Commit documentation and verification evidence**

```bash
git add README.md docs/verification/2026-07-22-sampled-violin-voice.md
git commit -m "docs: verify sampled violin voice"
```

- [ ] **Step 6: Publish a new Netlify draft preview only**

Run a non-production draft deployment against site `29931500-0653-4cc2-af3a-1370ebe20b13` with a new alias containing the sampled-voice commit. Smoke-check the page, CSS, JavaScript, all twelve MP3 URLs, default demo URL, and `?tone=synth` URL. Do not pass `--prod` and do not replace the existing `b1f4747-test` preview.

- [ ] **Step 7: Report both comparison links**

Return the new sampled preview, its synth A/B URL, and the preserved previous preview. State explicitly that production `https://gesture-violin-lab-664.netlify.app` was not changed.
