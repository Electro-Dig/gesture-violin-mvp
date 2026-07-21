export type ToneMode = "sample" | "synth";
export type SampleReadiness = "disabled" | "loading" | "ready" | "failed";
export type ToneBackend = "sample" | "synth";

export function readToneMode(search: string): ToneMode {
  return new URLSearchParams(search).get("tone") === "synth" ? "synth" : "sample";
}

export function shouldLoadSamples(mode: ToneMode): boolean {
  return mode === "sample";
}

export function activeBackend(mode: ToneMode, readiness: SampleReadiness): ToneBackend {
  return mode === "sample" && readiness === "ready" ? "sample" : "synth";
}

export function shouldNotifySampleFailure(
  previous: SampleReadiness,
  next: SampleReadiness,
): boolean {
  return previous !== "failed" && next === "failed";
}
