import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const rideContextSource = readFileSync("lib/ride-context.tsx", "utf8").replace(
  /\s+/g,
  " ",
);
const mapSource = readFileSync("app/(tabs)/map.tsx", "utf8").replace(
  /\s+/g,
  " ",
);

describe("可信 GPS 移動時間資料鏈", () => {
  it("不再讓每秒 timer 覆寫 GPS 導出的移動時間", () => {
    expect(rideContextSource).toContain('case "TICK":');
    expect(rideContextSource).toContain(
      "移動時間唯一由 LOCATION_UPDATE 的可信 GPS 時間差積分",
    );
    expect(rideContextSource).toContain("return state;");
  });

  it("只讓通過位移、精度與速度品質閘門的 GPS 區間累積距離、移動時間與功率", () => {
    expect(mapSource).toContain(
      "const countMovingTime = statisticsIntervalSec > 0",
    );
    expect(mapSource).toContain("&& hasReliableMovement");
    expect(mapSource).toContain(
      "statisticsSpeedKmh >= autoPausePolicy.speedBelowKmh",
    );
    expect(mapSource).toContain("countMovingTime,");
    expect(rideContextSource).toContain(
      "const shouldCountMovingTime = countMovingTime ?? isBackgroundRecovery;",
    );
    expect(rideContextSource).toContain(
      "const movingIntervalSec = shouldCountMovingTime ? effectiveIntervalSec : 0;",
    );
  });

  it("將活動總時間固定為開始到停止的牆鐘時間，避免摘要開啟時間污染紀錄", () => {
    expect(rideContextSource).toContain("endTime: nowMs");
    expect(rideContextSource).toContain(
      "const elapsedDurationSec = state.startTime",
    );
    expect(rideContextSource).toContain(
      "const pausedForActivitySec = Math.max(",
    );
    expect(rideContextSource).toContain("elapsedDurationSec - state.elapsed,");
  });

  it("自動暫停恢復時不遺失第一個可信移動點，且保留暫停期間的原始 GPS 時間戳", () => {
    expect(mapSource).toContain("let resumedFromAutomaticPause = false;");
    expect(mapSource).toContain("resumedFromAutomaticPause = true;");
    expect(mapSource).toContain(
      'currentState.status !== "active" && !resumedFromAutomaticPause',
    );
    expect(mapSource).toContain("timestamp: loc.timestamp,");
    expect(mapSource).toContain("recordedDuringPause: true,");
    expect(rideContextSource).toContain("recordedDuringPause?: boolean;");
    expect(rideContextSource).toContain(
      "if (point.recordedDuringPause && !result.includes(point)) result.push(point);",
    );
  });
});
