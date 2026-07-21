import type { OrbitCue } from "./orbitRhythmModel";

export type OrbitCueAttributes = {
  pathLength: 360;
  dasharray: string;
  rotationDeg: number;
  className: string;
  labelX: number;
  labelY: number;
  directionSymbol: "\u2190" | "\u2192";
  opacity: number;
};

const ORBIT_CENTER = 50;
const LABEL_RADIUS = 34;

export function orbitCueAttributes(cue: OrbitCue): OrbitCueAttributes {
  const sweep = clamp(cue.sweepDeg, 0, 360);
  const svgAngleDeg = normalizeAngle(360 - cue.angleDeg);
  const labelRadians = (svgAngleDeg * Math.PI) / 180;

  return {
    pathLength: 360,
    dasharray: `${formatNumber(sweep)} ${formatNumber(360 - sweep)}`,
    rotationDeg: svgAngleDeg,
    className: [
      "orbit-cue",
      cue.expectedDirection < 0 ? "direction-left" : "direction-right",
      `is-${cue.state}`,
    ].join(" "),
    labelX: roundToTenth(ORBIT_CENTER + Math.cos(labelRadians) * LABEL_RADIUS),
    labelY: roundToTenth(ORBIT_CENTER + Math.sin(labelRadians) * LABEL_RADIUS),
    directionSymbol: cue.expectedDirection < 0 ? "\u2190" : "\u2192",
    opacity: cue.state === "current" ? 1 : cue.state === "upcoming" ? 0.66 : 0.24,
  };
}

function normalizeAngle(angle: number): number {
  return ((angle % 360) + 360) % 360;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, "");
}

function roundToTenth(value: number): number {
  return Math.round(value * 10) / 10;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
