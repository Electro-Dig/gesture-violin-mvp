# Camera Performance Stage and MIDI Pipeline Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use `subagent-driven-development` for reviewed task-by-task execution, or `executing-plans` for inline execution.

**Goal:** Deliver a lower-latency single-hand violin experience with a full-screen camera stage, a violin and orbital note guide on the right, a compact measure overview, and guided melodies reproducibly generated from licensed MIDI sources.

**Architecture:** Drive inference from new video frames instead of the render loop, with GPU-first/CPU-fallback MediaPipe initialization and a stable primary-hand selector over an array-shaped tracking result. Keep gesture interpretation, orbit geometry, progress calculation, and MIDI conversion in pure modules covered by Node tests. The browser app renders the mirrored camera as the stage background, places the existing Three.js violin on the right, and consumes checked-in generated song data; a Node-only importer owns MIDI parsing and provenance.

**Tech Stack:** TypeScript 7, Vite 8, Three.js 0.185, MediaPipe Tasks Vision 0.10.35, Web Audio, Node test runner with tsx, @tonejs/midi 2.0.28, SVG/CSS, Netlify.

---

### Task 1: Add a video-frame inference runtime

**Files:**

- Create: `src/gesture/videoFrameRuntime.ts`
- Test: `src/tests/videoFrameRuntime.test.ts`

**Step 1: Write the failing tests**

```ts
import assert from "node:assert/strict";
import test from "node:test";

import {
  VideoFrameGate,
  createWithDelegateFallback,
} from "../gesture/videoFrameRuntime";

test("VideoFrameGate accepts each media frame once", () => {
  const gate = new VideoFrameGate();
  assert.equal(gate.accept(1.25), true);
  assert.equal(gate.accept(1.25), false);
  assert.equal(gate.accept(1.251), true);
});

test("delegate creation falls back from GPU to CPU", async () => {
  const attempts: string[] = [];
  const result = await createWithDelegateFallback(async (delegate) => {
    attempts.push(delegate);
    if (delegate === "GPU") throw new Error("GPU unavailable");
    return { delegate };
  });

  assert.deepEqual(attempts, ["GPU", "CPU"]);
  assert.equal(result.delegate, "CPU");
});
```

**Step 2: Run the test to verify it fails**

Run: `pnpm test -- src/tests/videoFrameRuntime.test.ts`

Expected: FAIL because `../gesture/videoFrameRuntime` does not exist.

**Step 3: Write the minimal runtime**

```ts
export type VisionDelegate = "GPU" | "CPU";

export class VideoFrameGate {
  private lastMediaTime = -1;

  accept(mediaTime: number): boolean {
    if (!Number.isFinite(mediaTime) || mediaTime <= this.lastMediaTime) {
      return false;
    }
    this.lastMediaTime = mediaTime;
    return true;
  }

  reset(): void {
    this.lastMediaTime = -1;
  }
}

export async function createWithDelegateFallback<T>(
  create: (delegate: VisionDelegate) => Promise<T>,
): Promise<T> {
  try {
    return await create("GPU");
  } catch {
    return create("CPU");
  }
}
```

Keep browser scheduling out of this module; `requestVideoFrameCallback` integration belongs in `HandTracker`.

**Step 4: Run the focused and full test suites**

Run:

```bash
pnpm test -- src/tests/videoFrameRuntime.test.ts
pnpm test
```

Expected: both PASS.

**Step 5: Commit**

```bash
git add src/gesture/videoFrameRuntime.ts src/tests/videoFrameRuntime.test.ts
git commit -m "feat: add video frame tracking runtime"
```

### Task 2: Select one stable hand from array-shaped tracking output

**Files:**

- Create: `src/gesture/primaryHandSelector.ts`
- Test: `src/tests/primaryHandSelector.test.ts`

**Step 1: Write the failing tests**

```ts
import assert from "node:assert/strict";
import test from "node:test";

import { PrimaryHandSelector } from "../gesture/primaryHandSelector";
import type { HandFrame } from "../gesture/types";

function frame(
  handedness: HandFrame["handedness"],
  confidence: number,
  timestampMs: number,
): HandFrame {
  return { handedness, confidence, timestampMs, landmarks: [] };
}

test("selects the highest-confidence hand initially", () => {
  const selector = new PrimaryHandSelector();
  assert.equal(
    selector.select([frame("left", 0.7, 0), frame("right", 0.9, 0)])?.handedness,
    "right",
  );
});

test("holds the selected role through a small confidence crossover", () => {
  const selector = new PrimaryHandSelector({ switchMargin: 0.12, holdMs: 300 });
  selector.select([frame("left", 0.78, 0), frame("right", 0.9, 0)]);
  assert.equal(
    selector.select([frame("left", 0.92, 100), frame("right", 0.88, 100)])?.handedness,
    "right",
  );
});
```

