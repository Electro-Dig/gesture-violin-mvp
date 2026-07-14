# Guided Song Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add short assisted performances of Ode to Joy and Canon in D, with bow-driven elastic time, soft pitch gating, procedural accompaniment, scoring, song selection, and results to the deployed Gesture Violin MVP.

**Architecture:** Keep camera, mouse, demo, and `BowingGestureInterpreter` unchanged. A new pure `GuidedSongEngine` consumes `BowingFrame`, owns elastic musical transport and scoring, and produces a guided frame used by the existing melody synth, a separate accompaniment synth, the Three.js scene, and new UI layers. Free play continues to bypass the song engine.

**Tech Stack:** TypeScript, Vite, Three.js, MediaPipe Tasks Vision, Web Audio API, Node test runner with tsx, Netlify.

---

## File Structure

- `src/music/songTypes.ts`: song, melody, accompaniment, score, and guided-frame contracts.
- `src/music/songValidation.ts`: pure validation for authored song data.
- `src/music/songs/odeToJoy.ts`: original short C-major arrangement data.
- `src/music/songs/canonInD.ts`: original short D-major arrangement data.
- `src/music/songs/catalogue.ts`: stable public song catalogue.
- `src/music/guidedSongEngine.ts`: count-in, transport, soft gate, event crossing, and score state machine.
- `src/music/guidedPerformance.ts`: convert guided state plus raw bow gesture into `PerformanceState`.
- `src/audio/accompanimentSynth.ts`: short procedural chord/bass voices triggered by crossed events.
- `src/ui/guidedView.ts`: song selector, guided HUD, and result view behavior.
- `src/ui/appView.ts`: add mount points and change the entry actions to guided/free play.
- `src/app.ts`: orchestrate free and guided paths without changing input adapters.
- `src/scene/violinScene.ts`: accept pitch-alignment feedback.
- `src/styles.css`: song selection, pitch rail, progress, phrase preview, and result styling.
- `src/tests/songCatalogue.test.ts`: arrangement and validation tests.
- `src/tests/guidedSongEngine.test.ts`: transport, gating, scoring, completion, and cues.
- `src/tests/guidedPerformance.test.ts`: correct-note assistance and silence rules.
- `README.md`: guided mode, public-domain arrangement, and limitations.

## Task 1: Authored Song Catalogue

**Files:**
- Create: `src/music/songTypes.ts`
- Create: `src/music/songValidation.ts`
- Create: `src/music/songs/odeToJoy.ts`
- Create: `src/music/songs/canonInD.ts`
- Create: `src/music/songs/catalogue.ts`
- Test: `src/tests/songCatalogue.test.ts`

- [ ] **Step 1: Write the failing catalogue tests**

Create tests that assert both songs exist, all notes have positive duration and sorted start beats, every accompaniment event lies inside the song, and validation returns no errors. Assert Ode uses MIDI `[60, 62, 64, 65, 67]` and has 44–52 beats; assert Canon uses only `[62, 64, 66, 67, 69, 71, 73]` and has 76–84 beats.

```ts
test("the catalogue contains two valid curated arrangements", () => {
  assert.deepEqual(SONG_CATALOGUE.map((song) => song.id), ["ode-to-joy", "canon-in-d"]);
  for (const song of SONG_CATALOGUE) assert.deepEqual(validateSong(song), []);
});

test("Ode to Joy uses five broad beginner lanes", () => {
  assert.deepEqual(uniqueMidi(ODE_TO_JOY), [60, 62, 64, 65, 67]);
  assert.ok(ODE_TO_JOY.totalBeats >= 44 && ODE_TO_JOY.totalBeats <= 52);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --import tsx --test src/tests/songCatalogue.test.ts`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for song modules.

- [ ] **Step 3: Define exact song contracts**

```ts
export type SongId = "ode-to-joy" | "canon-in-d";
export type SongNote = { midi: number; startBeat: number; durationBeats: number; dynamic: number; phrase: number };
export type AccompanimentEvent = { startBeat: number; midi: number[]; velocity: number; durationBeats: number };
export type ScoreBreakdown = {
  total: number; stars: 1 | 2 | 3; pitch: number; continuity: number; expression: number;
};
export type SongDefinition = {
  id: SongId; title: string; composer: string; bpm: number; beatsPerBar: number;
  difficulty: 1 | 2 | 3; durationLabel: string; totalBeats: number;
  pitchLanes: number[]; melody: SongNote[]; accompaniment: AccompanimentEvent[];
};
```

