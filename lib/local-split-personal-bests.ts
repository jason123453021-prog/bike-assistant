import type { RideRecord } from "./ride-context";
import { buildRideSplits, type RideSplit } from "./ride-splits";

export interface LocalSplitPersonalBest {
  split: RideSplit;
  priorBestSeconds?: number;
  isPersonalBest: boolean;
  comparedEffortCount: number;
}

function fullKilometerEfforts(records: RideRecord[]): RideSplit[] {
  return records.flatMap((record) => buildRideSplits(record).filter((split) => split.distanceM >= 950 && split.movingTimeSeconds > 0));
}

/**
 * 將本次每個完整 1 km 努力與此裝置所有較早騎乘的完整 1 km 努力比較。
 * 不把不同道路偽稱為同一 Strava 區段；頁面以「本機 1 km 努力」明確標示資料範圍。
 */
export function compareLocalSplitPersonalBests(current: RideRecord, history: RideRecord[]): LocalSplitPersonalBest[] {
  const previousEfforts = fullKilometerEfforts(history.filter((ride) => ride.id !== current.id && ride.date <= current.date));
  const priorBestSeconds = previousEfforts.reduce<number | undefined>((best, split) => (
    best === undefined || split.movingTimeSeconds < best ? split.movingTimeSeconds : best
  ), undefined);

  return buildRideSplits(current)
    .filter((split) => split.distanceM >= 950 && split.movingTimeSeconds > 0)
    .map((split) => ({
      split,
      priorBestSeconds,
      isPersonalBest: priorBestSeconds !== undefined && split.movingTimeSeconds < priorBestSeconds,
      comparedEffortCount: previousEfforts.length,
    }));
}
