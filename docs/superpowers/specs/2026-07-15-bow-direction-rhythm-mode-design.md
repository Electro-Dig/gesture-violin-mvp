# Bow-Direction Rhythm Mode Design

**Date:** 2026-07-15  
**Status:** User-directed redesign; interaction details delegated to implementation.

## Problem

The first guided-song implementation asks one camera-tracked hand to do two difficult things at once:

1. reach a sequence of vertical pitch targets that can be physically far apart;
2. maintain a sufficiently strong horizontal bow gesture.

This creates unnecessary arm travel, amplifies camera jitter, and makes a correct melody feel harder than the reference experience. The current vertical pitch gate and pitch-accuracy score are therefore removed from guided songs. Free play keeps its existing vertical pitch selection.

## Reference Interaction

The supplied Viola the Bird tutorial screenshot shows a time ribbon with note markers approaching a fixed horizontal judgment line. The player changes bow direction when a note reaches that line. Pitch is supplied by the composition rather than selected manually.

The redesign borrows only this general interaction principle. It does not copy the reference code, graphics, assets, audio, or exact layout.

## Considered Approaches

### A. Forgiving bow-direction rhythm rail — selected

The score supplies pitch. Song time advances while a valid bow gesture is engaged, including a short turnaround grace period. Each note alternates the expected bow direction. An early/late timing window judges the direction change, but misses never interrupt the music.

This removes difficult vertical travel, remains compatible with camera, mouse, ToF, and HID input, and preserves meaningful physical authorship.

### B. Fixed-tempo rhythm game

The song advances regardless of player motion. This produces conventional rhythm-game pressure but performs poorly when camera tracking drops frames and is less accessible for hardware experiments. Rejected for the default mode.

### C. Compressed pitch targets plus bowing

Keep vertical pitch control but remap every piece to a narrow central band. This reduces reach but retains the divided-attention problem and still makes weak tracking affect musical flow. Rejected for guided songs; vertical control remains in free play.

## Interaction Contract

### Preparation

- Choose Ode to Joy or Canon in D.
- Start camera, mouse rehearsal, or demo input.
- Show a three-second count-in.
- The first cue asks for a rightward bow. The player may begin anywhere inside the camera frame; no vertical calibration is required.

### Performance

- The melody note always comes from the score.
- A vertical time ribbon sits over the instrument. Upcoming note bars descend toward a fixed judgment line.
- Every note bar carries a left or right arrow. Expected direction alternates by note.
- The player changes horizontal direction when the next bar touches the judgment line.
- A correct turn produces `精准` or `很好`; a late or wrong turn produces `继续` without stopping audio.
- Song time advances at the authored BPM while the hand is actively bowing.
- A 280 ms turnaround grace continues transport while the hand decelerates and reverses, preventing visible stutter at every turn.
- Tracking loss releases audio and freezes transport. Returning to frame resumes from the same position.
- Vertical hand position is ignored by gameplay and scoring.

### Completion

- Total score remains 0–100 with one to three stars.
- Sub-scores become:
  - direction timing: 45 points;
  - bow continuity: 35 points;
  - expression: 20 points.
- There is no game-over state.

## Gesture Tolerance

The shared interpreter becomes easier to activate without becoming jitter-driven:

- bow start speed: reduce from `0.24` to `0.14` normalized screen widths per second;
- bow release speed: reduce from `0.075` to `0.045`;
- full-intensity speed: reduce from `1.4` to `1.05`;
- retain the previous non-zero direction during low-speed turnaround frames;
- guided transport retains a 280 ms bow-engaged grace after a valid moving frame.

The minimum tracking confidence remains unchanged. Camera loss must still release immediately.

## Rhythm Judgment Engine

`GuidedSongEngine` stays a pure state machine but replaces pitch gating with note-direction judgment.

For note index `i`:

```text
expected direction = right when i is even, left when i is odd
```

Each unjudged note accepts a matching direction from `0.32` beats before its start through `0.32` beats after it. The judgment grade is based on absolute timing error:

- `perfect`: error up to `0.12` beats;
- `good`: error up to `0.32` beats;
- `miss`: the late boundary passes without a matching direction.

Once judged, a note cannot score twice. The live timing score is the average of `1.0` for perfect, `0.72` for good, and `0` for miss. Direction changes outside the window are harmless.

## Rhythm-Strip View Model

The HUD receives a pure projection of nearby notes:

```ts
type RhythmCue = {
  noteIndex: number;
  noteName: string;
  expectedDirection: -1 | 1;
  topPercent: number;
  heightPercent: number;
  state: "future" | "window" | "past";
};
```

The judgment line is fixed at 68% of the rail height. Four beats of look-ahead occupy the space above it. Recently passed cues remain briefly below the line, then leave the DOM. Long notes render as longer ruled bars, making rhythm readable without standard notation.

The player's bow cursor stays on the judgment line and moves horizontally with the hand. A large arrow and short Chinese prompt show the next expected direction.

## UI Changes

Remove from guided mode:

- vertical target marker;
- hand-pitch marker;
- alignment percentage;
- “move closer to target pitch” messages.

Add:

- central time ribbon with descending note bars;
- fixed judgment line;
- horizontal bow cursor;
- next-direction arrow and instruction;
- transient judgment feedback;
- result label `方向节奏` in place of `音高控制`.

The visual language remains the existing dark concert-workshop system: ivory notation, vermilion judgment line, amber active cue, restrained glow, and no generic arcade neon.

## Runtime and Compatibility

Camera, mouse, and demo inputs continue to emit `HandFrame`, then `BowingFrame`. Guided songs ignore `BowingFrame.pitch`; free play continues to use it.

The demo source follows score timing by alternating its horizontal sinusoid. It no longer needs a target-pitch override. ToF/HID adapters can later drive the same normalized horizontal `x` value and direction without knowing anything about notes or UI.

## Verification

Automated tests must prove:

- vertical pitch does not affect guided transport or score;
- transport advances at full speed during valid bowing;
- turnaround grace prevents transport stalls;
- note directions alternate;
- perfect, good, and miss windows are stable;
- every note is judged at most once;
- tracking loss freezes without continuity penalty;
- result weighting and labels use direction timing;
- rhythm cues reach the fixed line at their note start;
- weaker horizontal motion starts and sustains bowing.

Browser checks cover camera fallback, mouse bow reversals, demo completion, desktop layout, 390 px mobile layout, result/replay flow, and production HTTPS deployment.

## Out of Scope

- strict failure or life systems;
- fixed-tempo competitive mode;
- manual pitch selection in guided songs;
- copied Viola the Bird assets or audio;
- changes to the free-play pitch model;
- new hardware adapters in this iteration.
