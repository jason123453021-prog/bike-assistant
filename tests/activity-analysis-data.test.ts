import { describe, expect, it } from "vitest";
import { buildElevationSamples, downsampleElevationSamples } from "../lib/activity-analysis-data";

describe("activity analysis elevation data", () => {
  const route = [
    { latitude: 25, longitude: 121, altitude: 10, speed: 2, timestamp: 1 },
    { latitude: 25.001, longitude: 121, altitude: 35, speed: 2, timestamp: 2 },
    { latitude: 25.002, longitude: 121, altitude: 30, speed: 2, timestamp: 3 },
  ];

  it("derives distance and grade only from recorded GPS altitude points", () => {
    const result = buildElevationSamples(route);
    expect(result).toHaveLength(3);
    expect(result[2].distanceKm).toBeGreaterThan(result[1].distanceKm);
    expect(result[1].grade).toBeGreaterThan(0);
  });

  it("does not fabricate a chart when valid altitude points are unavailable", () => {
    expect(buildElevationSamples([{ ...route[0], altitude: null }, route[1]])).toEqual([]);
  });

  it("preserves endpoints when reducing dense profiles", () => {
    const points = Array.from({ length: 10 }, (_, index) => ({ distanceKm: index, elevationM: index, timestamp: index }));
    const reduced = downsampleElevationSamples(points, 3);
    expect(reduced[0]).toEqual(points[0]);
    expect(reduced.at(-1)).toEqual(points.at(-1));
  });
});
