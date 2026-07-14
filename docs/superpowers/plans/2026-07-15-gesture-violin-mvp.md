# Gesture Violin MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and deploy a browser-based violin experience where one camera-tracked hand selects pitch vertically and bows horizontally to animate an original procedural 3D violin and produce expressive string-like audio.

**Architecture:** A MediaPipe adapter converts one mirrored hand into normalized landmarks. A pure `BowingGestureInterpreter` derives position, pitch, horizontal speed, direction, and bowing state; both camera and rehearsal mouse modes feed the same `BowingFrame`. The renderer and audio engine consume that frame independently, keeping tracking, music, visuals, and UI replaceable.

**Tech Stack:** TypeScript, Vite, Three.js, MediaPipe Tasks Vision, Web Audio API, Node test runner with tsx, Netlify.

---

## File Structure

- `src/gesture/types.ts`: shared landmark, hand, and bowing-frame types.
- `src/gesture/bowingGestureInterpreter.ts`: pure one-hand mapping, smoothing, speed hysteresis, stale release.
- `src/gesture/handTracker.ts`: camera permission, MediaPipe initialization, and mirrored landmark conversion.
- `src/gesture/mouseRehearsalSource.ts`: pointer fallback that emits the same hand-independent control shape.
- `src/music/scale.ts`: vertical-position to note mapping.
- `src/music/performanceModel.ts`: converts bowing frames into note, intensity, brightness, and animation state.
- `src/audio/stringSynth.ts`: Web Audio string-like voice with bow noise, oscillators, filter, envelope, and reverb.
- `src/scene/violinScene.ts`: procedural Three.js violin, bow, strings, lighting, and frame-driven animation.
- `src/ui/appView.ts`: semantic HTML shell, onboarding, camera preview, status, note ladder, and controls.
- `src/app.ts`: runtime orchestration and lifecycle.
- `src/styles.css`: concert-workshop visual system and responsive layout.
- `src/tests/*.test.ts`: pure behavior tests for gesture and performance mapping.
- `public/vendor/`: local MediaPipe WASM and hand model copied from the already-verified local prototype.

## Task 1: Project Scaffold And Test Harness

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `index.html`
- Create: `.gitignore`
- Create: `src/main.ts`
- Test: `src/tests/smoke.test.ts`

- [ ] **Step 1: Write the failing smoke test**

```ts
import assert from "node:assert/strict";
import test from "node:test";

test("test runner is active", () => {
  assert.equal(typeof document, "undefined");
});
```

- [ ] **Step 2: Run it before dependencies exist**

Run: `pnpm test`

Expected: FAIL because the package scripts and tsx runner do not exist.

- [ ] **Step 3: Add Vite, TypeScript, Three.js, MediaPipe, and test scripts**

Use scripts `dev`, `build`, `test`, and `preview`; keep the app framework-free.

- [ ] **Step 4: Install and verify**

Run: `pnpm install && pnpm test`

Expected: one passing smoke test.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "chore: scaffold gesture violin MVP"
```

## Task 2: Bowing Gesture Interpreter

**Files:**
- Create: `src/gesture/types.ts`
- Create: `src/gesture/bowingGestureInterpreter.ts`
- Test: `src/tests/bowingGestureInterpreter.test.ts`

- [ ] **Step 1: Write failing tests for the desired interaction**

Create these concrete tests using synthetic 21-point hand fixtures and `assert.equal` / `assert.ok` assertions:

```ts
test("vertical palm position selects pitch while horizontal position tracks the bow", () => {
  const frame = interpreter.update(handAt(0.8, 0.2, 1000));
  assert.ok(frame.x > 0.75);
  assert.ok(frame.pitch > 0.75);
});
test("fast horizontal motion starts bowing and maps speed to intensity", () => {
  interpreter.update(handAt(0.2, 0.5, 1000));
  const frame = interpreter.update(handAt(0.7, 0.5, 1100));
  assert.equal(frame.bowing, true);
  assert.ok(frame.intensity > 0.5);
});
test("vertical-only movement does not start a bow stroke", () => {
  interpreter.update(handAt(0.5, 0.8, 1000));
  assert.equal(interpreter.update(handAt(0.5, 0.2, 1100)).bowing, false);
});
test("bowing stops after movement falls below the release threshold", () => {
  interpreter.update(handAt(0.2, 0.5, 1000));
  interpreter.update(handAt(0.7, 0.5, 1100));
  assert.equal(interpreter.update(handAt(0.701, 0.5, 1300)).bowing, false);
});
test("missing or low-confidence hands release immediately", () => {
  assert.equal(interpreter.update(null, 1200).active, false);
});
test("camera coordinates are stable after exponential smoothing", () => {
  const frame = interpreter.update(handAt(1, 0.5, 1016));
  assert.ok(frame.x > 0.5 && frame.x < 1);
});
```

- [ ] **Step 2: Verify RED**

Run: `pnpm test -- src/tests/bowingGestureInterpreter.test.ts`

Expected: FAIL because the interpreter module does not exist.

- [ ] **Step 3: Implement the pure frame model**

Define:

```ts
export type BowingFrame = {
  timestampMs: number;
  active: boolean;
  bowing: boolean;
  x: number;
  pitch: number;
  horizontalSpeed: number;
  intensity: number;
  direction: -1 | 0 | 1;
  confidence: number;
};
```

Use a palm center averaged from landmarks `0`, `5`, `9`, and `17`. Use only horizontal delta for bow speed, start/release hysteresis, and clamp every normalized field to `0..1`.

- [ ] **Step 4: Verify GREEN**

Run: `pnpm test -- src/tests/bowingGestureInterpreter.test.ts`

Expected: all interpreter tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/gesture src/tests/bowingGestureInterpreter.test.ts
git commit -m "feat: interpret one-hand violin bowing"
```

