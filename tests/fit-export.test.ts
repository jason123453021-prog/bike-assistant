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

  it("將使用者手動標記的多個 Lap 匯出為標準 FIT lap 訊息", () => {
    const bytes = createFitBytes({
      ...ride,
      laps: [
        { index: 1, startedAtElapsedSec: 0, endedAtElapsedSec: 50, movingTimeSec: 50, distanceM: 900, ascentM: 12, descentM: 3, averageSpeedKmh: 18, averagePowerW: 158 },
        { index: 2, startedAtElapsedSec: 50, endedAtElapsedSec: 110, movingTimeSec: 60, distanceM: 1_100, ascentM: 22, descentM: 16, averageSpeedKmh: 19, averagePowerW: 166 },
      ],
    });
    const decoder = new Decoder(Stream.fromByteArray(Array.from(bytes!)));
    const { messages, errors } = decoder.read();
    expect(errors).toEqual([]);
    expect(messages.lapMesgs?.length).toBe(2);
    expect(messages.lapMesgs?.map((lap) => lap.totalDistance)).toEqual([900, 1100]);
  });

  it("以安全檔名輸出 .fit 副檔名", () => {
    expect(fitFilename(ride)).toMatch(/\.fit$/);
  });

  it("保留暫停中的原始 GPS record，且 session 仍分別使用總經過與移動計時", () => {
    const pausedTimestamp = Date.UTC(2026, 0, 2, 3, 4, 30);
    const bytes = createFitBytes({
      ...ride,
      route: [
        ride.route[0],
        {
          latitude: 25.035,
          longitude: 121.567,
          altitude: 13,
          speed: 0,
          timestamp: pausedTimestamp,
          recordedDuringPause: true,
        },
        ride.route[1],
      ],
    });
    const decoder = new Decoder(Stream.fromByteArray(Array.from(bytes!)));
    const { messages, errors } = decoder.read();
    expect(errors).toEqual([]);
    expect(messages.recordMesgs).toHaveLength(3);
    expect(messages.sessionMesgs?.[0]?.totalElapsedTime).toBe(120);
    expect(messages.sessionMesgs?.[0]?.totalTimerTime).toBe(110);
  });
});
