# Silken Bow Articulation and Stage Design

## Context

The sampled violin voice is more realistic than the original synthesized voice, but two issues remain:

1. The sampled sound is slightly rough and over-emphasizes bow texture.
2. In guided performance, an early bow-direction reversal restarts the current score note before the transport reaches the next note. The restarted sample overlaps the existing instance and is heard as a repeated previous note.

The circular rhythm rail communicates bow timing successfully, while the surrounding interface is visually heavy and the saturated orange instrument reads as less refined than a violin performance should feel.

## Goals

- Keep the current note sounding smoothly when the player reverses early in guided mode.
- Trigger a fresh sampled bow only at the actual score-note boundary, including boundaries between repeated pitches.
- Preserve responsive, direction-based articulation in free performance.
- Make the sampled violin smoother and warmer without hiding its attack or adding obvious latency.
- Retain the full-screen camera background, right-positioned violin, and circular rhythm concept.
- Restyle the guided stage around the approved “Bow Hair Breathing” direction: light, refined, and visibly connected to violin materials.
- Publish a non-production draft whose root URL defaults to normal camera gesture interaction.

## Non-goals

- Do not change MediaPipe tracking, camera inference, gesture smoothing thresholds, score timing, or judgment windows.
- Do not add a second-hand gesture system in this iteration.
- Do not replace the VSCO 2 CE sample set or add a larger sample download.
- Do not overwrite the current production deployment.

## Root Cause

`SampledViolinVoice` currently calls `needsFreshBow` on every audio update. `needsFreshBow` treats any non-zero direction reversal as a new articulation. In guided mode, `mapGuidedPerformance` continues to expose `guided.currentNote.midi` until the transport crosses the next score-note boundary. Therefore an early reversal creates a new sample instance for the same previous note; the new instance attacks while the old instance fades, producing the audible repeat and overlap.

Direction alone is not a reliable articulation boundary in guided mode. The score-note index is the stable source of truth.

## Articulation Model

`PerformanceState` will gain an optional guided articulation identifier.

- `mapGuidedPerformance` sets the identifier from `GuidedSongFrame.currentNoteIndex`.
- `mapPerformance` leaves it absent so free performance keeps direction-based bow articulation.
- The sampled-voice frame carries this identifier into the pure articulation model.
- When both adjacent frames contain guided identifiers, a fresh bow is requested only when the identifier changes, the pitch changes, or the voice restarts after silence. A raw direction reversal inside the same identifier does not restart the sample.
- When no guided identifier is present, the existing free-performance direction reversal remains an articulation boundary.

This makes an early guided reversal a preparatory gesture: direction and intensity continue updating, but the current sample is not restarted. When the transport reaches the next note, the changed identifier starts one new bow. Repeated pitches still re-articulate because their identifiers differ even when their MIDI values match.

## Sampled Tone Treatment

The sampled voice remains the default backend, with the existing instant synthetic fallback and asynchronous sample load.

The sampled signal path will receive three restrained changes:

1. Reduce the synthetic bow-noise contribution so recorded sample detail remains primary.
2. Add a warm tone stage that gently reduces the upper-mid roughness and rolls off only the highest edge. The filter must remain broad and subtle so attacks stay legible.
3. Slightly lengthen note-boundary crossfades and the release tail, and use a modestly warmer short room balance. These timings must remain short enough to avoid perceived gesture latency.

The implementation will expose pure tone constants or mapping helpers where practical so the intended bounds can be tested without mocking Web Audio internals. Sample-load failure behavior remains unchanged: the synth stays audible, the sampled backend does not partially activate, and the UI shows a non-blocking notice.

## Visual Direction: Bow Hair Breathing

### Palette and Materials

- Replace the dominant neon orange with dark maple, aged varnish red, soft copper, and warm ivory.
- Lower emissive intensity on the violin body and bow. Use clearcoat highlights and restrained edge light to communicate polished wood instead of glowing plastic.
- Keep the camera image subdued enough for legibility while preserving recognizable skin and room tones.