## Task 3: Musical Performance Mapping

**Files:**
- Create: `src/music/scale.ts`
- Create: `src/music/performanceModel.ts`
- Test: `src/tests/performanceModel.test.ts`

- [ ] **Step 1: Write failing musical tests**

Create these tests with actual `BowingFrame` fixtures:

```ts
test("higher hand positions select higher notes", () => {
  assert.ok(mapPerformance(frame({ pitch: 1 })).midi > mapPerformance(frame({ pitch: 0 })).midi);
});
test("all selected notes belong to the friendly C-major pentatonic range", () => {
  assert.ok([60, 62, 64, 67, 69, 72, 74, 76].includes(mapPerformance(frame({ pitch: 0.52 })).midi));
});
test("stationary hands produce silence while preserving the selected note", () => {
  const state = mapPerformance(frame({ bowing: false, pitch: 0.5 }));
  assert.equal(state.voiceActive, false);
  assert.ok(state.frequencyHz > 0);
});
test("faster bowing increases intensity and brightness", () => {
  assert.ok(mapPerformance(frame({ intensity: 0.9 })).brightness > mapPerformance(frame({ intensity: 0.2 })).brightness);
});
test("lost tracking releases the voice", () => {
  assert.equal(mapPerformance(frame({ active: false })).voiceActive, false);
});
```

- [ ] **Step 2: Verify RED**

Run: `pnpm test -- src/tests/performanceModel.test.ts`

Expected: FAIL because performance modules do not exist.

- [ ] **Step 3: Implement a forgiving scale and performance state**

Use MIDI notes `[60, 62, 64, 67, 69, 72, 74, 76]`, with the top of the camera mapped to the last note. Return note name, frequency, intensity, brightness, direction, and voice-active state.

- [ ] **Step 4: Verify GREEN and full regression**