**Step 2: Run the test to verify it fails**

Run: `pnpm test -- src/tests/primaryHandSelector.test.ts`

Expected: FAIL because the selector module does not exist.

**Step 3: Implement role-hold hysteresis**

Implement `PrimaryHandSelector` with:

- default `switchMargin: 0.12`
- default `holdMs: 300`
- highest confidence for initial acquisition
- retain the same known handedness during the hold window
- switch only when the competing hand clears the margin after the hold window
- confidence fallback for `unknown` handedness
- `reset()` for camera restarts

Add tests for empty input and hand loss after the hold window.

**Step 4: Run tests**

Run:

```bash
pnpm test -- src/tests/primaryHandSelector.test.ts
pnpm test
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/gesture/primaryHandSelector.ts src/tests/primaryHandSelector.test.ts
git commit -m "feat: select a stable primary hand"
```

### Task 3: Move hand tracking onto fresh camera frames

**Files:**

- Modify: `src/gesture/types.ts`
- Modify: `src/gesture/handTracker.ts`
- Modify: `src/app.ts`
- Test: `src/tests/videoFrameRuntime.test.ts`
- Test: `src/tests/primaryHandSelector.test.ts`

**Step 1: Add tracking result types**

```ts
export type TrackingDiagnostics = {
  delegate: "GPU" | "CPU";
  inferenceMs: number;
  trackingHz: number;
};

export type HandTrackingSnapshot = {
  timestampMs: number;
  hands: HandFrame[];
  diagnostics: TrackingDiagnostics;
};
```

The public tracker result remains array-shaped even while `numHands: 1`, so the future left-hand role does not require another contract migration.

**Step 2: Refactor `HandTracker`**

Make these exact behavioral changes:

- request `640x480` ideal camera capture and `frameRate: { ideal: 60, min: 30 }`
- call `HandLandmarker.createFromOptions` through `createWithDelegateFallback`
- set `baseOptions.delegate` to the attempted delegate
- keep `numHands: 1` in this release
- expose `start(video, onSnapshot)` and schedule inference with `requestVideoFrameCallback`
- use `video.currentTime` plus `VideoFrameGate` when the callback API is unavailable
- return every mapped hand in `HandTrackingSnapshot.hands`
- calculate rolling `inferenceMs` and `trackingHz`
- cancel the active callback and reset the gate in `dispose()`

Timestamp `detectForVideo` with `metadata.mediaTime * 1000` when available. Do not run inference twice for the same media time.

**Step 3: Refactor `app.ts`**

Remove `const CAMERA_INTERVAL_MS = 1000 / 28;` and render-loop polling of `tracker.detect`. Store the newest `HandTrackingSnapshot` from the callback, select its primary hand with `PrimaryHandSelector`, and let the animation loop only consume that latest frame.

Keep mouse rehearsal mode independent from camera callbacks.

**Step 4: Run verification**

Run:

```bash
pnpm test
pnpm build
```

Expected: tests pass and TypeScript/Vite build succeeds.

**Step 5: Commit**

```bash
git add src/gesture/types.ts src/gesture/handTracker.ts src/app.ts src/tests
git commit -m "feat: reduce camera tracking latency"
```

### Task 4: Make bow smoothing adaptive to motion speed

**Files:**

- Modify: `src/gesture/bowingGestureInterpreter.ts`
- Test: `src/tests/bowingGestureInterpreter.test.ts`

**Step 1: Add failing responsiveness tests**

Add tests that feed deterministic timestamped wrist positions and assert:

```ts
test("follows a fast direction reversal within two frames", () => {
  // Feed a steady rightward stroke, then two sharply leftward frames.
  // Assert the second reversal frame reports direction -1.
});

test("suppresses stationary landmark jitter", () => {
  // Feed alternating sub-threshold x movement around one point.
  // Assert bowing remains false and pitch drift stays bounded.
});
```

