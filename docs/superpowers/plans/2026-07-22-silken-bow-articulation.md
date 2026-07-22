# Silken Bow Articulation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent early guided bow reversals from replaying the previous note, soften the sampled violin voice, and restyle the camera-backed guided stage in the approved “Bow Hair Breathing” direction.

**Architecture:** Guided performance will carry the score-note index as an optional articulation identifier, allowing the sample voice to distinguish a preparatory direction reversal from a real note boundary while preserving free-mode direction attacks. The sample graph will apply bounded warm filtering and quieter generated bow noise. Existing Three.js and DOM components will retain their responsibilities while adopting a restrained varnish palette, bow-hair orbit, one-shot judgment pulse, and static reduced-motion fallback.

**Tech Stack:** TypeScript 7, Vite 8, native Web Audio API, Three.js 0.185, SVG/CSS, Node test runner with tsx, Netlify draft deploys.

---

## File Structure

- Modify `src/music/performanceModel.ts`: add the optional audio articulation identifier.
- Modify `src/music/guidedPerformance.ts`: derive the identifier from `GuidedSongFrame.currentNoteIndex`.
- Modify `src/audio/sampleVoiceModel.ts`: decide true guided/free articulation boundaries and expose tone constants.
- Modify `src/audio/sampledViolinVoice.ts`: carry the identifier and apply the warm sample signal path.
- Modify `src/scene/sceneLayout.ts`: make whole-instrument scale an explicit stable output.
- Modify `src/scene/violinScene.ts`: consume stable scale and update varnish, lighting, bow, string, particle, and halo materials.
- Modify `src/ui/guidedViewModel.ts`: expose a deterministic judgment pulse key.
- Modify `src/ui/guidedView.ts`: trigger the hit-zone breath once per new judgment.
- Modify `src/ui/appView.ts`: add the semantic hit-zone hook and replace the orbit gradient colors.
- Modify `src/styles.css`: implement the approved palette, light hierarchy, bow-hair orbit/progress, and reduced-motion treatment.
- Modify `src/tests/guidedPerformance.test.ts`, `src/tests/sampleVoiceModel.test.ts`, `src/tests/sceneLayout.test.ts`, and `src/tests/guidedViewModel.test.ts`: cover the behavior before implementation.
- Create `docs/verification/2026-07-22-silken-bow-stage.md`: record automated, browser, listening, deployment, and production-preservation evidence.

## Task 1: Bind guided sample attacks to score-note boundaries

**Files:**
- Modify: `src/music/performanceModel.ts`
- Modify: `src/music/guidedPerformance.ts`
- Modify: `src/audio/sampleVoiceModel.ts`
- Modify: `src/audio/sampledViolinVoice.ts`
- Test: `src/tests/guidedPerformance.test.ts`
- Test: `src/tests/sampleVoiceModel.test.ts`

- [ ] **Step 1: Write the failing guided-state test**

Add this assertion to the existing guided mapping coverage:

```ts
test("guided performance identifies the real score-note articulation", () => {
  const first = mapGuidedPerformance(bow({ direction: 1 }), guided({ currentNoteIndex: 4 }));
  const sameNoteEarlyReverse = mapGuidedPerformance(
    bow({ direction: -1 }),
    guided({ currentNoteIndex: 4 }),
  );

  assert.equal(first.articulationId, 4);
  assert.equal(sameNoteEarlyReverse.articulationId, 4);
});
```

- [ ] **Step 2: Write the failing articulation-boundary tests**

Extend `SampleVoiceFrame` fixtures to accept `articulationId` and add:

```ts
test("does not restart the previous guided note for an early reversal", () => {
  const previous = frame({ direction: 1, articulationId: 7 });
  const earlyReverse = frame({ direction: -1, articulationId: 7 });
  assert.equal(needsFreshBow(previous, earlyReverse), false);
});

test("restarts at a new guided note even when the pitch repeats", () => {
  const previous = frame({ midi: 64, articulationId: 7 });
  const repeatedPitch = frame({ midi: 64, articulationId: 8 });
  assert.equal(needsFreshBow(previous, repeatedPitch), true);
});

test("keeps direction articulation in free performance", () => {
  assert.equal(
    needsFreshBow(frame({ direction: 1 }), frame({ direction: -1 })),
    true,
  );
});
```

