# Bow-Direction Rhythm Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace guided-song vertical pitch chasing with a forgiving Viola-style bow-direction rhythm rail while preserving free play and all input adapters.

**Architecture:** Keep the existing `HandFrame → BowingFrame` boundary. Make the interpreter easier to activate, refactor `GuidedSongEngine` into a bow-engagement and direction-judgment state machine, and project its pure state through a new rhythm-strip view model. DOM, Three.js, and Web Audio remain consumers of the pure engine.

**Tech Stack:** TypeScript, Vite, Node test runner, Three.js, MediaPipe Tasks Vision, Web Audio API, CSS.

---

### Task 1: Make horizontal bowing easier to activate

**Files:**
- Modify: `src/gesture/bowingGestureInterpreter.ts`
- Test: `src/tests/bowingGestureInterpreter.test.ts`

- [ ] **Step 1: Write the failing weak-gesture test**

```ts
test("moderate horizontal motion starts bowing without vertical travel", () => {
  const interpreter = new BowingGestureInterpreter();
  interpreter.update(handAt(0.45, 0.5, 0), 0);
  const frame = interpreter.update(handAt(0.47, 0.5, 100), 100);
  assert.equal(frame.bowing, true);
  assert.equal(frame.direction, 1);
});

test("a slow turnaround retains the last bow direction", () => {
  const interpreter = new BowingGestureInterpreter();
  interpreter.update(handAt(0.4, 0.5, 0), 0);
  interpreter.update(handAt(0.44, 0.5, 100), 100);
  const frame = interpreter.update(handAt(0.445, 0.5, 200), 200);
  assert.equal(frame.bowing, true);
  assert.equal(frame.direction, 1);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
node --import tsx --test src/tests/bowingGestureInterpreter.test.ts
```

Expected: the moderate motion is below the current `0.24` start speed or the slow frame loses direction.

- [ ] **Step 3: Implement tolerant thresholds and direction retention**

Set defaults to:

```ts
bowStartSpeed: 0.14,
bowReleaseSpeed: 0.045,
fullIntensitySpeed: 1.05,
```

Store the last non-zero direction and retain it while `shouldBow` remains true but the instantaneous sign is too small to be reliable. Clear it on tracking loss and reset.

- [ ] **Step 4: Run interpreter tests and full tests**

Expected: focused tests and existing gesture tests pass.

- [ ] **Step 5: Commit**

```powershell
git add src/gesture/bowingGestureInterpreter.ts src/tests/bowingGestureInterpreter.test.ts
git commit -m "feat: make bow gestures more forgiving"
```

### Task 2: Replace pitch gating with direction rhythm judgment

**Files:**
- Modify: `src/music/guidedSongEngine.ts`
- Modify: `src/music/songTypes.ts`
- Rewrite: `src/tests/guidedSongEngine.test.ts`

- [ ] **Step 1: Write failing engine tests for the new contract**

Use a compact four-note fixture and assert:

```ts
assert.equal(first.expectedDirection, 1);
assert.equal(second.expectedDirection, -1);
assert.equal(lowPitch.transportBeat, highPitch.transportBeat);
assert.equal(perfect.lastJudgment, "perfect");
assert.equal(good.lastJudgment, "good");
assert.equal(missed.lastJudgment, "miss");
assert.equal(turnaround.transportBeat > beforeTurn.transportBeat, true);
```

Also assert that each note increments `judgedNoteCount` at most once and tracking loss freezes transport.

- [ ] **Step 2: Run focused tests and verify RED**

Expected: current engine exposes pitch alignment/speed factor and cannot provide direction judgments.

- [ ] **Step 3: Implement the new frame and score types**

Replace pitch-specific fields with:

```ts
type RhythmJudgment = "none" | "perfect" | "good" | "miss";

type GuidedSongFrame = {
  phase: GuidedPhase;
  countdown: number;
  transportBeat: number;
  progress: number;
  currentNote: SongNote;
  currentNoteIndex: number;
  expectedDirection: -1 | 1;
  bowDirection: -1 | 0 | 1;
  bowX: number;
  bowEngaged: boolean;
  lastJudgment: RhythmJudgment;
  judgedNoteCount: number;
  upcomingNotes: SongNote[];
  crossedAccompaniment: AccompanimentEvent[];
  score: ScoreBreakdown;
};
```

Rename `ScoreBreakdown.pitch` to `ScoreBreakdown.timing`.

- [ ] **Step 4: Implement timing windows and bow grace**

Use constants:

```ts
const TURNAROUND_GRACE_SECONDS = 0.28;
const PERFECT_WINDOW_BEATS = 0.12;
const GOOD_WINDOW_BEATS = 0.32;
```

Advance at `bpm / 60` while moving or inside turnaround grace. Judge matching alternating directions inside the good window, and mark overdue notes missed. Score note values as `1`, `0.72`, and `0`.

- [ ] **Step 5: Run focused and full tests**

Expected: pitch-invariance, grace, judgment, completion, accompaniment, and score tests pass.

- [ ] **Step 6: Commit**

```powershell
git add src/music/guidedSongEngine.ts src/music/songTypes.ts src/tests/guidedSongEngine.test.ts
git commit -m "feat: score guided songs by bow direction"
```

### Task 3: Project the song into a rhythm strip

