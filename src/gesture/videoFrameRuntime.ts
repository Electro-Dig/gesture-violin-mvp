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
