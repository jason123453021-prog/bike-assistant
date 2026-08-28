import { describe, expect, it } from "vitest";

import { getLapHighlightMetric, getLapPresentationMetrics } from "../lib/lap-presentation";

const lap = {
  index: 2,
  startedAtElapsedSec: 600,
  endedAtElapsedSec: 1_200,
  movingTimeSec: 600,
  distanceM: 2_000,
  ascentM: 87,
  descentM: 42,
  averageSpeedKmh: 12,
  averagePowerW: 186,
};

describe("多運動 Lap 呈現", () => {
  it("單車顯示距離、平均速度、平均功率與爬升", () => {
    expect(getLapPresentationMetrics("cycling", lap).map((metric) => metric.id)).toEqual([
      "distance", "average-speed", "average-power", "ascent",
    ]);
  });

  it("跑步與越野跑顯示配速，不顯示時速或功率；只有真實步頻才呈現", () => {
    const running = getLapPresentationMetrics("running", lap);
    expect(running.map((metric) => metric.id)).toEqual(["distance", "pace"]);
    expect(running.find((metric) => metric.id === "pace")?.value).toBe("05'00\" /km");
    expect(running.some((metric) => metric.id === "average-speed" || metric.id === "average-power" || metric.id === "cadence")).toBe(false);

    const withCadence = getLapPresentationMetrics("running", { ...lap, averageCadenceRpm: 172 });
    expect(withCadence.find((metric) => metric.id === "cadence")).toMatchObject({ label: "平均步頻", value: "172 spm" });
    expect(getLapPresentationMetrics("trail_running", lap).map((metric) => metric.id)).toEqual(["distance", "pace", "ascent"]);
  });

  it("登山以爬升、下降、VAM 與距離為核心，隱藏速度與功率", () => {
    expect(getLapPresentationMetrics("hiking", lap)).toEqual([
      { id: "ascent", label: "爬升", value: "87 m" },
      { id: "descent", label: "下降", value: "42 m" },
      { id: "vam", label: "平均爬升速度", value: "522 m/h" },
      { id: "distance", label: "距離", value: "2.00 km" },
    ]);
  });

  it("為 Toast 與即時面板提供運動模式感知的單一核心摘要", () => {
    expect(getLapHighlightMetric("cycling", lap)).toEqual({ label: "均功", value: "186 W" });
    expect(getLapHighlightMetric("cycling", { ...lap, averagePowerW: undefined })).toEqual({ label: "均速", value: "12.0 km/h" });
    expect(getLapHighlightMetric("running", lap)).toEqual({ label: "配速", value: "05'00\"" });
    expect(getLapHighlightMetric("trail_running", lap)).toEqual({ label: "配速", value: "05'00\"" });
    expect(getLapHighlightMetric("hiking", lap)).toEqual({ label: "總爬升", value: "+87 m" });
  });
});
