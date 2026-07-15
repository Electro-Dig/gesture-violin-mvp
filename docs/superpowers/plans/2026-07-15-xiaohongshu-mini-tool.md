# Xiaohongshu Mini Tool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce an offline Xiaohongshu Builder Hub ZIP containing the single-song, touch-first Gesture Violin edition.

**Architecture:** Convert this isolated branch into the Xiaohongshu-specific runtime instead of adding a runtime flag. Remove MediaPipe/WASM and Canon from the reachable application graph, make touch rehearsal the default input, and build with relative Vite paths before validating and zipping only `dist` contents.

**Tech Stack:** TypeScript, Vite, Three.js, Web Audio API, Pointer Events, Node test runner, PowerShell ZIP tooling.

---

### Task 1: Lock the Xiaohongshu contract with failing tests

**Files:**
- Create: `src/tests/xiaohongshuEdition.test.ts`
- Modify: `src/tests/songCatalogue.test.ts`

- [ ] Add assertions that the catalogue contains only `ode-to-joy`, `package.json` has no MediaPipe dependency, `appView.ts` contains no camera or Canon UI, `app.ts` contains no `HandTracker`, `vite.config.ts` uses `base: "./"`, and `index.html` includes `viewport-fit=cover`.
- [ ] Run `pnpm exec tsx --test src/tests/songCatalogue.test.ts src/tests/xiaohongshuEdition.test.ts` and confirm failures describe the current two-song/camera/absolute-path implementation.

### Task 2: Remove Canon and the WASM camera path

**Files:**
- Modify: `src/music/songTypes.ts`
- Modify: `src/music/songs/catalogue.ts`
- Modify: `src/ui/appView.ts`
- Modify: `src/app.ts`
- Modify: `src/styles.css`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Delete: `src/music/songs/canonInD.ts`
- Delete: `src/gesture/handTracker.ts`
- Delete: `src/gesture/handResultMapper.ts`
- Delete: `src/tests/handResultMapper.test.ts`
- Delete: `public/vendor/`

- [ ] Make `SongId` equal `"ode-to-joy"` and export only `ODE_TO_JOY` from the catalogue.
- [ ] Remove camera DOM, tracker lifecycle, retry/error flow and MediaPipe dependency; default to rehearsal input and label it `触屏 / 鼠标`.
- [ ] Update intro, footer, busy and song-selection copy for offline touch use and a single public-domain arrangement.
- [ ] Add safe-area padding and touch-callout rules while preserving Pointer Events.
- [ ] Run the focused tests until green, then run `pnpm test`.

### Task 3: Make the production build offline-container compliant

**Files:**
- Modify: `vite.config.ts`
- Modify: `index.html`
- Modify: `.gitignore`
- Modify: `README.md`

- [ ] Configure Vite `base: "./"`, disable source maps, and ensure the HTML entry uses a relative source path.
- [ ] Add `viewport-fit=cover`, `maximum-scale=1.0` and `user-scalable=no` to the viewport.
- [ ] Ignore `.codex/` and `artifacts/`, and document the Xiaohongshu input/camera limitation without changing Netlify.
- [ ] Run the focused tests, full tests and `pnpm build`.

### Task 4: Validate the final static output and browser behavior

**Files:**
- Inspect: `dist/index.html`
- Inspect: `dist/assets/*`

- [ ] Scan `dist` for the official forbidden patterns: network APIs, hardware APIs, Worker, WebAssembly, external URLs, iframe/object, inline scripts and absolute asset paths.
- [ ] Confirm every referenced asset exists, all extensions are on the official whitelist, `index.html` is at the root, total size is below 2MB and no source maps/configuration files exist.
- [ ] Run desktop and 390×844 browser smoke tests for the intro, single-song selection, touch/pointer free play and the full 《欢乐颂》 demo/result flow.

### Task 5: Package and verify the upload ZIP

**Files:**
- Create artifact: `artifacts/gesture-violin-xhs-mini-tool.zip`

- [ ] Enter `dist` and compress its contents rather than the directory itself.
- [ ] Open the ZIP and assert root `index.html`, allowed extensions only, no nested wrapper, no hidden/development files and total compressed/uncompressed sizes within limits.
- [ ] Run `pnpm test`, `pnpm build`, `git diff --check` and report the absolute ZIP path, branch, worktree, official compliance summary and known camera limitation.
