# Guided Song Mode Design

**Date:** 2026-07-15  
**Status:** Approved through interactive choices; remaining implementation decisions delegated by the user.

## Goal

Extend the existing one-hand Gesture Violin MVP with an accessible, music-game-like guided performance mode inspired by the broad interaction idea of Viola the Bird, without copying its code, assets, arrangements, recordings, or visual identity.

The first release contains two short, original arrangements:

- Beethoven: **Ode to Joy**, about 35–45 seconds, beginner difficulty.
- Pachelbel: **Canon in D**, about 60–90 seconds, intermediate difficulty.

The player moves one hand vertically to follow the target pitch zone and horizontally to bow. The score always supplies the correct melody note; gesture quality controls progression speed, dynamics, visual feedback, and the final score.

## Confirmed Product Decisions

1. **Assisted performance:** the melody stays musically correct even when the hand misses the target pitch zone. Vertical accuracy affects feedback and score instead of producing wrong notes.
2. **Bow-driven time:** the song and procedural accompaniment advance only while the player is bowing. Stopping the bow freezes the musical transport.
3. **Soft pitch gate:** accurate vertical placement advances at full speed. Increasing error slows transport continuously to a floor of 30%, but never blocks the song completely.
4. **Curated excerpts:** use short arrangements designed for a web interaction, not complete multi-minute performances.
5. **Game result:** show a 0–100 score, one to three stars, and three sub-scores: pitch-zone accuracy, bow continuity, and expression.

## Considered Approaches

### Strict rhythm-and-pitch game

The backing track runs at fixed tempo and wrong vertical placement produces wrong notes. This creates a conventional music game but is poorly matched to camera latency, tracking jitter, and the accessibility goal. It was rejected.

### Pure auto-melody toy

Any horizontal movement advances a correct melody; vertical placement has no consequence. This is immediately satisfying but provides too little mastery or replay value. It was rejected.

### Assisted elastic performance — selected

Correct melody, bow-driven transport, soft pitch gating, and quality scoring preserve a beautiful musical result while leaving meaningful player agency. This is the selected approach.

## Experience Flow

### 1. Entry and song selection

The landing experience offers:

- Guided songs: Ode to Joy and Canon in D.
- Free play: preserve the current pentatonic experience.
- Camera and mouse rehearsal inputs. The input adapters remain interchangeable.

Each song card shows composer, approximate duration, difficulty, pitch-lane count, and a short interaction description.

### 2. Preparation

After choosing a song and input:

- Start/resume Web Audio from the user gesture.
- Start camera tracking when camera mode is selected.
- Show the first target pitch zone and wait for a visible hand.
- Run a 3–2–1 count-in only after input is ready.

Mouse rehearsal follows the identical song engine. `?demo=1` automatically demonstrates Ode to Joy and remains visibly labelled as simulated input.

### 3. Guided performance

During play:

- The current target note is shown on a vertical pitch rail.
- A hand-position cursor shows the player's current normalized pitch.
- The next three notes appear as a compact phrase preview, not as falling rhythm-game blocks.
- Horizontal bowing controls sound onset, volume, brightness, and transport movement.
- Vertical accuracy controls transport speed, target glow, rosin particles, and score.
- A ruled progress line shows phrase and total-song progress.
- If tracking is lost, audio releases and transport freezes with a calm recovery message.

### 4. Result

Completion opens a result layer with:

- Total score from 0 to 100.
- One, two, or three stars.
- Pitch zone, bow continuity, and expression sub-scores.
- Replay, choose another song, and free-play actions.

There is no failure state or game over.

## Musical Data

### Song definition

Each arrangement is authored locally as data:

```ts
type SongDefinition = {
  id: "ode-to-joy" | "canon-in-d";
  title: string;
  composer: string;
  bpm: number;
  beatsPerBar: number;
  difficulty: 1 | 2 | 3;
  melody: SongNote[];
  accompaniment: AccompanimentEvent[];
};

type SongNote = {
  midi: number;
  startBeat: number;
  durationBeats: number;
  dynamic: number;
  phrase: number;
};
```

Song mode does not reuse the free-play pentatonic scale:

- Ode to Joy uses five broad pitch lanes in a C-major arrangement.
- Canon uses seven pitch lanes in D major, including F-sharp and C-sharp.

The compositions are public domain, but the project will use newly entered melody data, original simplified arrangements, and procedural audio. It will not reuse modern copyrighted arrangements or recordings.

## Guided Performance Engine

`GuidedSongEngine` is a pure state machine independent of DOM, camera, Three.js, and Web Audio.

### Inputs

- Selected `SongDefinition`.
- Current `BowingFrame`.
- Delta time.