Use the existing frame builder instead of adding browser dependencies to the test.

**Step 2: Run the test to verify it fails**

Run: `pnpm test -- src/tests/bowingGestureInterpreter.test.ts`

Expected: the fast reversal assertion fails with the current fixed smoothing constant.

**Step 3: Implement adaptive smoothing**

Replace the fixed smoothing response with a speed-dependent time constant:

```ts
type AdaptiveSmoothingOptions = {
  slowTauSeconds: number;
  fastTauSeconds: number;
  fastResponseSpeed: number;
};
```

Defaults:

- `slowTauSeconds: 0.06`
- `fastTauSeconds: 0.012`
- `fastResponseSpeed: 0.7`

Interpolate the time constant from slow to fast as normalized horizontal speed approaches `fastResponseSpeed`; derive frame-rate-independent alpha with `1 - Math.exp(-dt / tau)`. Retain existing activation/deactivation hysteresis.

**Step 4: Run tests and build**

Run:

```bash
pnpm test -- src/tests/bowingGestureInterpreter.test.ts
pnpm test
pnpm build
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/gesture/bowingGestureInterpreter.ts src/tests/bowingGestureInterpreter.test.ts
git commit -m "feat: make bow tracking more responsive"
```

### Task 5: Stage the live camera and move the violin to the right

**Files:**

- Create: `src/scene/stagePlacement.ts`
- Test: `src/tests/stagePlacement.test.ts`
- Modify: `src/scene/violinScene.ts`
- Modify: `src/app.ts`
- Modify: `src/styles.css`
- Modify: `index.html`

**Step 1: Write the failing placement test**

```ts
import assert from "node:assert/strict";
import test from "node:test";

import { mapStagePlacement } from "../scene/stagePlacement";

test("keeps the violin on the right at desktop aspect ratios", () => {
  assert.deepEqual(mapStagePlacement(16 / 9), {
    x: 1.72,
    y: -0.38,
    scale: 0.84,
  });
});

test("keeps the instrument visible on portrait screens", () => {
  assert.deepEqual(mapStagePlacement(9 / 16), {
    x: 1.15,
    y: -0.62,
    scale: 0.68,
  });
});

test("uses the middle composition at tablet ratios", () => {
  assert.deepEqual(mapStagePlacement(4 / 3), {
    x: 1.35,
    y: -0.48,
    scale: 0.76,
  });
});
```

**Step 2: Run the test to verify it fails**

Run: `pnpm test -- src/tests/stagePlacement.test.ts`

Expected: FAIL because the module does not exist.

**Step 3: Implement and connect stage placement**

Implement `mapStagePlacement(aspect)` as a pure three-breakpoint mapping. Add a `setStagePlacement` method to `ViolinScene` and call it initially and on resize.

Preserve the current model geometry and bow transforms. Only move the parent instrument group.

**Step 4: Rebuild the page layers**

Make the DOM stack, back to front:

1. `video.camera-stage`
2. dark readability scrim and warm radial lighting
3. Three.js scene canvas
4. orbit and progress SVG layers
5. compact status/control HUD

The camera must be full-viewport, `object-fit: cover`, and mirrored with `transform: scaleX(-1)`. It is visible in camera mode and replaced by the existing dark fallback in mouse rehearsal mode, camera-denied state, and demo state.

Keep the left-center region visually quieter so the performer is not covered. Remove the small picture-in-picture camera card.

**Step 5: Add responsive CSS**

At desktop widths, reserve the right half for the violin and orbit. At portrait widths, keep the violin on the right but reduce scale and move nonessential copy below the primary hit zone. Use `pointer-events: none` for visual layers and restore pointer events only on controls.

**Step 6: Run verification**

Run:

```bash
pnpm test -- src/tests/stagePlacement.test.ts
pnpm test
pnpm build
```

Expected: PASS with no TypeScript or CSS build errors.

**Step 7: Commit**

```bash
git add index.html src/app.ts src/styles.css src/scene src/tests/stagePlacement.test.ts
git commit -m "feat: stage the violin over live camera"
```

### Task 6: Model orbital note timing and measure progress

**Files:**

- Create: `src/ui/orbitRhythmModel.ts`
- Test: `src/tests/orbitRhythmModel.test.ts`

**Step 1: Write failing orbit tests**

