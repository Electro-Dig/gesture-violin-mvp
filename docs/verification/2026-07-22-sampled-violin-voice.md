# 2026-07-22 sampled violin voice verification

## Scope

- Code under test: `e92edacdee85bc216d5ce1d9ca4b4dcab58e5745`
- Platform: Windows 10/11 x64
- Browser automation: `agent-browser 0.32.3`
- Browser user agent: HeadlessChrome 150.0.0.0
- Local production preview: `http://127.0.0.1:4174/`
- Production Netlify site was not modified during this verification.

## Automated checks

`pnpm test`:

- 107 tests passed
- 0 failed, skipped, cancelled, or todo
- Includes the existing gesture, guided-song, MIDI, stage, and audio model coverage plus sampled-root mapping, p/f mixing, articulation boundaries, deterministic room impulse, source/output hashes, source-lock enforcement, all-or-nothing decoding, backend selection, and failure notification.

`pnpm build`:

- TypeScript strict check passed.
- Vite production build passed with 46 transformed modules.
- JavaScript: `dist/assets/index-D5sMGijJ.js`, 783.05 kB / 208.78 kB gzip.
- CSS: `dist/assets/index-DbwzAvNe.css`, 23.80 kB / 6.35 kB gzip.
- The existing Vite warning for a JavaScript chunk above 500 kB remains; the sampled-voice integration added about 11.6 kB uncompressed to the previous main chunk.

`pnpm audio:import`:

- 12 source WAV hashes matched `audio-sources/vsco2-ce/source-lock.json`.
- 12 MP3 runtime samples regenerated successfully.
- Total runtime audio payload: 1,450,008 bytes, below the 1,500,000-byte budget.
- A second import produced no diff in the source lock, generated TypeScript manifest, or runtime MP3 directory.

## Browser checks

### Default sampled mode

URL: `http://127.0.0.1:4174/?demo=1`

- The initial control was `启用声音`.
- After the click, the control changed to `声音已开启`.
- All twelve `/audio/violin/vsco2-ce/*.mp3` fetches returned HTTP 200.
- The non-blocking error banner remained hidden.

### Forced synth A/B mode

URL: `http://127.0.0.1:4174/?demo=1&tone=synth`

- After the click, the control changed to `声音已开启`.
- No sample fetch requests were captured, confirming that synth-only mode bypasses sample loading.

### Failed-sample fallback

The browser route for `**/c4-p.mp3` was deliberately aborted before opening the default demo URL.

- The control still changed to `声音已开启`, confirming that the immediate synth path remained available.
- The banner displayed `真实提琴音色加载失败 · 已自动使用合成音色`.
- The camera retry button stayed hidden, so the audio notice did not masquerade as a camera failure.

## Manual listening boundary

Headless browser automation verifies requests, decoding readiness behavior, controls, and fallback state, but it cannot make a trustworthy subjective judgment about violin timbre, audible crossfade seams, or output-device latency. The new draft deployment therefore needs a human A/B listen between the default URL and `?tone=synth`; this is explicitly not marked as an automated pass.
