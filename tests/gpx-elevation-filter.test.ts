import { describe, expect, it } from "vitest";
import { calculateRouteElevationStatistics, parseGpx } from "../lib/gpx-parser";

function points(elevations: number[]) {
  return elevations.map((ele, index) => ({ lat: 25, lon: 121 + index * 0.001, ele }));
}

describe("GPX 路線海拔校正", () => {
  it("忽略未跨越門檻的上下海拔雜訊，避免長距離路線虛增爬升", () => {
    const stats = calculateRouteElevationStatistics(points([100, 103, 98, 102, 97, 101, 99, 100]));
    expect(stats.totalAscent).toBe(0);
    expect(stats.totalDescent).toBe(0);
  });

  it("僅累計跨越原始檔海拔門檻的連續爬升與下降", () => {
    const stats = calculateRouteElevationStatistics(points([0, 10, 20, 30, 40, 30, 20, 10, 0]));
    expect(stats.totalAscent).toBe(30);
    expect(stats.totalDescent).toBe(30);
  });

  it("移除不合理的單一海拔尖峰，並讓預估路線使用校正後的總爬升", () => {
    const spike = calculateRouteElevationStatistics(points([30, 30, 100, 30, 30]));
    expect(spike.elevations).toEqual([30, 30, 30, 30, 30]);
    expect(spike.totalAscent).toBe(0);

    const route = parseGpx(`
      <gpx><trk><name>校正測試</name><trkseg>
        <trkpt lat="25" lon="121"><ele>0</ele></trkpt>
        <trkpt lat="25" lon="121.001"><ele>10</ele></trkpt>
        <trkpt lat="25" lon="121.002"><ele>20</ele></trkpt>
        <trkpt lat="25" lon="121.003"><ele>30</ele></trkpt>
        <trkpt lat="25" lon="121.004"><ele>40</ele></trkpt>
      </trkseg></trk>
    `);
    expect(route?.totalAscent).toBe(30);
    expect(route?.estimatedDuration).toBeGreaterThan(0);
    expect(route?.estimatedCalories).toBeGreaterThan(0);
  });
});
