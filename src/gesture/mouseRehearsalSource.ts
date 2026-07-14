import type { HandFrame, Vec2 } from "./types";

export type PointerRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export class MouseRehearsalSource {
  private engaged = false;
  private position: Vec2 = { x: 0.5, y: 0.5 };

  press(x: number, y: number): void {
    this.engaged = true;
    this.setPosition(x, y);
  }

  move(x: number, y: number): void {
    this.setPosition(x, y);
  }

  release(): void {
    this.engaged = false;
  }

  sample(timestampMs: number): HandFrame | null {
    if (!this.engaged) {
      return null;
    }

    return {
      timestampMs,
      landmarks: Array.from({ length: 21 }, () => ({ ...this.position })),
      handedness: "right",
      confidence: 1,
    };
  }

  private setPosition(x: number, y: number): void {
    this.position = { x: clamp01(x), y: clamp01(y) };
  }
}

export function normalizePointer(
  clientX: number,
  clientY: number,
  rect: PointerRect,
): Vec2 {
  return {
    x: clamp01((clientX - rect.left) / Math.max(rect.width, 1)),
    y: clamp01((clientY - rect.top) / Math.max(rect.height, 1)),
  };
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
