import type { BowingFrame, HandFrame, Vec2 } from "./types";

export type BowingGestureInterpreterOptions = {
  minConfidence: number;
  smoothingTauSeconds: number;
  bowStartSpeed: number;
  bowReleaseSpeed: number;
  fullIntensitySpeed: number;
};

const DEFAULT_OPTIONS: BowingGestureInterpreterOptions = {
  minConfidence: 0.55,
  smoothingTauSeconds: 0.055,
  bowStartSpeed: 0.14,
  bowReleaseSpeed: 0.045,
  fullIntensitySpeed: 1.05,
};

export class BowingGestureInterpreter {
  private readonly options: BowingGestureInterpreterOptions;
  private lastFrame: BowingFrame | null = null;
  private lastDirection: BowingFrame["direction"] = 0;

  constructor(options: Partial<BowingGestureInterpreterOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  update(hand: HandFrame | null, nowMs = hand?.timestampMs ?? performance.now()): BowingFrame {
    if (
      !hand ||
      hand.confidence < this.options.minConfidence ||
      hand.landmarks.length < 18
    ) {
      return this.release(nowMs, hand?.confidence ?? 0);
    }

    const rawCenter = palmCenter(hand.landmarks);
    const timestampMs = hand.timestampMs;
    const previous = this.lastFrame;
    const dtSeconds = previous
      ? Math.max((timestampMs - previous.timestampMs) / 1000, 1 / 240)
      : 0;
    const x = previous
      ? smoothExp(previous.x, clamp01(rawCenter.x), this.options.smoothingTauSeconds, dtSeconds)
      : clamp01(rawCenter.x);
    const pitchRaw = clamp01(1 - rawCenter.y);
    const pitch = previous
      ? smoothExp(previous.pitch, pitchRaw, this.options.smoothingTauSeconds, dtSeconds)
      : pitchRaw;
    const velocityX = previous && dtSeconds > 0 ? (x - previous.x) / dtSeconds : 0;
    const horizontalSpeed = Math.abs(velocityX);
    const shouldBow = previous?.bowing
      ? horizontalSpeed >= this.options.bowReleaseSpeed
      : horizontalSpeed >= this.options.bowStartSpeed;
    if (shouldBow && velocityX !== 0) this.lastDirection = velocityX > 0 ? 1 : -1;
    if (!shouldBow) this.lastDirection = 0;
    const direction: BowingFrame["direction"] = shouldBow ? this.lastDirection : 0;
    const intensity = shouldBow
      ? clamp01(
          (horizontalSpeed - this.options.bowReleaseSpeed) /
            (this.options.fullIntensitySpeed - this.options.bowReleaseSpeed),
        )
      : 0;

    const frame: BowingFrame = {
      timestampMs,
      active: true,
      bowing: shouldBow,
      x,
      pitch,
      horizontalSpeed,
      intensity,
      direction,
      confidence: clamp01(hand.confidence),
    };

    this.lastFrame = frame;
    return frame;
  }

  reset(timestampMs = performance.now()): BowingFrame {
    this.lastFrame = null;
    this.lastDirection = 0;
    return neutralFrame(timestampMs, 0.5, 0.5, 0);
  }

  private release(timestampMs: number, confidence: number): BowingFrame {
    const frame = neutralFrame(
      timestampMs,
      this.lastFrame?.x ?? 0.5,
      this.lastFrame?.pitch ?? 0.5,
      confidence,
    );
    this.lastFrame = frame;
    this.lastDirection = 0;
    return frame;
  }
}

function palmCenter(landmarks: Vec2[]): Vec2 {
  const indices = [0, 5, 9, 17] as const;
  const points = indices.map((index) => landmarks[index]).filter(Boolean) as Vec2[];
  const total = points.reduce(
    (sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }),
    { x: 0, y: 0 },
  );
  return {
    x: total.x / points.length,
    y: total.y / points.length,
  };
}

function neutralFrame(
  timestampMs: number,
  x: number,
  pitch: number,
  confidence: number,
): BowingFrame {
  return {
    timestampMs,
    active: false,
    bowing: false,
    x: clamp01(x),
    pitch: clamp01(pitch),
    horizontalSpeed: 0,
    intensity: 0,
    direction: 0,
    confidence: clamp01(confidence),
  };
}

function smoothExp(current: number, target: number, tau: number, dtSeconds: number): number {
  if (tau <= 0 || dtSeconds <= 0) {
    return target;
  }
  const alpha = 1 - Math.exp(-dtSeconds / tau);
  return current + (target - current) * alpha;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