### State

- `idle | countIn | playing | complete`.
- Current transport beat and note index.
- Target pitch and normalized target lane position.
- Pitch alignment, speed factor, progress, phrase, and upcoming notes.
- Running score accumulators.
- Newly crossed accompaniment events.

### Soft gate

Pitch error is normalized by the spacing between adjacent lanes:

- Error up to 0.45 lane widths: speed factor 1.0.
- Error from 0.45 to 1.5 lane widths: interpolate from 1.0 to 0.3.
- Larger error: speed factor remains 0.3.

When `bowing` is false, transport advancement is zero regardless of pitch. When bowing resumes, the transport continues from the exact previous beat.

### Assisted output

The audio and 3D performance state uses the score's current MIDI note, never the raw vertical selection. Raw vertical position remains available for the hand cursor, accuracy, and feedback.

## Scoring

All metrics are accumulated continuously after the first bow stroke.

- **Pitch-zone accuracy — 45 points:** time-weighted alignment while bowing.
- **Bow continuity — 35 points:** proportion of active, trackable session time spent in a valid bow stroke, with short reversal grace so natural bow-direction changes are not penalized.
- **Expression — 20 points:** closeness of bow intensity to each note's authored dynamic target.

Tracking-loss time is excluded from continuity scoring. Pausing with a visible hand counts against continuity after a short grace period.

Star thresholds:

- 1 star: completed below 60.
- 2 stars: 60–81.
- 3 stars: 82–100.

## Audio

The existing `StringSynth` remains the melody voice. Guided mode overrides only its requested frequency with the current score note while keeping gesture-derived intensity and bow texture.

A separate lightweight accompaniment voice is added:

- Ode to Joy: quiet tonic/dominant pulse and simple bass support.
- Canon in D: original procedural realization of the repeating D–A–Bm–F#m–G–D–G–A harmonic pattern.
- Accompaniment events are triggered only when the elastic transport crosses their beat.
- Stopping the bow prevents new events; existing short tails decay naturally.
- No external audio files or recordings are required.

## UI and Visual Direction

Retain the current dark concert-workshop visual system. Add game information as musical notation-like ruled lines rather than generic cards or bright arcade lanes.

New UI units:

- `SongSelectView`: two editorial song entries plus free play.
- `GuidedHud`: title, progress rail, current/next notes, target lane, hand cursor, and live score.
- `ResultView`: stars, score breakdown, replay, song selection, and free play.

Three.js receives an optional guidance value:

- Accurate pitch warms the selected string and intensifies the contact glow.
- Misalignment desaturates feedback and emphasizes the target rail.
- Song completion produces a brief restrained halo/particle flourish.

## Runtime Integration

The existing camera, mouse, and demo sources continue to emit `HandFrame`. The existing interpreter continues to emit `BowingFrame`.

```text
Camera / Mouse / Demo
        ↓
BowingGestureInterpreter
        ↓
GuidedSongEngine ──→ score/progress/HUD
        ↓
guided PerformanceState
        ├──→ StringSynth + accompaniment
        └──→ ViolinScene
```

Free play bypasses `GuidedSongEngine` and retains the current `mapPerformance` path.

## Error Handling

- Camera denial: switch to mouse rehearsal and preserve the selected song.
- Tracking loss: freeze transport, release audio, exclude lost time from score.
- Audio start failure: keep visual gameplay and show a warning.
- Unsupported WebGL: show a concise fatal-state message rather than a blank canvas.
- Song data validation failure: disable only the invalid song and keep free play available.

## Verification

Pure tests will cover:

- Song definitions are sorted, non-overlapping, and use valid pitch lanes.
- Transport advances only during bowing.
- Accurate pitch advances faster than inaccurate pitch.
- The soft gate never drops below 30% and never exceeds 100%.
- Guided output always uses the score note.
- Tracking loss freezes transport without harming continuity.
- Score weights, reversal grace, completion, replay, and star thresholds.
- Accompaniment events fire once when their beats are crossed.

Browser verification will cover:

- Song selection, count-in, performance, result, replay, and free play.
- Camera denial fallback and real/fake camera startup.
- Mouse and demo completion of both songs.
- Audio unlock and mute.
- Desktop and narrow mobile layouts without horizontal overflow.
- Public HTTPS deployment, model/WASM requests, and console errors.

## Out of Scope

- Full-length pieces.
- Multiplayer, accounts, cloud scores, or leaderboards.
- Real sheet-music engraving.
- Strict wrong-note audio or fixed-tempo challenge mode.
- Blender assets.
- ToF/WebHID integration changes; the existing input boundary remains ready for a future adapter.