Run: `pnpm test`

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/music src/tests/performanceModel.test.ts
git commit -m "feat: map bowing into playable violin notes"
```

## Task 4: Camera Tracking And Rehearsal Input

**Files:**
- Create: `src/gesture/handTracker.ts`
- Create: `src/gesture/mouseRehearsalSource.ts`
- Copy: `public/vendor/tasks-vision/wasm/*`
- Copy: `public/vendor/mediapipe-models/hand_landmarker.task`

- [ ] **Step 1: Add local MediaPipe assets from the verified prototype**

Copy the known-working WASM variants and `hand_landmarker.task`, preserving paths expected by the tracker.

- [ ] **Step 2: Implement `HandTracker`**

Request a mirrored `1280x720` user-facing camera, initialize `HandLandmarker` in video mode for one hand, and convert results to `HandFrame[]`. Expose `start`, `detect`, and `stop`.

- [ ] **Step 3: Implement pointer rehearsal mode**

Pointer down/drag must emit normalized x/y and use horizontal speed to exercise the exact same interpreter and performance path without a camera.

- [ ] **Step 4: Type-check**

Run: `pnpm build`

Expected: TypeScript and Vite build successfully.

- [ ] **Step 5: Commit**

```bash
git add src/gesture public/vendor
git commit -m "feat: add camera and rehearsal input sources"
```

## Task 5: Original Procedural 3D Violin Scene

**Files:**
- Create: `src/scene/violinScene.ts`
- Create: `src/scene/sceneLayout.ts`
- Test: `src/tests/sceneLayout.test.ts`

- [ ] **Step 1: Write failing layout tests**

Use assertions such as `assert.equal(mapBowPose(0.5, 0.5, true).x, 0)`, mirrored low/high x checks, bounded contact-y checks, and `assert.equal(mapBowPose(0.9, 0.9, false).engaged, false)`.

- [ ] **Step 2: Verify RED**

Run: `pnpm test -- src/tests/sceneLayout.test.ts`

Expected: FAIL because scene layout functions do not exist.

- [ ] **Step 3: Implement layout math and procedural geometry**

Build an original stylized violin from rounded body lobes, waist, neck, scroll, bridge, four strings, chin rest, and an independently animated bow. Use warm lacquer materials, cream strings, one key light, one rim light, and subtle floating rosin particles. Do not use external 3D assets.

- [ ] **Step 4: Verify tests and build**

Run: `pnpm test && pnpm build`

Expected: tests and production build pass.

- [ ] **Step 5: Commit**

```bash
git add src/scene src/tests/sceneLayout.test.ts
git commit -m "feat: render an original procedural violin"
```

## Task 6: Expressive Browser String Synth

**Files:**
- Create: `src/audio/stringVoiceModel.ts`
- Create: `src/audio/stringSynth.ts`
- Test: `src/tests/stringVoiceModel.test.ts`

- [ ] **Step 1: Write failing pure voice-model tests**

Use exact assertions for zero inactive gain, monotonic intensity gain, unchanged requested frequency, and a `600..5200 Hz` filter-cutoff bound.

- [ ] **Step 2: Verify RED**

Run: `pnpm test -- src/tests/stringVoiceModel.test.ts`

Expected: FAIL because voice modules do not exist.

- [ ] **Step 3: Implement the model and Web Audio graph**

Use detuned saw/triangle oscillators, a quiet filtered noise source for bow texture, low-pass filtering, gain envelope, vibrato LFO, short delay, and convolver-free feedback ambience. Start/resume only from an explicit user action.

- [ ] **Step 4: Verify GREEN and build**

Run: `pnpm test && pnpm build`

Expected: tests and build pass.

- [ ] **Step 5: Commit**

```bash
git add src/audio src/tests/stringVoiceModel.test.ts
git commit -m "feat: synthesize responsive violin-like audio"
```

## Task 7: Concert-Workshop Interface And Runtime

**Files:**
- Create: `src/ui/appView.ts`
- Create: `src/app.ts`
- Create: `src/styles.css`
- Modify: `src/main.ts`
- Modify: `index.html`

- [ ] **Step 1: Build the semantic UI shell**

Create a start overlay, three-line gesture instruction, live note ladder, bow-speed meter, tracking status, mirrored camera thumbnail with landmark canvas, camera/rehearsal switch, audio mute, and retry/error states.

- [ ] **Step 2: Apply the visual direction**

Use a dark lacquered concert-workshop atmosphere: blackened umber background, ivory typography, amber instrument, vermilion bow accent, technical ruled lines, fine grain, asymmetric editorial layout, and responsive typography. Avoid generic cards and purple gradients.

- [ ] **Step 3: Wire the animation loop**

Each frame must detect the hand or read rehearsal input, update the interpreter, map performance, update synth, update scene, draw landmarks, and update low-frequency UI readouts. Stop camera and audio safely on page hide/unload.

- [ ] **Step 4: Add an automatic demo mode**

`?demo=1` must synthesize a moving control frame so hosted smoke tests can validate 3D and audio-state UI without camera permission. Demo mode must be visibly labeled and remain separate from the real camera path.

- [ ] **Step 5: Build and commit**

Run: `pnpm test && pnpm build`

Expected: tests and production build pass.

```bash
git add index.html src
git commit -m "feat: deliver the gesture violin experience"
```

## Task 8: Browser Verification And Deployment

**Files:**
- Create: `README.md`
- Create: `netlify.toml`
- Create: `verification/` screenshots if needed

- [ ] **Step 1: Run the production preview**

Run: `pnpm build && pnpm preview --host 127.0.0.1`

Expected: local URL loads the start screen with no console errors.

- [ ] **Step 2: Verify desktop behavior**

Check normal and `?demo=1` routes, start interaction, confirm note changes vertically, bow direction changes horizontally, stationary input becomes silent, 3D bow follows movement, camera denial exposes retry and rehearsal mode, and resizing preserves controls.

- [ ] **Step 3: Verify mobile layout**

At a narrow viewport confirm onboarding, note ladder, status, camera preview, and start controls remain reachable without horizontal scrolling.

- [ ] **Step 4: Document setup and known limitations**

README must describe HTTPS camera requirements, supported browsers, gesture rules, rehearsal mode, demo query, local commands, deployment, and the synthetic-audio limitation.

- [ ] **Step 5: Deploy and smoke-test the public URL**

Deploy `dist` to Netlify, open the HTTPS URL, verify the normal page and demo mode, then report the stable test link.

- [ ] **Step 6: Final verification and commit**

Run: `pnpm test && pnpm build && git status --short`

Expected: all tests pass, build exits zero, and only intended verification artifacts are present.

```bash
git add README.md netlify.toml verification
git commit -m "docs: verify and publish gesture violin MVP"
```
