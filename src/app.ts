import { StringSynth } from "./audio/stringSynth";
import { BowingGestureInterpreter } from "./gesture/bowingGestureInterpreter";
import { DemoHandSource } from "./gesture/demoHandSource";
import { HandTracker } from "./gesture/handTracker";
import { MouseRehearsalSource, normalizePointer } from "./gesture/mouseRehearsalSource";
import type { HandFrame } from "./gesture/types";
import { mapPerformance, type PerformanceState } from "./music/performanceModel";
import { ViolinScene } from "./scene/violinScene";
import { AppView, type InputMode } from "./ui/appView";

const CAMERA_INTERVAL_MS = 1000 / 28;

export class GestureViolinApp {
  private readonly view: AppView;
  private readonly scene: ViolinScene;
  private readonly synth = new StringSynth();
  private readonly tracker = new HandTracker();
  private readonly mouse = new MouseRehearsalSource();
  private readonly demo = new DemoHandSource();
  private readonly interpreter = new BowingGestureInterpreter();
  private mode: InputMode;
  private lastPerformance: PerformanceState;
  private lastCameraDetectMs = Number.NEGATIVE_INFINITY;
  private lastUiUpdateMs = Number.NEGATIVE_INFINITY;
  private frameRequest = 0;
  private modeRequest = 0;
  private audioStarted = false;
  private muted = false;

  constructor(root: HTMLElement) {
    const demoEnabled = new URLSearchParams(window.location.search).get("demo") === "1";
    this.mode = demoEnabled ? "demo" : "camera";
    this.view = new AppView(root, demoEnabled);
    this.scene = new ViolinScene(this.view.sceneCanvas);
    this.lastPerformance = mapPerformance(this.interpreter.reset(performance.now()));

    this.bindControls();
    this.view.setMode(this.mode);
    this.view.setAudioState(false, false);
    this.view.updatePerformance(this.lastPerformance);
    this.scene.update(this.lastPerformance);
    this.scene.start();

    if (demoEnabled) {
      this.view.setStatus("自动演示 · 点击启用声音", "active");
    }

    this.frameRequest = requestAnimationFrame(this.tick);
  }

  private bindControls(): void {
    this.view.startCameraButton.addEventListener("click", () => void this.activateCamera());
    this.view.startDemoButton.addEventListener("click", () => void this.activateDemo());
    this.view.retryButton.addEventListener("click", () => void this.activateCamera());
    this.view.muteButton.addEventListener("click", () => void this.toggleAudio());

    this.view.modeButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const mode = button.dataset.inputMode as InputMode;
        if (mode === "camera") void this.activateCamera();
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

  private async activateCamera(): Promise<void> {
    const request = ++this.modeRequest;
    this.view.hideIntro();
    this.view.setBusy(true);
    this.view.setError(null);
    this.view.setStatus("正在加载本地手势模型…", "neutral");
    await this.ensureAudio();

    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("当前浏览器不支持摄像头访问");
      await this.tracker.start(this.view.video);
      if (request !== this.modeRequest) {
        this.tracker.stopCamera();
        return;
      }
      this.mode = "camera";
      this.interpreter.reset(performance.now());
      this.lastCameraDetectMs = Number.NEGATIVE_INFINITY;
      this.view.setMode("camera");
      this.view.setStatus("寻找一只手掌…", "neutral");
    } catch (error) {
      if (request !== this.modeRequest) return;
      this.mode = "rehearsal";
      this.interpreter.reset(performance.now());
      this.view.setMode("rehearsal");
      this.view.setStatus("摄像头不可用 · 已进入鼠标排练", "warning");
      this.view.setError(cameraErrorMessage(error));
    } finally {
      this.view.setBusy(false);
    }
  }

  private async activateRehearsal(): Promise<void> {
    ++this.modeRequest;
    await this.ensureAudio();
    this.tracker.stopCamera();
    this.mode = "rehearsal";
    this.mouse.release();
    this.interpreter.reset(performance.now());
    this.view.hideIntro();
    this.view.setMode("rehearsal");
    this.view.setError(null);
    this.view.setStatus("按住并拖动 · 上下选音，左右发声", "active");
  }