```ts
import assert from "node:assert/strict";
import test from "node:test";

import {
  buildMeasureOverview,
  buildOrbitCues,
} from "../ui/orbitRhythmModel";

test("places the current note at the hit angle", () => {
  const song = makeSong([
    { midi: 64, startBeat: 4, durationBeats: 1, dynamic: 0.7, phrase: 0 },
  ]);
  const [cue] = buildOrbitCues(song, 4);
  assert.equal(cue.angleDeg, 214);
  assert.equal(cue.sweepDeg, 38);
  assert.equal(cue.state, "current");
});

test("encodes note duration and alternating bow direction", () => {
  const song = makeSong([
    { midi: 64, startBeat: 4, durationBeats: 0.5, dynamic: 0.7, phrase: 0 },
    { midi: 67, startBeat: 5, durationBeats: 2, dynamic: 0.8, phrase: 0 },
  ]);
  const cues = buildOrbitCues(song, 4);
  assert.equal(cues[0]?.expectedDirection, 1);
  assert.equal(cues[1]?.expectedDirection, -1);
  assert.ok((cues[1]?.sweepDeg ?? 0) > (cues[0]?.sweepDeg ?? 0));
});

test("reports measure and phrase progress", () => {
  const overview = buildMeasureOverview({
    currentBeat: 17,
    totalBeats: 48,
    beatsPerBar: 4,
    phraseBeats: 16,
  });
  assert.equal(overview.currentMeasure, 5);
  assert.equal(overview.totalMeasures, 12);
  assert.equal(overview.currentPhrase, 2);
});
```

Create a local `makeSong` fixture matching the actual `SongDefinition` type.

**Step 2: Run the test to verify it fails**

Run: `pnpm test -- src/tests/orbitRhythmModel.test.ts`

Expected: FAIL because the model does not exist.

**Step 3: Implement the pure orbit model**

Use these constants:

```ts
const HIT_ANGLE_DEG = 214;
const DEGREES_PER_BEAT = 38;
const LOOKAHEAD_BEATS = 6;
const HISTORY_BEATS = 0.75;
const MIN_SWEEP_DEG = 7;
const MAX_SWEEP_DEG = 48;
```

For each visible melody event, return:

```ts
type OrbitCue = {
  id: string;
  angleDeg: number;
  sweepDeg: number;
  midi: number;
  noteName: string;
  expectedDirection: -1 | 1;
  state: "past" | "current" | "upcoming";
  beatDistance: number;
};
```

Clamp duration sweep to 7-48 degrees. Use stable event IDs derived from song ID and event index, not timestamps. `buildMeasureOverview` exposes current/total beat, measure, and phrase values without DOM assumptions.

**Step 4: Add boundary tests**

Cover no event in the visible window, a note crossing the current beat, a final partial measure, and durations below/above the sweep clamps.

**Step 5: Run tests**

Run:

```bash
pnpm test -- src/tests/orbitRhythmModel.test.ts
pnpm test
```

Expected: PASS.

**Step 6: Commit**

```bash
git add src/ui/orbitRhythmModel.ts src/tests/orbitRhythmModel.test.ts
git commit -m "feat: model an orbital bow rhythm"
```

### Task 7: Render the C2 orbital performance HUD

**Files:**

- Modify: `index.html`
- Modify: `src/app.ts`
- Modify: `src/styles.css`
- Create: `src/ui/orbitRhythmView.ts`
- Test: `src/tests/orbitRhythmView.test.ts`

**Step 1: Write a failing SVG view test**

Test the serialization-safe view helper without jsdom:

```ts
import assert from "node:assert/strict";
import test from "node:test";

import { orbitCueAttributes } from "../ui/orbitRhythmView";

test("maps a cue to a direction-aware SVG arc", () => {
  const attributes = orbitCueAttributes({
    id: "ode-4",
    angleDeg: 214,
    sweepDeg: 38,
    midi: 64,
    noteName: "E4",
    expectedDirection: -1,
    state: "current",
    beatDistance: 0,
  });

  assert.equal(attributes.pathLength, 360);
  assert.equal(attributes.dasharray, "38 322");
  assert.match(attributes.className, /direction-left/);
  assert.match(attributes.className, /is-current/);
});
```

**Step 2: Run the test to verify it fails**

Run: `pnpm test -- src/tests/orbitRhythmView.test.ts`

