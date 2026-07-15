import { StringSynth } from "./audio/stringSynth";
import { BowingGestureInterpreter } from "./gesture/bowingGestureInterpreter";
import { DemoHandSource } from "./gesture/demoHandSource";
import { MouseRehearsalSource, normalizePointer } from "./gesture/mouseRehearsalSource";
import type { BowingFrame, HandFrame } from "./gesture/types";
import { mapGuidedPerformance } from "./music/guidedPerformance";
import { GuidedSongEngine, type GuidedSongFrame } from "./music/guidedSongEngine";
import { mapPerformance, type PerformanceState } from "./music/performanceModel";
import { getSong } from "./music/songs/catalogue";
import type { SongDefinition } from "./music/songTypes";
import { ViolinScene } from "./scene/violinScene";
import { AppView, type InputMode } from "./ui/appView";
import { GuidedView } from "./ui/guidedView";

export class GestureViolinApp {
  private readonly view: AppView;
  private readonly guidedView: GuidedView;
  private readonly scene: ViolinScene;
  private readonly synth = new StringSynth();
  private readonly mouse = new MouseRehearsalSource();
  private readonly demo = new DemoHandSource();
  private readonly interpreter = new BowingGestureInterpreter();
  private mode: InputMode;
  private lastPerformance: PerformanceState;
  private lastUiUpdateMs = Number.NEGATIVE_INFINITY;
  private frameRequest = 0;
  private audioStarted = false;
  private muted = false;
  private inputReady = false;
  private playMode: "free" | "guided" = "free";
  private selectedSong: SongDefinition | null = null;
  private guidedEngine: GuidedSongEngine | null = null;
  private guidedFrame: GuidedSongFrame | null = null;
  private resultShown = false;
  private menuOpen = false;

  constructor(root: HTMLElement) {
    const demoEnabled = new URLSearchParams(window.location.search).get("demo") === "1";
    this.mode = demoEnabled ? "demo" : "rehearsal";
    this.view = new AppView(root, demoEnabled);
    this.guidedView = new GuidedView(root);
    this.scene = new ViolinScene(this.view.sceneCanvas);
    this.lastPerformance = mapPerformance(this.interpreter.reset(performance.now()));

    this.bindControls();
    this.view.setMode(this.mode);
    this.view.performanceSurface.dataset.playMode = "free";
    this.view.setAudioState(false, false);
    this.view.updatePerformance(this.lastPerformance);
    this.scene.update(this.lastPerformance);
    this.scene.start();

    if (demoEnabled) {
      this.inputReady = true;
      this.beginGuided(getSong("ode-to-joy"), performance.now());
      this.view.setStatus("自动演示 · 欢乐颂引导演奏", "active");
    }

    this.frameRequest = requestAnimationFrame(this.tick);
  }