- [ ] **Step 3: Run the focused tests and verify the expected red state**

Run:

```powershell
node --import tsx --test src/tests/guidedPerformance.test.ts src/tests/sampleVoiceModel.test.ts
```

Expected: FAIL because `PerformanceState` and `SampleVoiceFrame` do not yet expose `articulationId`, and an early direction reversal still returns `true`.

- [ ] **Step 4: Add the optional articulation identifier and guided mapping**

Add the property to `PerformanceState`:

```ts
export type PerformanceState = {
  timestampMs: number;
  phase: PerformancePhase;
  voiceActive: boolean;
  midi: number;
  noteName: string;
  frequencyHz: number;
  intensity: number;
  brightness: number;
  bowX: number;
  pitch: number;
  horizontalSpeed: number;
  direction: -1 | 0 | 1;
  confidence: number;
  articulationId?: number;
};
```

Add this field to the object returned by `mapGuidedPerformance`:

```ts
articulationId: guided.currentNoteIndex,
```

Do not add it to `mapPerformance`; absence is the free-mode signal.

- [ ] **Step 5: Implement score-aware fresh-bow decisions**

Include `articulationId` in `SampleVoiceFrame` and replace the final direction-only decision in `needsFreshBow` with:

```ts
if (previous.midi !== next.midi) return true;
if (selectSampleRoot(previous.midi).rootMidi !== selectSampleRoot(next.midi).rootMidi) return true;

if (previous.articulationId !== undefined && next.articulationId !== undefined) {
  return previous.articulationId !== next.articulationId;
}

return previous.direction !== 0
  && next.direction !== 0
  && previous.direction !== next.direction;
```

Pass `state.articulationId` through `toSampleFrame` in `sampledViolinVoice.ts`. Keep inactive-to-active, pitch-change, continuation, and release behavior unchanged.

- [ ] **Step 6: Run focused and regression tests**

Run:

```powershell
node --import tsx --test src/tests/guidedPerformance.test.ts src/tests/sampleVoiceModel.test.ts src/tests/guidedSongEngine.test.ts
npm.cmd test
```

Expected: all tests PASS; guided early reversal is ignored as a sample restart, repeated guided pitch boundaries retrigger, and free-mode reversal still retriggers.

- [ ] **Step 7: Commit the isolated bug fix**

```powershell
git add src/music/performanceModel.ts src/music/guidedPerformance.ts src/audio/sampleVoiceModel.ts src/audio/sampledViolinVoice.ts src/tests/guidedPerformance.test.ts src/tests/sampleVoiceModel.test.ts
git commit -m "fix: bind guided bow attacks to score notes"
```

## Task 2: Make the sampled voice warmer and smoother

**Files:**
- Modify: `src/audio/sampleVoiceModel.ts`
- Modify: `src/audio/sampledViolinVoice.ts`
- Test: `src/tests/sampleVoiceModel.test.ts`

- [ ] **Step 1: Write failing tests for restrained tone bounds**

Import `SAMPLE_TONE`, `BOW_CROSSFADE_SECONDS`, and `RELEASE_SECONDS`, then add:

```ts
test("uses a restrained warm sample treatment", () => {
  assert.equal(SAMPLE_TONE.dryGain + SAMPLE_TONE.wetGain, 1);
  assert.ok(SAMPLE_TONE.bowNoiseScale <= 0.1);
  assert.ok(SAMPLE_TONE.presenceGainDb >= -3 && SAMPLE_TONE.presenceGainDb <= -1.5);
  assert.ok(SAMPLE_TONE.lowpassHz >= 6_000 && SAMPLE_TONE.lowpassHz <= 7_200);
  assert.ok(BOW_CROSSFADE_SECONDS >= 0.045 && BOW_CROSSFADE_SECONDS <= 0.06);
  assert.ok(RELEASE_SECONDS >= 0.13 && RELEASE_SECONDS <= 0.16);
});
```