### Rhythm Orbit

- Preserve the circular rhythm geometry and hit location.
- Render the rail as two fine bow-hair lines rather than heavy graphic rings.
- Treat upcoming notes as small ivory “pearls,” with the current cue receiving a copper core and a restrained halo.
- On a judgment, let the hit area expand and fade once instead of displaying a prominent rectangular badge.
- Keep labels readable, but reduce the number of simultaneously dominant elements.

### Information Hierarchy

- Keep the piece title and bow-direction prompt on the left with more negative space and hairline dividers.
- Keep the current note near the upper center, with upcoming notes secondary and quieter.
- Convert the bottom progress track into a bundle-like bow-hair line that gradually takes on copper color. Preserve measure ticks and numerical progress.
- Retain the score at the lower right, but reduce its competition with the instrument.

### Motion

- Remove the whole-instrument scale pulse.
- Concentrate motion in the bow hair, string highlight, current orbit arc, and a single hit-zone breathing response.
- Use low-amplitude, short-duration motion so the interface feels alive without appearing game-like.
- Respect `prefers-reduced-motion` and preserve all guidance in a static state.

## Component Boundaries

- `src/music/performanceModel.ts`: defines the optional articulation identifier for audio consumers.
- `src/music/guidedPerformance.ts`: maps the score-note index into the guided performance state.
- `src/audio/sampleVoiceModel.ts`: decides whether an update is a true articulation boundary and exposes bounded tone/crossfade values.
- `src/audio/sampledViolinVoice.ts`: applies the articulation decision and warm signal chain.
- `src/scene/violinScene.ts`: updates varnish, bow, string, halo, and motion treatment without changing gesture placement.
- `src/styles.css`: implements the Bow Hair Breathing palette, hierarchy, orbit, progress line, feedback, and responsive/reduced-motion behavior.
- Existing view classes continue to own DOM updates. Markup changes are limited to decorative elements or semantic hooks needed by the approved presentation.

## Data Flow

```text
Camera hand frame
  -> BowingGestureInterpreter
  -> GuidedSongEngine (transport and current note index)
  -> mapGuidedPerformance (pitch plus articulation identifier)
  -> SampledViolinVoice (one attack per real score boundary)
  -> ViolinScene and GuidedView (visual expression and rhythm feedback)
```

## Error Handling and Performance

- The articulation identifier is optional so free performance and older call sites remain valid during migration.
- Invalid or missing sample assets continue to fail the sampled backend as a unit and leave the synth fallback active.
- The visual restyle adds no image downloads, tracking work, or per-frame layout reads.
- New visual motion uses CSS transforms/opacity or existing Three.js animation state and avoids changing the camera inference loop.

## Test Strategy

Implementation follows red-green-refactor.

- Add a failing pure-model test proving that reversing direction inside one guided articulation does not request a fresh bow.
- Add a failing test proving that a changed articulation identifier retriggers repeated MIDI notes.
- Preserve coverage for voice start, pitch changes, free-mode direction reversals, silence, continuation, and release.
- Add or update guided-performance tests proving the score-note index becomes the articulation identifier.
- Add focused UI/model assertions for any new semantic state used by the orbit or feedback animation.
- Run the full unit test suite and production build.
- Check desktop guided mode, normal camera root mode, mouse rehearsal fallback, reduced motion, and a narrow viewport in a real browser.

## Deployment and Acceptance Criteria

Create a Netlify draft deploy only. The draft root URL must:

- open in normal camera mode without `?demo=1`;
- request camera permission and accept live hand gestures;
- load the sampled violin by default while retaining `?tone=synth` as a fallback comparison;
- keep the violin on the right and the circular rhythm rail visible in guided performance;
- play no duplicate previous-note attack when the player reverses before the next hit point;
- sound smoother and less gritty while remaining responsive;
- preserve the current production site unchanged.
