import type { PerformanceState } from "../music/performanceModel";
import { FRIENDLY_SCALE } from "../music/scale";

export type InputMode = "rehearsal" | "demo";
export type StatusTone = "neutral" | "active" | "warning";

export class AppView {
  readonly sceneCanvas: HTMLCanvasElement;
  readonly performanceSurface: HTMLElement;
  readonly chooseSongButton: HTMLButtonElement;
  readonly startFreeButton: HTMLButtonElement;
  readonly muteButton: HTMLButtonElement;
  readonly modeButtons: HTMLButtonElement[];

  private readonly intro: HTMLElement;
  private readonly status: HTMLElement;
  private readonly statusText: HTMLElement;
  private readonly phaseTitle: HTMLElement;
  private readonly phaseHint: HTMLElement;
  private readonly noteName: HTMLElement;
  private readonly frequency: HTMLElement;
  private readonly speedFill: HTMLElement;
  private readonly demoBadge: HTMLElement;
  private readonly noteSteps: HTMLElement[];

  constructor(root: HTMLElement, demoEnabled: boolean) {
    root.innerHTML = template(demoEnabled);

    this.sceneCanvas = requireElement(root, "#violin-scene", HTMLCanvasElement);
    this.performanceSurface = requireElement(root, "#performance-surface", HTMLElement);
    this.chooseSongButton = requireElement(root, "#choose-song", HTMLButtonElement);
    this.startFreeButton = requireElement(root, "#start-free", HTMLButtonElement);
    this.muteButton = requireElement(root, "#audio-toggle", HTMLButtonElement);
    this.modeButtons = Array.from(root.querySelectorAll<HTMLButtonElement>("[data-input-mode]"));
    this.intro = requireElement(root, "#intro", HTMLElement);
    this.status = requireElement(root, "#tracking-status", HTMLElement);
    this.statusText = requireElement(root, "#tracking-status-text", HTMLElement);
    this.phaseTitle = requireElement(root, "#phase-title", HTMLElement);
    this.phaseHint = requireElement(root, "#phase-hint", HTMLElement);
    this.noteName = requireElement(root, "#note-name", HTMLElement);
    this.frequency = requireElement(root, "#frequency", HTMLElement);
    this.speedFill = requireElement(root, "#speed-fill", HTMLElement);
    this.demoBadge = requireElement(root, "#demo-badge", HTMLElement);
    this.noteSteps = Array.from(root.querySelectorAll<HTMLElement>("[data-midi]"));
  }

  hideIntro(): void {
    this.intro.dataset.hidden = "true";
  }

  showIntro(): void {
    this.intro.dataset.hidden = "false";
  }

  setBusy(busy: boolean): void {
    this.startFreeButton.disabled = busy;
    this.startFreeButton.textContent = busy ? "正在校准…" : "自由演奏";
  }

  setMode(mode: InputMode): void {
    this.performanceSurface.dataset.mode = mode;
    this.modeButtons.forEach((button) => {
      const selected = button.dataset.inputMode === mode;
      button.dataset.active = String(selected);
      button.setAttribute("aria-pressed", String(selected));
    });
    this.demoBadge.hidden = mode !== "demo";
  }

  setStatus(message: string, tone: StatusTone = "neutral"): void {
    this.status.dataset.tone = tone;
    this.statusText.textContent = message;
  }

  setAudioState(started: boolean, muted: boolean): void {
    this.muteButton.dataset.active = String(started && !muted);
    this.muteButton.setAttribute("aria-pressed", String(started && !muted));
    this.muteButton.textContent = !started ? "启用声音" : muted ? "声音已静音" : "声音已开启";
  }

  updatePerformance(state: PerformanceState): void {
    this.noteName.textContent = state.noteName;
    this.frequency.textContent = `${Math.round(state.frequencyHz)} Hz`;
    this.speedFill.style.setProperty("--level", `${Math.round(state.intensity * 100)}%`);

    if (state.phase === "bowing") {
      this.phaseTitle.textContent = "正在拉弓";
      this.phaseHint.textContent = state.direction > 0 ? "弓向右 · 保持流动" : "弓向左 · 保持流动";
    } else if (state.phase === "ready") {
      this.phaseTitle.textContent = "音高已就位";
      this.phaseHint.textContent = "水平移动手掌，声音才会出现";
    } else {
      this.phaseTitle.textContent = "等待手掌";
      this.phaseHint.textContent = "上下选音 · 左右拉弓";
    }

    this.noteSteps.forEach((step) => {
      step.dataset.selected = String(Number(step.dataset.midi) === state.midi);
    });
  }

}

