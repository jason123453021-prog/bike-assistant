export type RidePipStatus = "active" | "paused" | "idle" | "finished";

export type RidePipSnapshotInput = {
  status: RidePipStatus;
  instruction: string;
  turnDistanceM: number;
  speedKmh: number;
  distanceM: number;
};

export type RidePipSnapshot = {
  active: boolean;
  paused: boolean;
  instruction: string;
  turnDistanceM: number;
  speedKmh: number;
  distanceKm: number;
};

export function buildRidePipSnapshot(input: RidePipSnapshotInput): RidePipSnapshot {
  const active = input.status === "active" || input.status === "paused";
  const finite = (value: number) => Number.isFinite(value) ? value : 0;

  return {
    active,
    paused: input.status === "paused",
    instruction: input.instruction.trim() || (input.status === "paused" ? "騎乘已暫停" : "騎乘中"),
    turnDistanceM: Math.max(0, finite(input.turnDistanceM)),
    speedKmh: Math.max(0, finite(input.speedKmh)),
    distanceKm: Math.max(0, finite(input.distanceM)) / 1000,
  };
}
