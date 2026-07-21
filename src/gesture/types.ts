export type Vec2 = {
  x: number;
  y: number;
};

export type HandFrame = {
  timestampMs: number;
  landmarks: Vec2[];
  handedness: "left" | "right" | "unknown";
  confidence: number;
};

export type BowingFrame = {
  timestampMs: number;
  active: boolean;
  bowing: boolean;
  x: number;
  pitch: number;
  horizontalSpeed: number;
  intensity: number;
  direction: -1 | 0 | 1;
  confidence: number;
};

export type TrackingDiagnostics = {
  delegate: "GPU" | "CPU";
  inferenceMs: number;
  trackingHz: number;
};

export type HandTrackingSnapshot = {
  timestampMs: number;
  hands: HandFrame[];
  diagnostics: TrackingDiagnostics;
};