Expected: FAIL because the view module does not exist.

**Step 3: Implement the SVG mapping helper**

Keep arc calculations pure. Use a normalized circular path with `pathLength="360"`; expose `stroke-dasharray`, rotation, label position, and state classes as strings/numbers.

**Step 4: Add the performance HUD markup**

Add stable hooks:

```html
<svg id="rhythm-orbit" aria-label="Upcoming notes">
  <g id="orbit-cues"></g>
  <g id="orbit-hit-zone"></g>
</svg>
<div id="measure-overview" aria-live="polite"></div>
```

The hit zone sits at the lower-left edge of the right-side orbit, not across the violin body. Render note labels only for the current and nearest upcoming cues. Direction must be legible through both arrow shape and color/brightness, so it does not rely on color alone.

**Step 5: Connect animation updates**

In `app.ts`:

- build cues from the current song beat
- update existing keyed SVG nodes instead of replacing `innerHTML` every frame
- update cue transforms and state classes
- update measure overview only when its displayed values change
- keep the existing score and bow feedback, but demote them to compact HUD elements

**Step 6: Style the approved C2 layout**

Implement the full-screen mirrored camera, performer-safe left-center area, violin and warm orbit on the right, translucent scrims behind text only, fading upcoming arcs, and a slim bottom measure rail with measure ticks and phrase grouping.

Avoid continuous blur filters on the video and canvas; use gradients and solid alpha layers to protect frame rate. Keep a dark graceful fallback when camera access is unavailable.

**Step 7: Run tests and build**

Run:

```bash
pnpm test -- src/tests/orbitRhythmView.test.ts
pnpm test
pnpm build
```

Expected: PASS.

**Step 8: Commit**

```bash
git add index.html src/app.ts src/styles.css src/ui src/tests/orbitRhythmView.test.ts
git commit -m "feat: render the live orbital violin stage"
```

### Task 8: Make score provenance part of every song definition

**Files:**

- Modify: `src/music/songTypes.ts`
- Modify: `src/music/songValidation.ts`
- Modify: `src/music/songs/odeToJoy.ts`
- Modify: `src/music/songs/canonInD.ts`
- Modify: song fixtures under `src/tests/*.test.ts`
- Test: `src/tests/songCatalogue.test.ts`

**Step 1: Write failing provenance validation tests**

Add assertions that a catalogue song fails validation when its source URL, license, source filename, track, beat range, hash, or transformation notes are missing.

Use these types in the test:

```ts
export type SongSource = {
  url: string;
  license: "Public Domain" | "CC BY 3.0";
  sourceFile: string;
  sourceTrack: number;
  sourceBeats: readonly [number, number];
  sha256: string;
};

export type SongArrangement = {
  kind: "tutorial-excerpt";
  transposeSemitones: number;
  melodyStrategy: "skyline" | "monophonic-track";
  transformations: string[];
};
```

**Step 2: Run the test to verify it fails**

Run: `pnpm test -- src/tests/songCatalogue.test.ts`

Expected: FAIL because `SongDefinition` has no provenance fields and validation does not check them.

**Step 3: Extend the song contract**

Add `source: SongSource` and `arrangement: SongArrangement` to `SongDefinition`. Update existing test fixtures with explicit local test provenance rather than weakening the production type with optional fields.

Validation must require:

- an HTTPS source URL
- a 64-character hexadecimal SHA-256
- `sourceBeats[1] > sourceBeats[0] >= 0`
- nonempty `sourceFile`
- a nonnegative integer `sourceTrack`
- at least one human-readable transformation statement

**Step 4: Add the two exact source records**

Ode to Joy:

```ts
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
```

Canon in D:

```ts
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
```

**Step 5: Run tests and build**

Run:

```bash
pnpm test
pnpm build
```

Expected: PASS after all strongly typed fixtures are updated.

**Step 6: Commit**

```bash
git add src/music src/tests
git commit -m "feat: track song score provenance"
```

### Task 9: Build the deterministic Node-only MIDI importer

**Files:**

- Create: `music-sources/mutopia/Beethoven-Ode-to-Joy-Mutopia-PD.mid`
- Create: `music-sources/mutopia/Pachelbel-Canon-in-D-Mutopia-CC-BY-3.0.mid`
- Create: `music-sources/README.md`
- Create: `music-sources/manifest.json`
- Create: `scripts/lib/midiImporter.ts`
- Create: `scripts/import-midi.ts`
- Create: `src/music/generated/odeToJoyMelody.ts`
- Create: `src/music/generated/canonInDMelody.ts`
- Create: `src/tests/midiImporter.test.ts`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