Implement `validateSong(song)` with concrete messages for empty melody, unsorted/overlapping notes, invalid duration/dynamic, MIDI not in `pitchLanes`, and events outside `0..totalBeats`.

- [ ] **Step 4: Author the two arrangements**

Use a small helper that converts sequential `{ midi, beats, dynamic, phrase }` entries into absolute `SongNote` values. Ode uses BPM 76 and 48 beats: three 16-beat phrases based on the familiar E–E–F–G theme. Canon uses BPM 72 and 80 beats: five 16-beat variations constrained to seven D-major pitch lanes. Add one accompaniment event per four beats; Canon follows `D–A–Bm–F#m–G–D–G–A` and repeats it.

- [ ] **Step 5: Verify GREEN and commit**

Run: `pnpm test && pnpm build`

Expected: all tests and the production build pass.

```bash
git add src/music/songTypes.ts src/music/songValidation.ts src/music/songs src/tests/songCatalogue.test.ts
git commit -m "feat: add guided classical song catalogue"
```

## Task 2: Elastic Guided Song Engine

**Files:**
- Create: `src/music/guidedSongEngine.ts`
- Test: `src/tests/guidedSongEngine.test.ts`

- [ ] **Step 1: Write failing transport and gate tests**

Use a two-note fixture at 60 BPM. Assert:

```ts
test("transport advances only while bowing", () => {
  const engine = startedEngine();
  const stopped = engine.update(frame({ bowing: false }), 4000);
  assert.equal(stopped.transportBeat, 0);
  const moving = engine.update(frame({ bowing: true, pitch: 0 }), 5000);
  assert.ok(moving.transportBeat > 0);
});

test("soft gating is full speed on target and bottoms out at thirty percent", () => {
  assert.equal(softGateFactor(0, 0.2), 1);
  assert.equal(softGateFactor(1, 0.2), 0.3);
});
```

Also test the three-second count-in, note transitions, event crossing once, lost tracking freeze, reversal grace, completion, score weights, and star thresholds 60/82.

- [ ] **Step 2: Verify RED**

Run: `node --import tsx --test src/tests/guidedSongEngine.test.ts`

Expected: FAIL because `guidedSongEngine.ts` does not exist.

- [ ] **Step 3: Implement the pure state machine**

Export:

```ts
export type GuidedPhase = "idle" | "countIn" | "playing" | "complete";
export type GuidedSongFrame = {
  phase: GuidedPhase; countdown: number; transportBeat: number; progress: number;
  currentNote: SongNote; currentNoteIndex: number; targetPitch: number; handPitch: number;
  alignment: number; speedFactor: number; upcomingNotes: SongNote[];
  crossedAccompaniment: AccompanimentEvent[]; score: ScoreBreakdown;
};

export class GuidedSongEngine {
  constructor(readonly song: SongDefinition) {}
  start(nowMs: number): GuidedSongFrame;
  update(bowing: BowingFrame, nowMs: number): GuidedSongFrame;
  reset(): GuidedSongFrame;
}
```

`softGateFactor` uses adjacent-lane spacing, returns 1 through 0.45 lane widths, interpolates to 0.3 at 1.5 lane widths, and clamps there. Advance beats with `dtSeconds * bpm / 60 * speedFactor` only while playing and bowing.

- [ ] **Step 4: Implement score accumulation**

Accumulate pitch and expression only while bowing. Exclude `active === false` from continuity. Give visible stationary hands 350ms reversal grace, then add their idle time to the continuity denominator. Return weighted score:

```ts
const total = Math.round(pitch * 45 + continuity * 35 + expression * 20);
const stars: 1 | 2 | 3 = total >= 82 ? 3 : total >= 60 ? 2 : 1;
```

- [ ] **Step 5: Verify and commit**

Run: `pnpm test && pnpm build`