  private async activateDemo(): Promise<void> {
    ++this.modeRequest;
    await this.ensureAudio();
    this.tracker.stopCamera();
    this.mode = "demo";
    this.interpreter.reset(performance.now());
    this.view.hideIntro();
    this.view.setMode("demo");
    this.view.setError(null);
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
    if (this.mode === "camera") {
      if (nowMs - this.lastCameraDetectMs >= CAMERA_INTERVAL_MS) {
        this.lastCameraDetectMs = nowMs;
        const hand = this.tracker.detect(this.view.video, nowMs);
        this.updateFromHand(hand, nowMs);
        this.drawLandmarks(hand);
      }
    } else if (this.mode === "rehearsal") {
      this.updateFromHand(this.mouse.sample(nowMs), nowMs);
    } else {
      this.updateFromHand(this.demo.sample(nowMs), nowMs);
    }

    if (nowMs - this.lastUiUpdateMs > 90) {
      this.lastUiUpdateMs = nowMs;
      this.view.updatePerformance(this.lastPerformance);
      if (this.mode === "camera") {
        this.view.setStatus(
          this.lastPerformance.phase === "idle"
            ? "寻找一只手掌…"
            : this.lastPerformance.phase === "ready"
              ? "手掌已识别 · 左右移动开始拉弓"
              : "正在演奏",
          this.lastPerformance.phase === "bowing" ? "active" : "neutral",
        );
      }
    }

    this.frameRequest = requestAnimationFrame(this.tick);
  };

  private updateFromHand(hand: HandFrame | null, nowMs: number): void {
    this.lastPerformance = mapPerformance(this.interpreter.update(hand, nowMs));
    this.scene.update(this.lastPerformance);
    this.synth.update(this.lastPerformance);
  }

  private releaseVoice(nowMs: number): void {
    this.lastPerformance = mapPerformance(this.interpreter.update(null, nowMs));
    this.scene.update(this.lastPerformance);
    this.synth.update(this.lastPerformance);
  }

  private drawLandmarks(hand: HandFrame | null): void {
    const canvas = this.view.landmarkCanvas;
    const rect = canvas.getBoundingClientRect();
    const scale = Math.min(window.devicePixelRatio, 2);
    const width = Math.max(1, Math.round(rect.width * scale));
    const height = Math.max(1, Math.round(rect.height * scale));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const context = canvas.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, width, height);
    if (!hand) return;

    context.strokeStyle = "rgba(255, 172, 103, 0.62)";
    context.lineWidth = 1.2 * scale;
    HAND_CONNECTIONS.forEach(([start, end]) => {
      const a = hand.landmarks[start];
      const b = hand.landmarks[end];
      if (!a || !b) return;
      context.beginPath();
      context.moveTo(a.x * width, a.y * height);
      context.lineTo(b.x * width, b.y * height);
      context.stroke();
    });
    context.fillStyle = "#ffb36b";
    hand.landmarks.forEach((point, index) => {
      context.beginPath();
      context.arc(point.x * width, point.y * height, (index === 9 ? 3.4 : 1.7) * scale, 0, Math.PI * 2);
      context.fill();
    });
  }

  private async dispose(): Promise<void> {
    cancelAnimationFrame(this.frameRequest);
    this.tracker.dispose();
    this.scene.dispose();
    await this.synth.dispose();
  }
}

const HAND_CONNECTIONS: Array<[number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15],
  [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
];

function cameraErrorMessage(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError") return "摄像头权限被拒绝。可重试，或继续用鼠标排练。";
    if (error.name === "NotFoundError") return "没有找到可用摄像头。已保留鼠标排练模式。";
    if (error.name === "NotReadableError") return "摄像头正被其他应用占用。关闭占用后可重试。";
  }
  return error instanceof Error ? `${error.message}。可先使用鼠标排练。` : "摄像头启动失败。可先使用鼠标排练。";
}