- [ ] **Step 2: Run the focused test and observe the missing-export failure**

Run:

```powershell
node --import tsx --test src/tests/sampleVoiceModel.test.ts
```

Expected: FAIL because `SAMPLE_TONE` is not exported and the current crossfade/release values are too short.

- [ ] **Step 3: Add exact, bounded tone constants**

In `sampleVoiceModel.ts`, set:

```ts
export const BOW_CROSSFADE_SECONDS = 0.05;
export const RELEASE_SECONDS = 0.14;

export const SAMPLE_TONE = Object.freeze({
  dryGain: 0.84,
  wetGain: 0.16,
  roomSeconds: 0.5,
  bowNoiseScale: 0.08,
  presenceHz: 2_650,
  presenceQ: 0.72,
  presenceGainDb: -2.4,
  lowpassHz: 6_600,
  lowpassQ: 0.38,
});
```

Keep `CONTINUATION_CROSSFADE_SECONDS = 0.09` and `CONTINUATION_THRESHOLD_SECONDS = 0.18` unchanged.

- [ ] **Step 4: Apply the warm Web Audio signal path**

Import `SAMPLE_TONE`. Replace direct `sourceBus` routing with:

```ts
const presence = context.createBiquadFilter();
presence.type = "peaking";
presence.frequency.value = SAMPLE_TONE.presenceHz;
presence.Q.value = SAMPLE_TONE.presenceQ;
presence.gain.value = SAMPLE_TONE.presenceGainDb;

const silk = context.createBiquadFilter();
silk.type = "lowpass";
silk.frequency.value = SAMPLE_TONE.lowpassHz;
silk.Q.value = SAMPLE_TONE.lowpassQ;

dry.gain.value = SAMPLE_TONE.dryGain;
wet.gain.value = SAMPLE_TONE.wetGain;
convolver.buffer = createRoomImpulseBuffer(context, SAMPLE_TONE.roomSeconds);

sourceBus.connect(presence).connect(silk);
silk.connect(dry).connect(destination);
silk.connect(convolver).connect(wet).connect(destination);
```

Change generated bow-noise gain to:

```ts
sounding ? expressive.noiseGain * SAMPLE_TONE.bowNoiseScale : 0
```

Do not alter `overallGain`, sample playback rates, p/f layer mapping, or the 120 ms synth-to-sample backend handoff.

- [ ] **Step 5: Verify tone-model and build integrity**

Run:

```powershell
node --import tsx --test src/tests/sampleVoiceModel.test.ts src/tests/roomImpulse.test.ts src/tests/stringVoiceModel.test.ts
npm.cmd run build
```

Expected: focused tests PASS and TypeScript/Vite build succeeds with no Web Audio type errors.

- [ ] **Step 6: Commit the tone treatment**

```powershell
git add src/audio/sampleVoiceModel.ts src/audio/sampledViolinVoice.ts src/tests/sampleVoiceModel.test.ts
git commit -m "feat: soften sampled violin tone"
```

## Task 3: Refine the Three.js violin into aged varnish

**Files:**
- Modify: `src/scene/sceneLayout.ts`
- Modify: `src/scene/violinScene.ts`
- Test: `src/tests/sceneLayout.test.ts`

- [ ] **Step 1: Write the failing stable-instrument test**

Add `instrumentScale` to the wished-for pose API:

```ts
test("keeps the violin body stable while bow expression moves", () => {
  const soft = mapBowPose({ bowX: 0.3, pitch: 0.5, intensity: 0.2, direction: 1, phase: "bowing" });
  const strong = mapBowPose({ bowX: 0.8, pitch: 0.5, intensity: 1, direction: -1, phase: "bowing" });

  assert.equal(soft.instrumentScale, 1);
  assert.equal(strong.instrumentScale, 1);
  assert.notEqual(soft.x, strong.x);
});
```

- [ ] **Step 2: Run the focused test and confirm the missing-property failure**

Run:

```powershell
node --import tsx --test src/tests/sceneLayout.test.ts
```

