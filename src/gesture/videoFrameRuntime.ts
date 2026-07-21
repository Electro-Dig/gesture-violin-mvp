export type VisionDelegate = "GPU" | "CPU";

export class VideoFrameGate {
  private lastMediaTime = -1;

  accept(mediaTime: number): boolean {
    if (!Number.isFinite(mediaTime) || mediaTime <= this.lastMediaTime) {
      return false;
    }

    this.lastMediaTime = mediaTime;
    return true;
  }

  reset(): void {
    this.lastMediaTime = -1;
  }
}

export async function createWithDelegateFallback<T>(
  create: (delegate: VisionDelegate) => Promise<T>,
): Promise<T> {
  try {
    return await create("GPU");
  } catch {
    return create("CPU");
  }
}

export type TrackingPerformance = {
  inferenceMs: number;
  trackingHz: number;
};

export class TrackingDiagnosticsMeter {
  private readonly frameTimesMs: number[] = [];
  private readonly inferenceTimesMs: number[] = [];

  constructor(private readonly sampleWindow = 30) {
    if (!Number.isInteger(sampleWindow) || sampleWindow < 2) {
      throw new Error("sampleWindow must be an integer of at least 2");
    }
  }

  record(frameTimestampMs: number, inferenceMs: number): TrackingPerformance {
    this.frameTimesMs.push(frameTimestampMs);
    this.inferenceTimesMs.push(Math.max(0, inferenceMs));
    this.trim(this.frameTimesMs);
    this.trim(this.inferenceTimesMs);

    const averageInference =
      this.inferenceTimesMs.reduce((sum, value) => sum + value, 0)
      / this.inferenceTimesMs.length;
    const firstFrame = this.frameTimesMs[0] ?? frameTimestampMs;
    const lastFrame = this.frameTimesMs.at(-1) ?? frameTimestampMs;
    const elapsedMs = lastFrame - firstFrame;
    const trackingHz = elapsedMs > 0
      ? ((this.frameTimesMs.length - 1) * 1000) / elapsedMs
      : 0;

    return {
      inferenceMs: roundToTenth(averageInference),
      trackingHz: roundToTenth(trackingHz),
    };
  }

  reset(): void {
    this.frameTimesMs.length = 0;
    this.inferenceTimesMs.length = 0;
  }

  private trim(values: number[]): void {
    if (values.length > this.sampleWindow) {
      values.splice(0, values.length - this.sampleWindow);
    }
  }
}

function roundToTenth(value: number): number {
  return Math.round(value * 10) / 10;
}