**Step 1: Copy and verify the licensed source files**

Copy from the reviewed collection:

```powershell
Copy-Item -LiteralPath "D:\工作资料收集\配乐收集\曲谱收集\精选曲目\Beethoven-Ode-to-Joy-Mutopia-PD.mid" -Destination "music-sources\mutopia\Beethoven-Ode-to-Joy-Mutopia-PD.mid"
Copy-Item -LiteralPath "D:\工作资料收集\配乐收集\曲谱收集\精选曲目\Pachelbel-Canon-in-D-Mutopia-CC-BY-3.0.mid" -Destination "music-sources\mutopia\Pachelbel-Canon-in-D-Mutopia-CC-BY-3.0.mid"
Get-FileHash -Algorithm SHA256 music-sources\mutopia\*.mid
```

Expected hashes are the two values recorded in Task 8. Abort import if either hash differs.

Document Mutopia page URLs, authorship, license, filename, and the Canon attribution requirement in `music-sources/README.md`.

**Step 2: Add the parser dependency and import script**

Run:

```bash
pnpm add -D @tonejs/midi@2.0.28
```

Add:

```json
{
  "scripts": {
    "music:import": "tsx scripts/import-midi.ts"
  }
}
```

Keep `@tonejs/midi` out of browser imports. Only files under `scripts/` and importer tests may import it.

**Step 3: Write the manifest**

```json
{
  "version": 1,
  "pieces": [
    {
      "songId": "ode-to-joy",
      "input": "music-sources/mutopia/Beethoven-Ode-to-Joy-Mutopia-PD.mid",
      "output": "src/music/generated/odeToJoyMelody.ts",
      "sourceTrack": 1,
      "sourceBeats": [0, 48],
      "transposeSemitones": -7,
      "melodyStrategy": "skyline",
      "phraseBeats": 16,
      "sha256": "fb1604c08c865b275b464d74e5a7c526ff1a8acccdf9853cb92f0778daaed14b"
    },
    {
      "songId": "canon-in-d",
      "input": "music-sources/mutopia/Pachelbel-Canon-in-D-Mutopia-CC-BY-3.0.mid",
      "output": "src/music/generated/canonInDMelody.ts",
      "sourceTrack": 1,
      "sourceBeats": [0, 80],
      "transposeSemitones": 0,
      "melodyStrategy": "monophonic-track",
      "phraseBeats": 16,
      "sha256": "1358ba0799aeb727be0ef155fc9090ea55762a3b41f85d3dbb02918f4ac66515"
    }
  ]
}
```

**Step 4: Write failing importer tests**

```ts
import assert from "node:assert/strict";
import test from "node:test";

import {
  extractMonophonicTrack,
  extractSkyline,
  quantizeBeat,
} from "../../scripts/lib/midiImporter";

test("quantizes to eighth-beat boundaries", () => {
  assert.equal(quantizeBeat(1.24), 1);
  assert.equal(quantizeBeat(1.26), 1.5);
});

test("skyline chooses the highest pitch in each active interval", () => {
  const notes = [
    { midi: 60, startBeat: 0, durationBeats: 2, velocity: 0.7 },
    { midi: 67, startBeat: 1, durationBeats: 1, velocity: 0.8 },
  ];
  assert.deepEqual(extractSkyline(notes), [
    { midi: 60, startBeat: 0, durationBeats: 1, dynamic: 0.7 },
    { midi: 67, startBeat: 1, durationBeats: 1, dynamic: 0.8 },
  ]);
});

test("monophonic extraction rejects overlaps", () => {
  assert.throws(
    () => extractMonophonicTrack([
      { midi: 60, startBeat: 0, durationBeats: 2, velocity: 0.7 },
      { midi: 62, startBeat: 1, durationBeats: 1, velocity: 0.7 },
    ]),
    /overlap/i,
  );
});
```

**Step 5: Run the importer test to verify it fails**

Run: `pnpm test -- src/tests/midiImporter.test.ts`

Expected: FAIL because the importer module does not exist.

**Step 6: Implement extraction and deterministic generation**