Expected: FAIL because `BowPose.instrumentScale` does not exist.

- [ ] **Step 3: Add stable scale to the pure scene mapping**

Add `instrumentScale: number` to `BowPose` and return:

```ts
instrumentScale: 1,
```

In `violinScene.ts`, delete the sinusoidal `pulse` calculation and use:

```ts
this.instrument.scale.setScalar(pose.instrumentScale);
```

- [ ] **Step 4: Apply the approved varnish palette and restrained lighting**

Use these exact scene values:

```ts
const IVORY = new THREE.Color("#eadbc5");
const AMBER = new THREE.Color("#c99361");
const VERMILION = new THREE.Color("#9a4b35");
const ALIGNED = new THREE.Color("#a9c7a0");

this.renderer.toneMappingExposure = 0.94;
this.scene.add(new THREE.AmbientLight("#5b4034", 1.35));
const key = new THREE.SpotLight("#f2d2aa", 58, 15, Math.PI / 5, 0.7, 1.2);
const rim = new THREE.PointLight("#a24e39", 15, 12, 1.5);
```

Set body wood to `#713623`, maple to `#9b5e3d`, dark wood to `#1b1210`, clearcoat `0.58`, clearcoat roughness `0.3`, and body roughness `0.4`. Set the bow stick to `#7d3f2e`, bow hair to `#eadcc8`, particles to `#d0a06f`, halo to `#6e3e31` at opacity `0.22`, and the stage line to `#8b6650` at opacity `0.22`. Lower bow-material emission multiplier from `0.24` to `0.14` and cap selected string glow at `Math.min(pose.glow, 1.35)`.

- [ ] **Step 5: Run scene regression and production build**

Run:

```powershell
node --import tsx --test src/tests/sceneLayout.test.ts src/tests/stagePlacement.test.ts
npm.cmd run build
```

Expected: PASS; right-side placement and responsive camera mapping remain unchanged.

- [ ] **Step 6: Commit the scene treatment**

```powershell
git add src/scene/sceneLayout.ts src/scene/violinScene.ts src/tests/sceneLayout.test.ts
git commit -m "feat: refine violin varnish and motion"
```

## Task 4: Implement the Bow Hair Breathing guided UI

**Files:**
- Modify: `src/ui/guidedViewModel.ts`
- Modify: `src/ui/guidedView.ts`
- Modify: `src/ui/appView.ts`
- Modify: `src/styles.css`
- Test: `src/tests/guidedViewModel.test.ts`
- Test: `src/tests/orbitRhythmView.test.ts`

- [ ] **Step 1: Write the failing deterministic pulse-key test**

Extend `GuidedDisplay` with a wished-for `judgmentPulseKey` and add:

```ts
test("creates one pulse key for each judged score note", () => {
  const song = getSong("ode-to-joy");
  const engine = new GuidedSongEngine(song);
  engine.start(0);
  engine.update(bow({ bowing: false, direction: 0 }), 3000);
  const judged = engine.update(bow({ direction: 1 }), 3050);
  const display = buildGuidedDisplay(song, judged);

  assert.equal(display.judgmentPulseKey, `${judged.lastJudgmentNoteIndex}:${judged.lastJudgment}`);
});
```

- [ ] **Step 2: Run the focused test and confirm the missing-field failure**

Run:

```powershell
node --import tsx --test src/tests/guidedViewModel.test.ts
```

Expected: FAIL because `GuidedDisplay.judgmentPulseKey` does not exist.

- [ ] **Step 3: Add the pulse key and one-shot hit-zone animation**

Add to `GuidedDisplay`:

```ts
judgmentPulseKey: string | null;
```

Return:

```ts
judgmentPulseKey: frame.lastJudgmentNoteIndex >= 0 && frame.lastJudgment !== "none"
  ? `${frame.lastJudgmentNoteIndex}:${frame.lastJudgment}`
  : null,
```

Give the existing SVG group `id="orbit-hit-zone"`. In `GuidedView`, store `lastJudgmentPulseKey`, query the group as `SVGGElement`, and when a non-null key changes run:

```ts
this.orbitHitZone.dataset.tone = display.timingTone;
if (
  display.judgmentPulseKey
  && display.judgmentPulseKey !== this.lastJudgmentPulseKey
  && !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  && typeof this.orbitHitZone.animate === "function"
) {
  this.orbitHitZone.animate(
    [
      { opacity: 0.55, transform: "scale(0.96)" },
      { opacity: 1, transform: "scale(1.08)", offset: 0.38 },
      { opacity: 0.72, transform: "scale(1)" },
    ],
    { duration: 520, easing: "cubic-bezier(.22,.8,.28,1)" },
  );
}
this.lastJudgmentPulseKey = display.judgmentPulseKey;
```

Set SVG `transform-box: fill-box` and `transform-origin: center` in CSS so the pulse stays anchored to the hit marker.

- [ ] **Step 4: Replace the orbit colors and visual tokens**

In `appView.ts`, change the current gradient stops to `#c58b5b` and `#ead7ba`. In `styles.css`, replace the root tokens with:

```css
:root {
  --ink: #eee3d3;
  --muted: #9d8b7b;
  --ember: #a45138;
  --amber: #c89162;
  --ivory: #eadbc5;
  --varnish: #713623;
  --line: rgba(238, 227, 211, 0.13);
  --panel: rgba(17, 12, 10, 0.58);
}
```

Set the camera filter to `saturate(0.72) sepia(0.05) contrast(1.08) brightness(0.72)`, reduce the red camera halo, and use a warm neutral radial highlight at the violin position.

- [ ] **Step 5: Restyle the guided hierarchy with exact bow-hair treatments**

Apply these bounded rules while preserving existing responsive positions:

```css
.guided-piece,
.direction-prompt {
  border-left: 1px solid rgba(200, 145, 98, 0.72);
  background: linear-gradient(90deg, rgba(16, 11, 9, 0.48), transparent 88%);
}

.orbit-rail-outer {
  stroke: rgba(234, 219, 197, 0.2);
  stroke-width: 0.65px;
  stroke-dasharray: 1 4.5;
}

.orbit-rail-inner {
  stroke: rgba(200, 145, 98, 0.13);
  stroke-width: 0.55px;
}

.orbit-cue-arc { stroke-width: 0.8px; }
.orbit-cue.is-current .orbit-cue-arc {
  stroke-width: 1.65px;
  filter: drop-shadow(0 0 3px rgba(200, 145, 98, 0.5));
}

.orbit-cue-point {
  fill: #18110e;
  stroke: var(--ivory);
  stroke-width: 0.32px;
}

.orbit-cue.is-current .orbit-cue-point {
  fill: var(--amber);
  stroke: #f2dfc3;
  filter: drop-shadow(0 0 3px rgba(200, 145, 98, 0.65));
}

.measure-track > i {
  height: 2px;
  background: repeating-linear-gradient(90deg,
    rgba(234, 219, 197, 0.22) 0 1px,
    transparent 1px 3px);
}

.measure-track > i b {
  background: linear-gradient(90deg, #784333, #bd8358 72%, #ead7ba);
  box-shadow: 0 0 8px rgba(189, 131, 88, 0.26);
}

.timing-feedback {
  border: 0;
  padding: 6px 0;
  background: transparent;
  font-family: "Iowan Old Style", "Noto Serif SC", STSong, serif;
}
```

Reduce the direction arrow to `54px`, current note to `42px`, and score to `32px`; increase negative space instead of adding panels. Preserve all content, focus states, and mobile breakpoints.

- [ ] **Step 6: Add reduced-motion and graceful static fallback**

Inside the existing media query, include:

```css
@media (prefers-reduced-motion: reduce) {
  .orbit-cue,
  .measure-track > i b,
  .timing-feedback,
  .orbit-hit-zone {
    animation: none !important;
    transition: none !important;
  }
}
```

If `Element.animate` is unavailable, skip the pulse without changing labels or judgment color.

- [ ] **Step 7: Run focused UI tests, full tests, and build**

Run:

```powershell
node --import tsx --test src/tests/guidedViewModel.test.ts src/tests/orbitRhythmView.test.ts src/tests/sceneLayout.test.ts
npm.cmd test
npm.cmd run build
```

Expected: all tests PASS, build succeeds, and the bundle introduces no new external assets.

- [ ] **Step 8: Commit the guided stage restyle**

```powershell
git add src/ui/guidedViewModel.ts src/ui/guidedView.ts src/ui/appView.ts src/styles.css src/tests/guidedViewModel.test.ts src/tests/orbitRhythmView.test.ts
git commit -m "feat: add bow hair breathing stage"
```

## Task 5: Verify interaction, listening quality, and draft deployment

**Files:**
- Create: `docs/verification/2026-07-22-silken-bow-stage.md`

- [ ] **Step 1: Run final automated verification from a clean build**

Run:

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run audio:import
git diff --exit-code -- audio-sources/vsco2-ce/source-lock.json src/audio/generated/violinSampleManifest.ts public/audio/violin/vsco2-ce
git diff --check
```

Expected: full suite PASS, Vite production build succeeds, the sample import is deterministic, and no whitespace errors are reported.

- [ ] **Step 2: Start a production preview and inspect the real interaction paths**

Run:

```powershell
npm.cmd run preview -- --host 127.0.0.1
```

In a Chromium browser verify:

1. `/` defaults to camera mode and requests camera permission.
2. Mouse rehearsal remains available when a physical camera gesture cannot be automated.
3. Guided mode retains the right-positioned violin and circular rhythm rail.
4. Reversing before the hit point keeps the current note continuous with no second attack.
5. Crossing the score boundary produces exactly one attack, including repeated-pitch boundaries.
6. `/?tone=synth` still uses the fallback backend.
7. Desktop, narrow viewport, and reduced-motion states remain legible with no console errors.

- [ ] **Step 3: Perform a subjective A/B listening check**

Compare the new default sampled voice against the current sampled draft and `/?tone=synth`. Record whether bow grit is reduced, note attacks remain immediate, releases do not smear adjacent notes, and forte gestures remain distinguishable. Label these observations as subjective rather than automated.

- [ ] **Step 4: Record verification evidence**

Create `docs/verification/2026-07-22-silken-bow-stage.md` with:

- exact commit and commands;
- passing test count and production asset sizes;
- browser/version and tested routes;
- early-reversal, repeated-note, free-mode, reduced-motion, and viewport results;
- subjective sampled/synth A/B notes;
- residual limitations, especially that a real user must grant camera permission;
- production deploy ID before and after the draft deployment.

- [ ] **Step 5: Commit verification evidence and push the branch**

```powershell
git add docs/verification/2026-07-22-silken-bow-stage.md
git commit -m "docs: verify silken bow stage"
git push origin feature/gesture-violin-mvp
```

- [ ] **Step 6: Publish a Netlify draft, never production**

Use the Netlify deploy skill and run:

```powershell
npx.cmd -y netlify-cli@latest deploy --dir dist --site 29931500-0653-4cc2-af3a-1370ebe20b13 --json --message "Silken bow articulation"
```

Do not pass `--prod`. If the CLI cannot complete, use Netlify's SHA-1 digest deploy API with a JSON body containing `"draft": true`, forward-slash asset paths, and the existing authenticated Netlify configuration. Reject the result unless `context` is `deploy-preview`, `state` becomes `ready`, and `published_at` remains empty.

- [ ] **Step 7: Smoke-check the deployed root and preserve production**

Verify HTTP 200 for the draft root, hashed JavaScript, hashed CSS, and all twelve MP3 files. Open the draft root without `?demo=1`, confirm camera mode is selected, and repeat the sample/synth console check. Read the production site record and assert published deploy ID `6a573a85c8c09800d5e06301` is still current.

- [ ] **Step 8: Return the normal gesture link**

Report the draft root URL as the primary link, the same draft with `?tone=synth` only as an optional A/B fallback, and state explicitly that `https://gesture-violin-lab-664.netlify.app` was not changed.
