# 2026-07-22 silken bow articulation verification

## Scope

Implementation commits:

- `f9af0fd` binds sampled attacks to guided score-note articulations.
- `51eeaeb` softens the sampled violin signal path.
- `a31c221` refines the violin varnish, lighting, and stable stage motion.
- `761bd71` adds the bow-hair breathing rhythm UI.

## Automated verification

Fresh commands run from `feature/gesture-violin-mvp`:

- `npm.cmd test`: 114 tests passed, 0 failed.
- `npm.cmd run build`: completed with Vite 8.1.4; only the existing >500 kB chunk-size advisory was reported.
- `npm.cmd run audio:import`: deterministically imported 12 violin samples totaling 1,450,008 bytes.
- `git diff --exit-code -- public/audio/violin/vsco2-ce`: no generated sample drift.
- `git diff --check`: no whitespace errors.

Production bundle:

- `dist/index.html`: 579 bytes.
- `dist/assets/index-DUh6LQHG.css`: 27,331 bytes.
- `dist/assets/index-NIIB6DKG.js`: 784,383 bytes.

## Articulation behavior

The regression suite proves all three required boundaries:

1. Reversing the bow early inside one guided score note keeps the existing sampled voice and does not reattack the previous note.
2. Advancing to the next guided score note creates a new articulation even when the MIDI pitch repeats.
3. Free performance retains direction-based bow attacks.

The sampled voice now uses a 50 ms bow crossfade, 140 ms release, restrained 8% generated bow-noise contribution, a -2.4 dB presence cut at 2.65 kHz, and a 6.6 kHz low-pass stage before the dry/room blend.

## Browser and responsive verification

Verified with agent-browser 0.32.3 / Chromium against both the local production build and the deployed draft:

- Desktop guided route at 1280 x 720: the violin remains right-weighted; the orbit rails, pearl cues, bow-hair progress line, and one-shot judgment breath remain legible without overlapping the score or controls.
- Portrait route at 390 x 844: `document.documentElement.scrollWidth === innerWidth === 390`; controls and score remain inside the viewport.
- Root route `/`: `data-mode=camera`, the camera input button is active and `aria-pressed=true`, and the camera video is visible. The delivered root URL therefore opens the real gesture-interaction path rather than `?demo=1`.
- Reduced-motion emulation: `prefers-reduced-motion: reduce` is true and the orbit hit-zone animation resolves to `none`.
- Browser error log after local and deployed interactions: empty.
- After the explicit user gesture on “启用声音”, the deployed page changed to “声音已开启”; all twelve MP3 sample requests returned HTTP 200.

Representative deployed resource checks:

- `/`: HTTP 200, 579 bytes.
- `/assets/index-NIIB6DKG.js`: HTTP 200, 784,383 bytes.
- `/assets/index-DUh6LQHG.css`: HTTP 200, 27,331 bytes.
- `/audio/violin/vsco2-ce/c4-p.mp3`: HTTP 200, 120,834 bytes.
- `/vendor/mediapipe-models/hand_landmarker.task`: HTTP 200, 7,819,105 bytes.
- `/vendor/tasks-vision/wasm/vision_wasm_internal.wasm`: HTTP 200, 11,153,617 bytes.

## Draft deployment and production preservation

Draft deploy:

- ID: `6a602c12c8b3f856a5cc10f6`
- State: `ready`
- Context: `deploy-preview`
- `published_at`: empty
- Gesture-interactive root: <https://6a602c12c8b3f856a5cc10f6--gesture-violin-lab-664.netlify.app/>
- Automatic visual test route: <https://6a602c12c8b3f856a5cc10f6--gesture-violin-lab-664.netlify.app/?demo=1>

The draft was created through Netlify's SHA-1 digest deployment API with `draft: true` and forward-slash paths after the Netlify CLI stalled without output.

Production was read before and after the draft deploy:

- Production URL: <https://gesture-violin-lab-664.netlify.app>
- Published deploy ID before: `6a573a85c8c09800d5e06301`
- Published deploy ID after: `6a573a85c8c09800d5e06301`

The existing production deployment was not replaced.

## Subjective review boundary

The visual pass was inspected at desktop and portrait sizes and matches the approved “弓丝呼吸” direction: lower-contrast rails, ivory cue pearls, lighter typography, stable instrument posture, and restrained warm varnish lighting. Audio signal-chain changes and asset delivery are verified automatically; the final judgment of whether the tone feels sufficiently silky and elegant requires the user's listening test on the draft link.