In `scripts/lib/midiImporter.ts`:

- parse with `new Midi(bytes)`
- verify SHA-256 before parsing
- select the configured SMF track
- convert ticks to beats using `midi.header.ppq`
- clip to the half-open `sourceBeats` range
- quantize start/end boundaries to 0.5 beat
- for `skyline`, split at every note start/end boundary and choose the highest active MIDI pitch in each interval
- for `monophonic-track`, reject overlapping intervals
- merge adjacent equal pitches
- apply transposition after extraction
- derive `phrase: Math.floor(startBeat / phraseBeats)`
- clamp velocity into `dynamic: 0..1`
- serialize stable TypeScript with fixed key order, integer MIDI, and at most three decimal places

The CLI reads the manifest, writes both generated modules, and prints source hash, track, note count, and beat range. No timestamps or absolute paths may appear in generated files.

**Step 7: Add real-source assertions**

After the pure tests pass, assert:

- Ode begins with MIDI `[64, 64, 65, 67, 67, 65, 64]`
- Canon begins with MIDI `[74, 73, 71, 69, 67, 66, 67, 71]`
- every event is ordered, nonoverlapping, in range, and on an eighth-beat boundary
- a second importer run produces byte-identical output

**Step 8: Run importer verification**

Run:

```bash
pnpm music:import
pnpm test -- src/tests/midiImporter.test.ts
pnpm music:import
git diff --exit-code -- src/music/generated
pnpm test
```

Expected: all commands PASS and the deterministic diff is empty.

**Step 9: Commit**

```bash
git add package.json pnpm-lock.yaml music-sources scripts src/music/generated src/tests/midiImporter.test.ts
git commit -m "feat: import licensed midi scores"
```

### Task 10: Drive guided songs from generated MIDI melodies

**Files:**

- Modify: `src/music/songs/odeToJoy.ts`
- Modify: `src/music/songs/canonInD.ts`
- Modify: `src/tests/songCatalogue.test.ts`
- Modify: `src/tests/guidedSongEngine.test.ts`
- Modify: `src/tests/guidedPerformance.test.ts`

**Step 1: Write failing catalogue assertions**

Add:

```ts
test("uses the imported Ode to Joy melody", () => {
  assert.deepEqual(
    ODE_TO_JOY.melody.slice(0, 7).map((note) => note.midi),
    [64, 64, 65, 67, 67, 65, 64],
  );
  assert.equal(ODE_TO_JOY.source.license, "Public Domain");
  assert.equal(ODE_TO_JOY.arrangement.melodyStrategy, "skyline");
});

test("uses the imported Canon melody", () => {
  assert.deepEqual(
    CANON_IN_D.melody.slice(0, 8).map((note) => note.midi),
    [74, 73, 71, 69, 67, 66, 67, 71],
  );
  assert.equal(CANON_IN_D.source.license, "CC BY 3.0");
  assert.equal(CANON_IN_D.arrangement.melodyStrategy, "monophonic-track");
});
```

Also assert each song's `pitchLanes` equals the sorted unique MIDI values in its generated melody and `validateSong(song)` returns no errors.

**Step 2: Run the catalogue test to verify it fails**

Run: `pnpm test -- src/tests/songCatalogue.test.ts`

Expected: FAIL because the handwritten melodies are still connected.

**Step 3: Replace handwritten melody construction**

Import the generated arrays:

```ts
import { ODE_TO_JOY_MELODY } from "../generated/odeToJoyMelody";
import { CANON_IN_D_MELODY } from "../generated/canonInDMelody";
```

Use them directly as `melody`. Derive `pitchLanes` with a shared pure helper or checked generated metadata, and retain the existing accompaniment arrays. Remove now-unused handwritten melody constants/functions.

Do not silently call the result a complete urtext edition: UI/source copy must identify each as a tutorial excerpt and make the transformation notes accessible.

**Step 4: Update engine fixtures only where timings changed**

Run focused engine tests, inspect failures, and update only assertions whose expected note boundaries legitimately changed with the source MIDI. Do not relax timing tolerances to hide importer errors.

Run:

```bash
pnpm test -- src/tests/guidedSongEngine.test.ts
pnpm test -- src/tests/guidedPerformance.test.ts
pnpm test -- src/tests/songCatalogue.test.ts
```

Expected: PASS.

**Step 5: Run full verification**

Run:

```bash
pnpm music:import
git diff --exit-code -- src/music/generated
pnpm test
pnpm build
```

Expected: deterministic import, all tests passing, successful production build.

**Step 6: Commit**

```bash
git add src/music src/tests
git commit -m "feat: drive guided songs from source midi"
```

### Task 11: Verify the experience, document it, and prepare deployment

**Files:**

- Modify: `README.md`
- Create: `docs/verification/2026-07-21-camera-stage-midi-latency.md`
- Modify if required by deployment: `netlify.toml`
- Modify only for discovered defects: implementation/test files from Tasks 1-10

**Step 1: Run automated release checks**

Run:

```bash
pnpm music:import
git diff --exit-code -- src/music/generated
pnpm test
pnpm build
git diff --check
```

Expected: every command exits 0.

**Step 2: Start the production-like preview**

Run:

```bash
pnpm dev -- --host 127.0.0.1
```

Open the reported local URL. Verify these viewport sizes:

- `2048x1055`: target exhibition screenshot composition
- `1440x900`: common laptop
- `390x844`: portrait mobile fallback

Record screenshots and findings in the verification document.

**Step 3: Verify real camera behavior**

With camera permission granted:

- video fills and mirrors the viewport
- the performer can stand left-center without UI covering the face/torso
- violin and orbit remain on the right
- each camera frame is inferred at most once
- diagnostics show whether GPU or CPU is active
- `trackingHz` is stable and no fixed 28 Hz polling remains
- bow direction reverses without visible multi-frame lag
- stationary jitter does not trigger bowing
- switching to mouse rehearsal mode stops the camera and shows the dark fallback

Force or simulate GPU creation failure once and confirm CPU fallback works.

**Step 4: Verify guided music and orbital UI**

For both songs:

- source/license details match the checked-in manifest
- first notes match the importer assertions
- arc angle approaches the hit zone as transport beat advances
- arc length reflects duration
- arrow/shape and styling both communicate bow direction
- measure and phrase progress remain correct at the final beat
- pause/resume and song switching do not leave stale SVG cues
- audio, score, and rhythm judgments still function

**Step 5: Document the operational workflow**

Update `README.md` with:

- install, test, build, and dev commands
- `pnpm music:import`
- source/licensing locations
- camera requirements and mouse fallback
- GPU/CPU fallback behavior
- current single-hand role and future left-hand contract: pitch/string selection plus vibrato/expression, while guided mode keeps MIDI as the base pitch
- deployment command and rollback note

The verification document records browser/OS, viewport, delegate, observed tracking rate, camera result, screenshots, and unresolved issues.

**Step 6: Fix only evidence-backed defects**

If a check fails, use the `systematic-debugging` skill: reproduce, isolate the root cause, add/adjust a failing test, implement the smallest fix, and rerun the affected check plus the full suite. Create a focused commit for each defect.

**Step 7: Commit documentation**

```bash
git add README.md docs/verification netlify.toml
git commit -m "docs: verify camera stage and midi workflow"
```

Omit `netlify.toml` from `git add` if it did not change.

**Step 8: Push and deploy only with explicit approval**

First push the implementation branch:

```bash
git push origin feature/gesture-violin-mvp
```

Before a production deployment, show the user the local verification result and exact target site. After approval, run the existing Netlify production command, smoke-test the resulting HTTPS URL, and record the deployment URL/commit in the verification document.

**Step 9: Final completion check**

Run:

```bash
git status --short --branch
git log --oneline --decorate -12
```

Expected: a clean worktree, the feature branch tracking its remote, and all task commits visible. Report the remote branch, test/build results, source licenses, camera delegate/fallback result, and deployment status.

---

## Plan self-review checklist

Before execution begins, confirm:

- every approved design area maps to a task: camera stage, right-side violin, orbit rhythm, measure overview, lower-latency tracking, MIDI provenance/import, and future two-hand contract
- browser code never imports `@tonejs/midi`
- tracking stays `numHands: 1` while output remains array-shaped
- `SongDefinition`, generated melody, importer output, orbit model, and test fixtures use `midi`, `startBeat`, and `durationBeats` consistently
- CSS references use `src/styles.css`
- no placeholders, absolute developer paths, timestamps, or non-deterministic values enter generated source
- Canon attribution remains visible wherever score provenance is shown
- production deployment is not performed without explicit user approval