function template(demoEnabled: boolean): string {
  const notes = [...FRIENDLY_SCALE]
    .reverse()
    .map(
      (note) => `
        <li data-midi="${note.midi}" data-selected="false">
          <span>${note.noteName}</span><i aria-hidden="true"></i>
        </li>`,
    )
    .join("");

  return `
    <main class="experience-shell">
      <div class="grain" aria-hidden="true"></div>
      <header class="masthead">
        <a class="wordmark" href="./" aria-label="弓弦首页">
          <span class="wordmark-mark" aria-hidden="true">⌁</span>
          <span><b>弓弦</b><small>GESTURE VIOLIN · STUDY 01</small></span>
        </a>
        <div id="tracking-status" class="tracking-status" data-tone="neutral" role="status">
          <i aria-hidden="true"></i><span id="tracking-status-text">等待开始</span>
        </div>
        <button id="audio-toggle" class="text-control" type="button" aria-pressed="false">启用声音</button>
      </header>

      <section id="performance-surface" class="performance-surface" data-mode="${demoEnabled ? "demo" : "rehearsal"}">
        <canvas id="violin-scene" aria-label="响应手势的原创三维小提琴"></canvas>
        <div class="stage-vignette" aria-hidden="true"></div>
        <div id="demo-badge" class="demo-badge" ${demoEnabled ? "" : "hidden"}>AUTO DEMO · 非触屏输入</div>

        <div class="movement-copy" aria-hidden="true">
          <span>01 / VERTICAL</span><b>上下</b><em>选择音高</em>
          <span>02 / HORIZONTAL</span><b>左右</b><em>驱动琴弓</em>
        </div>

        <aside class="note-ladder" aria-label="可演奏音阶">
          <span class="rail-label">PITCH / 音高</span>
          <ol>${notes}</ol>
        </aside>

        <section class="performance-readout" aria-live="polite">
          <div class="note-readout">
            <span>当前音</span><strong id="note-name">G4</strong><small id="frequency">392 Hz</small>
          </div>
          <div class="phase-readout">
            <span id="phase-title">等待手掌</span><small id="phase-hint">上下选音 · 左右拉弓</small>
          </div>
          <div class="bow-meter" aria-label="拉弓强度">
            <span>BOW ENERGY</span>
            <i><b id="speed-fill" style="--level: 0%"></b></i>
          </div>
        </section>

        <div class="mode-switch" role="group" aria-label="输入方式">
          <button type="button" data-input-mode="rehearsal" data-active="${String(!demoEnabled)}" aria-pressed="${String(!demoEnabled)}">触屏 / 鼠标</button>
          ${demoEnabled ? '<button type="button" data-input-mode="demo" data-active="true" aria-pressed="true">自动演示</button>' : ""}
        </div>

        <section id="guided-hud" class="guided-hud" aria-label="曲目演奏提示" hidden>
          <div class="guided-piece">
            <span>NOW PERFORMING</span>
            <strong id="guided-song-title">欢乐颂</strong>
            <small id="guided-song-composer">Ludwig van Beethoven</small>
          </div>
          <button id="hud-songs" class="hud-link" type="button">返回曲目</button>
          <div class="guided-notes" aria-live="polite">
            <span>CURRENT / 当前</span><strong id="guided-note">E4</strong>
            <small>NEXT&nbsp;&nbsp;<b id="guided-upcoming">E4 · F4 · G4</b></small>
          </div>
          <div id="rhythm-strip" class="rhythm-strip" aria-label="换弓节奏轨">
            <i class="rhythm-spine" aria-hidden="true"></i>
            <div id="rhythm-cues" class="rhythm-cues"></div>
            <div class="judgment-line"><span>在这里换弓</span></div>
            <div id="bow-cursor" class="bow-cursor"><i></i></div>
          </div>
          <div class="direction-prompt">
            <span>NEXT BOW / 下一弓</span>
            <strong id="direction-symbol">→</strong>
            <b id="direction-message">向右换弓</b>
            <small id="rhythm-helper">音符到达红线时，改变拉弓方向</small>
          </div>
          <div id="timing-feedback" class="timing-feedback" data-tone="neutral">准备</div>
          <div class="guided-transport">
            <span id="guided-progress-label">1 / 48 拍</span>
            <i id="guided-progress" style="--progress: 0%"><b></b></i>
          </div>
          <div class="guided-live-score"><span>SCORE</span><strong id="guided-score">100</strong></div>
        </section>

        <div id="guided-count-in" class="guided-count-in" aria-live="assertive" hidden>
          <span>准备</span><strong id="count-number">3</strong><small>看准红线 · 音符抵达时改变拉弓方向</small>
        </div>
      </section>

      <footer class="footer-line">
        <span>ONE HAND · ONE BOW · EIGHT NOTES</span>
        <span>离线运行 · 不联网 · 不上传</span>
      </footer>

      <section id="intro" class="intro" data-hidden="${String(demoEnabled)}" aria-labelledby="intro-title">
        <div class="intro-rule" aria-hidden="true"><span>INTERACTIVE INSTRUMENT / 001</span></div>
        <div class="intro-copy">
          <p class="kicker">把一次滑动，变成一支琴弓</p>
          <h1 id="intro-title">一手<br><i>成弓</i></h1>
          <p class="intro-lead">手指或鼠标上下选择音高，左右拖动才会发声。停下，琴声也随之收束。</p>
          <ol class="gesture-steps">
            <li><b>01</b><span>按住舞台<small>触屏或鼠标均可</small></span></li>
            <li><b>02</b><span>上下定位<small>八个友好音符</small></span></li>
            <li><b>03</b><span>左右拉弓<small>速度决定力度</small></span></li>
          </ol>
          <div class="intro-actions">
            <button id="choose-song" class="primary-action" type="button">曲目演奏</button>
            <button id="start-free" class="secondary-action" type="button">自由演奏</button>
          </div>
          <small class="privacy-note">小红书版完全离线 · 触屏与鼠标兼容 · 点击后启用声音</small>
        </div>
        <div class="intro-index" aria-hidden="true"><b>弦</b><span>G—V / 2026</span></div>
      </section>

      <section id="song-select" class="song-select" aria-labelledby="song-select-title" hidden>
        <div class="song-select-head">
          <span>GUIDED PERFORMANCE / 曲目</span>
          <button id="close-songs" type="button" aria-label="返回">返回</button>
        </div>
        <div class="song-select-copy">
          <p>不用寻找音高，只需跟随节奏换弓</p>
          <h2 id="song-select-title">跟随欢乐颂<br><i>开始演奏</i></h2>
          <small>旋律会自动保持准确；音符到达红线时，改变左右拉弓方向。</small>
        </div>
        <div class="song-list">
          <button type="button" data-song-id="ode-to-joy">
            <span>01</span><strong>欢乐颂<small>Ludwig van Beethoven</small></strong>
            <em>约 40 秒 · 入门</em><i>开始 →</i>
          </button>
        </div>
        <footer>《欢乐颂》采用原创精简编配与浏览器实时合成，不使用录音采样。</footer>
      </section>

      <section id="guided-result" class="guided-result" aria-labelledby="result-heading" hidden>
        <div class="result-card">
          <span>PERFORMANCE COMPLETE</span>
          <h2 id="result-heading">演奏完成</h2>
          <p id="result-title">欢乐颂</p>
          <div class="result-score"><strong id="result-score">86</strong><small>/ 100</small></div>
          <div class="result-stars" aria-label="星级">
            <i data-result-star data-earned="true">★</i><i data-result-star data-earned="true">★</i><i data-result-star data-earned="false">★</i>
          </div>
          <dl>
            <div><dt>方向节奏</dt><dd id="result-timing">88</dd></div>
            <div><dt>拉弓连贯</dt><dd id="result-continuity">84</dd></div>
            <div><dt>力度表现</dt><dd id="result-expression">82</dd></div>
          </dl>
          <div class="result-actions">
            <button id="replay-song" class="primary-action" type="button">再演奏一次</button>
            <button id="result-songs" class="secondary-action" type="button">返回曲目</button>
            <button id="result-free" class="secondary-action" type="button">自由演奏</button>
          </div>
        </div>
      </section>
    </main>`;
}

function requireElement<T extends Element>(
  root: ParentNode,
  selector: string,
  constructor: { new (): T },
): T {
  const element = root.querySelector(selector);
  if (!(element instanceof constructor)) {
    throw new Error(`Missing required element: ${selector}`);
  }
  return element;
}
