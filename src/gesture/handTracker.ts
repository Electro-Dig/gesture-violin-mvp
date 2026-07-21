import {
  FilesetResolver,
  HandLandmarker,
  type HandLandmarkerResult,
} from "@mediapipe/tasks-vision";

import { resultToHandFrames } from "./handResultMapper";
import type { HandTrackingSnapshot } from "./types";
import {
  TrackingDiagnosticsMeter,
  VideoFrameGate,
  createWithDelegateFallback,
  type VisionDelegate,
} from "./videoFrameRuntime";

const WASM_BASE = "/vendor/tasks-vision/wasm";
const MODEL_URL = "/vendor/mediapipe-models/hand_landmarker.task";

type SnapshotListener = (snapshot: HandTrackingSnapshot) => void;

type VideoFrameCapable = {
  requestVideoFrameCallback?: (
    callback: (nowMs: number, metadata: { mediaTime: number }) => void,
  ) => number;
  cancelVideoFrameCallback?: (requestId: number) => void;
};

export class HandTracker {
  private landmarker: HandLandmarker | null = null;
  private stream: MediaStream | null = null;
  private video: HTMLVideoElement | null = null;
  private listener: SnapshotListener | null = null;
  private videoFrameRequest: number | null = null;
  private fallbackFrameRequest: number | null = null;
  private delegate: VisionDelegate = "GPU";
  private readonly frameGate = new VideoFrameGate();
  private readonly diagnosticsMeter = new TrackingDiagnosticsMeter();

  async start(
    video: HTMLVideoElement,
    listener: SnapshotListener,
  ): Promise<void> {
    this.stopCamera();

    try {
      const [stream, landmarker] = await Promise.all([
        navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 640 },
            height: { ideal: 480 },
            frameRate: { ideal: 60, min: 30 },
          },
          audio: false,
        }),
        this.loadLandmarker(),
      ]);

      this.stream = stream;
      this.landmarker = landmarker;
      this.video = video;
      this.listener = listener;
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      await video.play();
      this.scheduleNextFrame();
    } catch (error) {
      this.stopCamera();
      throw error;
    }
  }

  stopCamera(): void {
    this.cancelScheduledFrame();
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.video = null;
    this.listener = null;
    this.frameGate.reset();
    this.diagnosticsMeter.reset();
  }

  dispose(): void {
    this.stopCamera();
    this.landmarker?.close();
    this.landmarker = null;
  }

  private scheduleNextFrame(): void {
    const video = this.video;
    if (!video || !this.listener || !this.landmarker) {
      return;
    }

    const frameVideo = video as unknown as VideoFrameCapable;
    const requestVideoFrame = frameVideo.requestVideoFrameCallback;
    if (requestVideoFrame) {
      this.videoFrameRequest = requestVideoFrame.call(
        video,
        (nowMs, metadata) => {
          this.videoFrameRequest = null;
          try {
            this.processFrame(video, metadata.mediaTime, nowMs);
          } finally {
            this.scheduleNextFrame();
          }
        },
      );
      return;
    }

    this.fallbackFrameRequest = requestAnimationFrame((nowMs) => {
      this.fallbackFrameRequest = null;
      try {
        this.processFrame(video, video.currentTime, nowMs);
      } finally {
        this.scheduleNextFrame();
      }
    });
  }

  private processFrame(
    video: HTMLVideoElement,
    mediaTime: number,
    nowMs: number,
  ): void {
    if (
      !this.landmarker
      || !this.listener
      || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA
      || !this.frameGate.accept(mediaTime)
    ) {
      return;
    }

    const detectorTimestampMs = mediaTime * 1000;
    const inferenceStartedMs = performance.now();
    const result = this.landmarker.detectForVideo(video, detectorTimestampMs);
    const inferenceMs = performance.now() - inferenceStartedMs;
    const performanceSample = this.diagnosticsMeter.record(
      detectorTimestampMs,
      inferenceMs,
    );

    this.listener({
      timestampMs: nowMs,
      hands: resultToHandFrames(
        result as HandLandmarkerResult,
        nowMs,
      ),
      diagnostics: {
        delegate: this.delegate,
        ...performanceSample,
      },
    });
  }

  private cancelScheduledFrame(): void {
    if (this.video && this.videoFrameRequest !== null) {
      const frameVideo = this.video as unknown as VideoFrameCapable;
      frameVideo.cancelVideoFrameCallback?.call(
        this.video,
        this.videoFrameRequest,
      );
    }
    if (this.fallbackFrameRequest !== null) {
      cancelAnimationFrame(this.fallbackFrameRequest);
    }
    this.videoFrameRequest = null;
    this.fallbackFrameRequest = null;
  }

  private async loadLandmarker(): Promise<HandLandmarker> {
    if (this.landmarker) {
      return this.landmarker;
    }

    const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
    return createWithDelegateFallback(async (delegate) => {
      const landmarker = await HandLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath: MODEL_URL,
          delegate,
        },
        runningMode: "VIDEO",
        numHands: 1,
        minHandDetectionConfidence: 0.55,
        minHandPresenceConfidence: 0.55,
        minTrackingConfidence: 0.55,
      });
      this.delegate = delegate;
      return landmarker;
    });
  }
}