```bash
git add src/music/guidedSongEngine.ts src/tests/guidedSongEngine.test.ts
git commit -m "feat: drive songs from assisted bow gestures"
```

## Task 3: Guided Melody Output

**Files:**
- Create: `src/music/guidedPerformance.ts`
- Test: `src/tests/guidedPerformance.test.ts`

- [ ] **Step 1: Write the failing assisted-output tests**

```ts
test("guided melody always uses the score note instead of the raw hand lane", () => {
  const state = mapGuidedPerformance(frame({ pitch: 0 }), guided({ currentNote: note(67), targetPitch: 1 }));
  assert.equal(state.midi, 67);
});

test("count-in and completion stay silent", () => {
  assert.equal(mapGuidedPerformance(frame({ bowing: true }), guided({ phase: "countIn" })).voiceActive, false);
  assert.equal(mapGuidedPerformance(frame({ bowing: true }), guided({ phase: "complete" })).voiceActive, false);
});
```

Also assert intensity still follows bow speed and `pitch` in the visual performance state is the target pitch.

- [ ] **Step 2: Verify RED**

Run: `node --import tsx --test src/tests/guidedPerformance.test.ts`

Expected: missing module failure.

- [ ] **Step 3: Implement guided mapping**

Use `midiToFrequency`, score note name, raw gesture intensity/direction/confidence, and guided target pitch. Set `voiceActive` only when guided phase is `playing` and raw `bowing` is true. Brightness remains expressive but is multiplied by `0.72 + alignment * 0.28` for restrained feedback.

- [ ] **Step 4: Verify and commit**

Run: `pnpm test && pnpm build`

```bash
git add src/music/guidedPerformance.ts src/tests/guidedPerformance.test.ts
git commit -m "feat: map guided scores to assisted melody output"
```

## Task 4: Procedural Accompaniment

**Files:**
- Create: `src/audio/accompanimentSynth.ts`
- Modify: `src/audio/stringSynth.ts`

- [ ] **Step 1: Add an independently muted accompaniment voice**

Implement `AccompanimentSynth.start(context, destination)`, `trigger(event, bpm)`, `setMuted`, and `dispose`. Each event creates quiet sine/triangle oscillators with a 10ms attack and exponential release capped at 1.8 seconds. Bass notes use the lowest MIDI in the event one octave lower at half level. Cap the summed chord gain at 0.11.

- [ ] **Step 2: Expose the audio context destination safely**

Refactor `StringSynth` to own an `AccompanimentSynth`, start it after the master node is built, route it through the same master mute, and expose `triggerAccompaniment(events, bpm)`. Do not create audio contexts outside explicit user actions.

- [ ] **Step 3: Verify build and regression**

Run: `pnpm test && pnpm build`

Expected: all pure tests pass and TypeScript accepts Web Audio lifecycle handling.

- [ ] **Step 4: Commit**

```bash
git add src/audio/accompanimentSynth.ts src/audio/stringSynth.ts
git commit -m "feat: add elastic procedural accompaniment"
```

## Task 5: Song Selection, Guided HUD, and Results

**Files:**
- Create: `src/ui/guidedView.ts`
- Modify: `src/ui/appView.ts`
- Modify: `src/styles.css`

- [ ] **Step 1: Add semantic guided UI mount points**

Change the intro actions to `选择曲目` and `自由演奏`. Add a song-selection layer with buttons carrying `data-song-id`, a hidden guided HUD, and a hidden result layer. Disable a song button when `validateSong` returns errors. Preserve existing camera preview, mode switch, privacy copy, and free-play note ladder.

- [ ] **Step 2: Implement `GuidedView`**

Expose:

```ts
export class GuidedView {
  readonly songButtons: HTMLButtonElement[];
  readonly replayButton: HTMLButtonElement;
  readonly chooseSongButton: HTMLButtonElement;
  readonly freePlayButton: HTMLButtonElement;
  showSongSelect(): void;
  start(song: SongDefinition): void;
  update(frame: GuidedSongFrame): void;
  showResult(song: SongDefinition, score: ScoreBreakdown): void;
  hide(): void;
}
```

`update` must set total progress, phrase progress, current note, next three notes, target cursor, hand cursor, alignment state, live score, and count-in text without rebuilding the DOM each frame.

