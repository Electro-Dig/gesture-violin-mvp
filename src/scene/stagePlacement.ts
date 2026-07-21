export type StagePlacement = {
  x: number;
  y: number;
  scale: number;
};

const PORTRAIT: StagePlacement = {
  x: 1.15,
  y: -0.62,
  scale: 0.68,
};

const TABLET: StagePlacement = {
  x: 1.35,
  y: -0.48,
  scale: 0.76,
};

const DESKTOP: StagePlacement = {
  x: 1.72,
  y: -0.38,
  scale: 0.84,
};

export function mapStagePlacement(aspect: number): StagePlacement {
  if (aspect < 0.85) {
    return { ...PORTRAIT };
  }
  if (aspect < 1.5) {
    return { ...TABLET };
  }
  return { ...DESKTOP };
}

export type StageCamera = {
  x: number;
  z: number;
};

export function mapStageCamera(aspect: number): StageCamera {
  if (aspect < 0.85) {
    return { x: 0.72, z: 9.1 };
  }
  if (aspect < 1.5) {
    return { x: 0.24, z: 8.5 };
  }
  return { x: 0, z: 8.1 };
}