**Files:**
- Create: `src/ui/rhythmStripModel.ts`
- Rewrite: `src/ui/guidedViewModel.ts`
- Rewrite: `src/tests/guidedViewModel.test.ts`

- [ ] **Step 1: Write failing cue-position tests**

```ts
const display = buildGuidedDisplay(song, frameAtBeat(4));
const current = display.cues.find((cue) => cue.noteIndex === frame.currentNoteIndex)!;
assert.equal(current.topPercent, 68);
assert.equal(current.expectedDirection, frame.expectedDirection);
assert.equal(display.directionMessage, "向右换弓");
assert.equal(display.timingLabel, "精准");
```

Assert cue positions are clamped to the visible strip and vertical hand pitch is absent.

- [ ] **Step 2: Run the focused test and verify RED**

Expected: current view model only provides pitch target and hand positions.

- [ ] **Step 3: Implement rhythm cue projection**

Use a fixed judgment line at `68%`, four beats of look-ahead, and one beat of passed-note history. Bar height derives from `durationBeats`, capped so adjacent cues stay legible.

- [ ] **Step 4: Run focused and full tests**

Expected: cue positioning and labels pass without breaking song validation.

- [ ] **Step 5: Commit**

```powershell
git add src/ui/rhythmStripModel.ts src/ui/guidedViewModel.ts src/tests/guidedViewModel.test.ts
git commit -m "feat: project songs into a bow rhythm strip"
```

### Task 4: Keep audio and demo motion aligned with direction gameplay

**Files:**
- Modify: `src/music/guidedPerformance.ts`
- Modify: `src/gesture/demoHandSource.ts`
- Modify: `src/app.ts`
- Modify: `src/tests/guidedPerformance.test.ts`
- Modify: `src/tests/demoHandSource.test.ts`

- [ ] **Step 1: Write failing integration-model tests**

Assert guided pitch always uses score MIDI regardless of hand height, brightness no longer depends on alignment, and demo motion reverses horizontally while keeping a central vertical position.

- [ ] **Step 2: Run tests and verify RED**

Expected: guided performance still reads removed alignment fields and demo accepts a target-pitch override.

- [ ] **Step 3: Update mapping and runtime**

Map score pitch, real bow intensity/direction, and real `bowX`. Pass engine timing feedback to scene guidance as `1`, `0.72`, or `0`; remove the demo target-pitch parameter from `app.ts`.

- [ ] **Step 4: Run tests and build**

Expected: TypeScript compilation and all tests pass.

- [ ] **Step 5: Commit**

```powershell
git add src/music/guidedPerformance.ts src/gesture/demoHandSource.ts src/app.ts src/tests/guidedPerformance.test.ts src/tests/demoHandSource.test.ts
git commit -m "feat: drive assisted melody from bow rhythm"
```

### Task 5: Replace the pitch rail with the notation-like time ribbon

**Files:**
- Modify: `src/ui/appView.ts`
- Modify: `src/ui/guidedView.ts`
- Modify: `src/styles.css`

- [ ] **Step 1: Replace guided DOM references**

Remove `#pitch-target`, `#pitch-hand`, `#pitch-alignment`, and pitch-gate copy. Add:

```html
<div id="rhythm-strip" class="rhythm-strip">
  <div id="rhythm-cues" class="rhythm-cues"></div>
  <div class="judgment-line"><span>在这里换弓</span></div>
  <div id="bow-cursor" class="bow-cursor"></div>
</div>
<div id="direction-prompt" class="direction-prompt"></div>
<div id="timing-feedback" class="timing-feedback"></div>
```

Change the result metric label from `音高控制` to `方向节奏`.

- [ ] **Step 2: Render cues from the display model**

Render a bounded set of ruled cue elements with note name, arrow, top, height, and state. Update only the cue container each UI tick; keep all button references stable.

- [ ] **Step 3: Style desktop and mobile layouts**

Center the rail over the instrument, use an ivory path, a vermilion line at 68%, amber active bars, and a horizontal bow cursor. At 390 px, keep the rail inside the stage and move metadata away from the direction prompt.

- [ ] **Step 4: Run build and inspect no TypeScript errors**

- [ ] **Step 5: Commit**

```powershell
git add src/ui/appView.ts src/ui/guidedView.ts src/styles.css
git commit -m "feat: add bow direction rhythm rail"
```

### Task 6: Documentation, browser acceptance, and deployment

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update interaction documentation**

Document automatic pitch, alternating bow direction, turnaround grace, timing score, and the fact that free play still uses vertical pitch.

- [ ] **Step 2: Run final verification**

```powershell
pnpm test
pnpm build
git diff --check
```

Expected: all tests pass, production build succeeds, and no whitespace errors are reported.

- [ ] **Step 3: Browser acceptance**

Verify at 1440×900 and 390×844:

- song selection;
- count-in;
- descending cues reach the fixed line;
- demo progress and direction feedback;
- result, replay, and free-play actions;
- no horizontal overflow.

- [ ] **Step 4: Commit documentation**

```powershell
git add README.md
git commit -m "docs: explain bow direction song mode"
```

- [ ] **Step 5: Deploy to the existing site**

```powershell
netlify deploy --prod --dir dist --site 29931500-0653-4cc2-af3a-1370ebe20b13
```

- [ ] **Step 6: Verify production**

Open `https://gesture-violin-lab-664.netlify.app/?demo=1`, confirm the strip advances, then verify the normal homepage still exposes both guided songs and free play.
