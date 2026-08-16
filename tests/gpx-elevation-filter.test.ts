import { describe, expect, it } from "vitest";
import { calculateRouteElevationStatistics, parseGpx } from "../lib/gpx-parser";

function points(elevations: number[]) {
  return elevations.map((ele, index) => ({ lat: 25, lon: 121 + index * 0.0001, ele }));
}

describe("GPX 路線海拔校正", () => {
  it("忽略未跨越門檻的上下海拔雜訊，避免長距離路線虛增爬升", () => {
    const stats = calculateRouteElevationStatistics(points([100, 103, 98, 102, 97, 101, 99, 100]));
    expect(stats.totalAscent).toBe(0);
    expect(stats.totalDescent).toBe(0);
  });

  it("保留跨越門檻的連續真實爬升與下降", () => {
    const stats = calculateRouteElevationStatistics(points([0, 5, 10, 15, 20, 15, 10, 5, 0]));
    expect(stats.totalAscent).toBe(20);
    expect(stats.totalDescent).toBe(20);
  });

  it("移除不合理的單一海拔尖峰，並讓預估路線使用校正後的總爬升", () => {
    const spike = calculateRouteElevationStatistics(points([30, 30, 100, 30, 30]));
    expect(spike.elevations).toEqual([30, 30, 30, 30, 30]);
    expect(spike.totalAscent).toBe(0);

    const route = parseGpx(`
      <gpx><trk><name>校正測試</name><trkseg>
        <trkpt lat="25" lon="121"><ele>0</ele></trkpt>
        <trkpt lat="25" lon="121.0001"><ele>5</ele></trkpt>
        <trkpt lat="25" lon="121.0002"><ele>10</ele></trkpt>
        <trkpt lat="25" lon="121.0003"><ele>15</ele></trkpt>
        <trkpt lat="25" lon="121.0004"><ele>20</ele></trkpt>
      </trkseg></trk></gpx>
    `);
    expect(route?.totalAscent).toBe(20);
    expect(route?.estimatedDuration).toBeGreaterThan(0);
    expect(route?.estimatedCalories).toBeGreaterThan(0);
  });
});
