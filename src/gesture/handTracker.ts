import {
  FilesetResolver,
  HandLandmarker,
  type HandLandmarkerResult,
} from "@mediapipe/tasks-vision";

import { resultToHandFrames } from "./handResultMapper";
import type { HandFrame } from "./types";

const WASM_BASE = "/vendor/tasks-vision/wasm";
const MODEL_URL = "/vendor/mediapipe-models/hand_landmarker.task";

export class HandTracker {
  private landmarker: HandLandmarker | null = null;
  private stream: MediaStream | null = null;

  async start(video: HTMLVideoElement): Promise<void> {
    this.stopCamera();

    try {
      const [stream, landmarker] = await Promise.all([
        navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        }),
        this.loadLandmarker(),
      ]);

      this.stream = stream;
      this.landmarker = landmarker;
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      await video.play();
    } catch (error) {
      this.stopCamera();
      throw error;
    }
  }

  detect(video: HTMLVideoElement, timestampMs: number): HandFrame | null {
    if (!this.landmarker || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      return null;
    }

    const result = this.landmarker.detectForVideo(video, timestampMs);
    const frames = resultToHandFrames(result as HandLandmarkerResult, timestampMs);
    return frames.sort((a, b) => b.confidence - a.confidence)[0] ?? null;
  }

  stopCamera(): void {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
  }

  dispose(): void {
    this.stopCamera();
    this.landmarker?.close();
    this.landmarker = null;
  }

  private async loadLandmarker(): Promise<HandLandmarker> {
    if (this.landmarker) {
      return this.landmarker;
    }

    const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
    return HandLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL_URL },
      runningMode: "VIDEO",
      numHands: 1,
      minHandDetectionConfidence: 0.55,
      minHandPresenceConfidence: 0.55,
      minTrackingConfidence: 0.55,
    });
  }
}