  private bindControls(): void {
    this.view.chooseSongButton.addEventListener("click", () => this.openSongSelect());
    this.view.startFreeButton.addEventListener("click", () => void this.startFreePerformance());
    this.view.muteButton.addEventListener("click", () => void this.toggleAudio());
    this.guidedView.songButtons.forEach((button) => {
      button.addEventListener("click", () => {
        void this.startGuided(getSong(this.guidedView.selectedSongId(button)));
      });
    });
    this.guidedView.closeSongsButton.addEventListener("click", () => {
      this.guidedView.hideSongSelect();
      this.menuOpen = false;
      if (!this.inputReady) this.view.showIntro();
    });
    this.guidedView.hudSongsButton.addEventListener("click", () => this.chooseAnotherSong());
    this.guidedView.resultSongsButton.addEventListener("click", () => this.chooseAnotherSong());
    this.guidedView.resultFreeButton.addEventListener("click", () => void this.startFreePerformance());
    this.guidedView.replayButton.addEventListener("click", () => {
      if (this.selectedSong) void this.startGuided(this.selectedSong, true);
    });

    this.view.modeButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const mode = button.dataset.inputMode as InputMode;
        if (mode === "rehearsal") void this.activateRehearsal();
        if (mode === "demo") void this.activateDemo();
      });
    });

    this.view.performanceSurface.addEventListener("pointerdown", (event) => {
      if (this.mode !== "rehearsal") return;
      const position = normalizePointer(
        event.clientX,
        event.clientY,
        this.view.performanceSurface.getBoundingClientRect(),
      );
      this.view.performanceSurface.setPointerCapture(event.pointerId);
      this.mouse.press(position.x, position.y);
    });
    this.view.performanceSurface.addEventListener("pointermove", (event) => {
      if (this.mode !== "rehearsal" || !this.view.performanceSurface.hasPointerCapture(event.pointerId)) return;
      const position = normalizePointer(
        event.clientX,
        event.clientY,
        this.view.performanceSurface.getBoundingClientRect(),
      );
      this.mouse.move(position.x, position.y);
    });
    const releasePointer = (event: PointerEvent) => {
      if (this.view.performanceSurface.hasPointerCapture(event.pointerId)) {
        this.view.performanceSurface.releasePointerCapture(event.pointerId);
      }
      this.mouse.release();
    };
    this.view.performanceSurface.addEventListener("pointerup", releasePointer);
    this.view.performanceSurface.addEventListener("pointercancel", releasePointer);

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.releaseVoice(performance.now());
    });
    window.addEventListener("pagehide", () => void this.dispose(), { once: true });
  }

  private async startGuided(song: SongDefinition, reuseInput = false): Promise<void> {
    this.view.hideIntro();
    this.guidedView.setBusy(true);
    try {
      if (!this.inputReady && !reuseInput) {
        await this.activateRehearsal();
      } else {
        await this.ensureAudio();
      }
      this.beginGuided(song, performance.now());
    } finally {
      this.guidedView.setBusy(false);
    }
  }

  private beginGuided(song: SongDefinition, nowMs: number): void {
    this.menuOpen = false;
    this.playMode = "guided";
    this.selectedSong = song;
    this.guidedEngine = new GuidedSongEngine(song);
    const bowing = this.interpreter.reset(nowMs);
    this.guidedFrame = this.guidedEngine.start(nowMs);
    this.lastPerformance = mapGuidedPerformance(bowing, this.guidedFrame);
    this.resultShown = false;
    this.view.performanceSurface.dataset.playMode = "guided";
    this.guidedView.start(song);
    this.guidedView.update(song, this.guidedFrame);
    this.scene.setGuidance(judgmentGuidance(this.guidedFrame));
    this.scene.update(this.lastPerformance);
    this.synth.update(this.lastPerformance);
  }

  private async startFreePerformance(): Promise<void> {
    this.view.hideIntro();
    this.guidedView.hide();
    this.menuOpen = false;
    if (!this.inputReady) {
      await this.activateRehearsal();
    } else {
      await this.ensureAudio();
    }
    this.playMode = "free";
    this.guidedEngine = null;
    this.guidedFrame = null;
    this.resultShown = false;
    this.view.performanceSurface.dataset.playMode = "free";
    this.lastPerformance = mapPerformance(this.interpreter.reset(performance.now()));
    this.scene.setGuidance(null);
    this.scene.update(this.lastPerformance);
    this.synth.update(this.lastPerformance);
    this.updateStatus();
  }

  private chooseAnotherSong(): void {
    this.releaseVoice(performance.now());
    this.playMode = "free";
    this.guidedEngine = null;
    this.guidedFrame = null;
    this.resultShown = false;
    this.view.performanceSurface.dataset.playMode = "free";
    this.scene.setGuidance(null);
    this.menuOpen = true;
    this.guidedView.showSongSelect();
  }

  private openSongSelect(): void {
    this.menuOpen = true;
    this.releaseVoice(performance.now());
    this.guidedView.showSongSelect();
  }

  private updateStatus(): void {
    if (this.playMode === "guided" && this.guidedFrame) {
      if (this.guidedFrame.phase === "countIn") {
        this.view.setStatus(`准备演奏 · ${this.guidedFrame.countdown}`, "neutral");
      } else if (this.guidedFrame.phase === "complete") {
        this.view.setStatus("演奏完成", "active");
      } else if (this.lastPerformance.phase === "idle") {
        this.view.setStatus("按住舞台 · 曲目已暂停", "neutral");
      } else if (this.lastPerformance.phase === "ready") {
        this.view.setStatus("保持按住 · 左右拖动开始拉弓", "neutral");
      } else {
        this.view.setStatus(
          this.guidedFrame.lastJudgment === "miss"
            ? "正在演奏 · 看红线准备换弓"
            : "正在演奏 · 跟随方向节奏",
          "active",
        );
      }
      return;
    }

    if (this.mode === "rehearsal") {
      this.view.setStatus(
        this.lastPerformance.phase === "idle"
          ? "按住舞台开始演奏"
          : this.lastPerformance.phase === "ready"
            ? "触点已就位 · 左右拖动开始拉弓"
            : "自由演奏中",
        this.lastPerformance.phase === "bowing" ? "active" : "neutral",
      );
    }
  }

  private async activateRehearsal(): Promise<void> {
    await this.ensureAudio();
    this.mode = "rehearsal";
    this.inputReady = true;
    this.mouse.release();
    this.interpreter.reset(performance.now());
    this.view.hideIntro();
    this.view.setMode("rehearsal");
    this.view.setStatus("按住舞台拖动 · 上下选音，左右发声", "active");
  }

  private async activateDemo(): Promise<void> {
    await this.ensureAudio();
    this.mode = "demo";
    this.inputReady = true;
    this.interpreter.reset(performance.now());
    this.view.hideIntro();
    this.view.setMode("demo");
    this.view.setStatus("自动演示 · 正在模拟单手拉弓", "active");
  }

  private async ensureAudio(): Promise<void> {
    if (this.audioStarted) return;
    try {
      await this.synth.start();
      this.audioStarted = true;
      this.muted = false;
      this.view.setAudioState(true, false);
    } catch {
      this.view.setStatus("声音启动失败 · 仍可体验视觉交互", "warning");
    }
  }

  private async toggleAudio(): Promise<void> {
    if (!this.audioStarted) {
      await this.ensureAudio();
      return;
    }
    this.muted = !this.muted;
    this.synth.setMuted(this.muted);
    this.view.setAudioState(true, this.muted);
  }

  private readonly tick = (nowMs: number): void => {
    if (this.menuOpen) {
      this.frameRequest = requestAnimationFrame(this.tick);
      return;
    }
    if (this.mode === "rehearsal") {
      this.updateFromHand(this.mouse.sample(nowMs), nowMs);
    } else {
      if (this.playMode === "guided" && this.guidedFrame && this.selectedSong) {
        const currentIndex = this.guidedFrame.currentNoteIndex;
        const currentNote = this.guidedFrame.currentNote;
        const nextNote = this.selectedSong.melody[currentIndex + 1];
        const strokeEndBeat = nextNote?.startBeat ?? currentNote.startBeat + currentNote.durationBeats;
        const strokeBeats = Math.max(strokeEndBeat - currentNote.startBeat, 0.001);
        this.updateFromHand(
          this.demo.sample(nowMs, "guided", {
            active: this.guidedFrame.phase === "playing",
            direction: this.guidedFrame.expectedDirection,
            durationMs: strokeBeats * (60_000 / this.selectedSong.bpm),
            noteIndex: currentIndex,
          }),
          nowMs,
        );
      } else {
        this.updateFromHand(this.demo.sample(nowMs, this.playMode), nowMs);
      }
    }

    if (nowMs - this.lastUiUpdateMs > 90) {
      this.lastUiUpdateMs = nowMs;
      this.view.updatePerformance(this.lastPerformance);
      if (this.selectedSong && this.guidedFrame) {
        this.guidedView.update(this.selectedSong, this.guidedFrame);
      }
      this.updateStatus();
    }

    this.frameRequest = requestAnimationFrame(this.tick);
  };

  private updateFromHand(hand: HandFrame | null, nowMs: number): void {
    const bowing = this.interpreter.update(hand, nowMs);
    if (this.playMode === "guided" && this.guidedEngine && this.selectedSong) {
      this.guidedFrame = this.guidedEngine.update(bowing, nowMs);
      this.lastPerformance = mapGuidedPerformance(bowing, this.guidedFrame);
      this.synth.triggerAccompaniment(
        this.guidedFrame.crossedAccompaniment,
        this.selectedSong.bpm,
      );
      this.scene.setGuidance(judgmentGuidance(this.guidedFrame));
      if (this.guidedFrame.phase === "complete" && !this.resultShown) {
        this.resultShown = true;
        this.guidedView.showResult(this.selectedSong, this.guidedFrame.score);
      }
    } else {
      this.lastPerformance = mapPerformance(bowing);
      this.scene.setGuidance(null);
    }
    this.scene.update(this.lastPerformance);
    this.synth.update(this.lastPerformance);
  }

  private releaseVoice(nowMs: number): void {
    const bowing = this.interpreter.update(null, nowMs);
    this.applyReleasedFrame(bowing, nowMs);
    this.scene.update(this.lastPerformance);
    this.synth.update(this.lastPerformance);
  }

  private applyReleasedFrame(bowing: BowingFrame, nowMs: number): void {
    if (this.playMode === "guided" && this.guidedEngine && this.selectedSong) {
      this.guidedFrame = this.guidedEngine.update(bowing, nowMs);
      this.lastPerformance = mapGuidedPerformance(bowing, this.guidedFrame);
    } else {
      this.lastPerformance = mapPerformance(bowing);
    }
  }

  private async dispose(): Promise<void> {
    cancelAnimationFrame(this.frameRequest);
    this.scene.dispose();
    await this.synth.dispose();
  }
}

function judgmentGuidance(frame: GuidedSongFrame): number | null {
  if (frame.lastJudgment === "perfect") return 1;
  if (frame.lastJudgment === "good") return 0.72;
  if (frame.lastJudgment === "miss") return 0.18;
  return null;
}
