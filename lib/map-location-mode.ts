export const LOCATION_CAMERA_MODES = [
  "heading-up",
  "free-heading",
  "north-up",
] as const;

export type LocationCameraMode = (typeof LOCATION_CAMERA_MODES)[number];

export type LocationCameraInstruction = {
  recenter: true;
  bearing: number | null;
  headingUp: boolean;
};

export function nextLocationCameraMode(
  mode: LocationCameraMode,
): LocationCameraMode {
  const index = LOCATION_CAMERA_MODES.indexOf(mode);
  return LOCATION_CAMERA_MODES[(index + 1) % LOCATION_CAMERA_MODES.length];
}

/**
 * 將 GPS COG 轉成 Leaflet bearing。heading-up 讓使用者行進方向維持畫面正上方；
 * 自由角度保留使用者手動雙指旋轉的角度；正北模式強制回到 0°。
 */
export function resolveLocationCameraInstruction(
  mode: LocationCameraMode,
  courseOverGroundDeg: number | null | undefined,
): LocationCameraInstruction {
  if (mode === "free-heading") {
    return { recenter: true, bearing: null, headingUp: false };
  }

  if (mode === "north-up") {
    return { recenter: true, bearing: 0, headingUp: false };
  }

  const safeCog =
    typeof courseOverGroundDeg === "number" &&
    Number.isFinite(courseOverGroundDeg)
      ? ((courseOverGroundDeg % 360) + 360) % 360
      : null;

  return {
    recenter: true,
    bearing: safeCog === null ? null : (360 - safeCog) % 360,
    headingUp: true,
  };
}

export function shouldApplyCogRotation(mode: LocationCameraMode): boolean {
  return mode === "heading-up";
}