- [ ] **Step 3: Style the experience**

Use the existing lacquered palette and ruled-line language. Song entries are editorial rows, not generic rounded cards. The pitch target is an illuminated ruled marker; the hand cursor is a small ivory ring. Results use restrained outlined stars. At 390px, keep song buttons, target rail, progress, current note, score, and mode switch reachable with no horizontal scroll.

- [ ] **Step 4: Build and commit**

Run: `pnpm build`

```bash
git add src/ui/guidedView.ts src/ui/appView.ts src/styles.css
git commit -m "feat: add guided song game interface"
```

## Task 6: Runtime and Three.js Integration

**Files:**
- Modify: `src/app.ts`
- Modify: `src/scene/violinScene.ts`

- [ ] **Step 1: Add free/guided session state**

Track `playMode: "free" | "guided"`, selected song, `GuidedSongEngine | null`, and result-display guard. Song choice starts the current/default input, creates the engine, starts count-in, and preserves the song if camera permission falls back to mouse.

- [ ] **Step 2: Route every input through the correct performance path**

After `BowingGestureInterpreter.update`:

```ts
if (playMode === "guided" && guidedEngine) {
  const guided = guidedEngine.update(bowing, nowMs);
  performance = mapGuidedPerformance(bowing, guided);
  synth.triggerAccompaniment(guided.crossedAccompaniment, guidedEngine.song.bpm);
  guidedView.update(guided);
} else {
  performance = mapPerformance(bowing);
}
```

On completion, release melody audio and show results exactly once. Replay resets the same song; choose-song freezes audio and returns to selection; free play restores the existing pentatonic HUD.

- [ ] **Step 3: Add alignment feedback to Three.js**

Add `setGuidance(alignment: number | null)`. In guided mode, lerp selected-string emissive strength and particle color between muted umber at zero alignment and amber/vermilion at full alignment. `null` restores free-play behavior.

- [ ] **Step 4: Make demo mode deterministic**

`?demo=1` selects Ode to Joy, uses `DemoHandSource`, skips camera, displays the demo badge, and can complete through the same engine. Tune only the demo hand's vertical phase if necessary; do not create a separate scoring or song path.

- [ ] **Step 5: Verify and commit**

Run: `pnpm test && pnpm build`

```bash
git add src/app.ts src/scene/violinScene.ts src/gesture/demoHandSource.ts
git commit -m "feat: integrate guided performances end to end"
```

## Task 7: Documentation, Browser Verification, and Deployment

**Files:**
- Modify: `README.md`
- Modify: `netlify.toml` only if deployment headers require changes.

- [ ] **Step 1: Update documentation**

Document both songs, assisted melody behavior, elastic time, soft gating, scoring weights, free play, `?demo=1`, and the fact that arrangements/audio are original procedural realizations of public-domain compositions.

- [ ] **Step 2: Run final local verification**

Run: `pnpm test && pnpm build && git diff --check && git status --short`

Expected: all tests pass, production build succeeds, no whitespace errors, and only intended docs changes remain.

- [ ] **Step 3: Browser-test production preview**

Verify at desktop and 390px:

- Song selection exposes exactly Ode and Canon.
- Demo Ode reaches playing state and changes progress, target, live score, and melody note.
- Mouse rehearsal can complete a song; stopping the mouse freezes progress.
- Camera denial preserves the selected song and switches to rehearsal.
- Result shows score, stars, three sub-scores, replay, song choice, and free play.
- No console errors or horizontal overflow.

- [ ] **Step 4: Deploy to the existing independent Netlify site**

Build locally and deploy `dist` explicitly to site ID `29931500-0653-4cc2-af3a-1370ebe20b13`; do not use the unrelated parent workspace Netlify link.

```bash
netlify deploy --prod --dir dist --site 29931500-0653-4cc2-af3a-1370ebe20b13 --message "Guided songs update"
```

- [ ] **Step 5: Smoke-test public HTTPS and commit docs**

Check the stable URL and `?demo=1`, WebGL, audio unlock, camera assets, security headers, and console. Then:

```bash
git add README.md netlify.toml
git commit -m "docs: publish guided song mode"
```
