import { Decoder, Stream } from "@garmin/fitsdk";
import { describe, expect, it } from "vitest";
import { createFitBytes, fitFilename } from "../lib/fit-export";
import type { RideRecord } from "../lib/ride-context";

const ride: RideRecord = {
  id: "fit-ride",
  date: Date.UTC(2026, 0, 2, 3, 4),
  name: "FIT 匯出測試",
  duration: 120,
  movingTime: 110,
  distance: 2100,
  avgSpeed: 18.2,
  maxSpeed: 31.5,
  totalAscent: 34,
  totalDescent: 19,
  calories: 155,
  avgPower: 162,
  maxPower: 298,
  powerZones: [0, 0, 0, 0, 0],
  powerHistory: [150, 162, 175],
  route: [
    { latitude: 25.033, longitude: 121.5654, altitude: 12, speed: 4.5, timestamp: Date.UTC(2026, 0, 2, 3, 4), power: 150, heartRate: 130, cadence: 85 },
    { latitude: 25.04, longitude: 121.57, altitude: 18, speed: 5.2, timestamp: Date.UTC(2026, 0, 2, 3, 5), power: 175, heartRate: 140, cadence: 90 },
  ],
  totalSweatMl: 220,
  refillCount: 1,
  totalPausedSec: 10,
};

describe("createFitBytes", () => {
  it("輸出含有效 FIT 標頭與 CRC 的標準活動檔", () => {
    const bytes = createFitBytes(ride);
    expect(bytes).not.toBeNull();
    const stream = Stream.fromByteArray(Array.from(bytes!));
    const decoder = new Decoder(stream);
    expect(decoder.isFIT()).toBe(true);
    expect(decoder.checkIntegrity()).toBe(true);
    const { messages, errors } = decoder.read();
    expect(errors).toEqual([]);
    expect(messages.recordMesgs?.length).toBe(2);
    expect(messages.sessionMesgs?.length).toBe(1);
  });

  it("沒有足夠軌跡時不產生不完整 FIT", () => {
    expect(createFitBytes({ ...ride, route: [ride.route[0]] })).toBeNull();
  });

  it("以安全檔名輸出 .fit 副檔名", () => {
    expect(fitFilename(ride)).toMatch(/\.fit$/);
  });
});
