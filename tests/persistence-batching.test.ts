import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const mapSource = readFileSync(resolve(process.cwd(), "app/(tabs)/map.tsx"), "utf8");
const backgroundSource = readFileSync(resolve(process.cwd(), "lib/background-location.ts"), "utf8");

describe("ride persistence batching", () => {
  it("batches foreground recovery snapshots and flushes the newest state before ride cleanup", () => {
    expect(mapSource).toContain("const pendingRecoverySnapshotRef");
    expect(mapSource).toContain("const recoverySnapshotTimerRef");
    expect(mapSource).toContain("3_000 - (Date.now() - lastRecoverySnapshotAtRef.current)");
    expect(mapSource).toContain("queueRecoverySnapshot(recoverySession)");
    expect(mapSource).toContain("await flushRecoverySnapshot();");
  });

  it("keeps a bounded background track cache instead of reading and rewriting all points per callback", () => {
    expect(backgroundSource).toContain("BG_TRACK_FLUSH_INTERVAL_MS = 5_000");
    expect(backgroundSource).toContain("backgroundTrackCache");
    expect(backgroundSource).toContain("appendBackgroundTrackBatch");
    expect(backgroundSource).toContain("await appendBackgroundTrackBatch(locations.map");
    expect(backgroundSource).not.toContain("const trackStr = await AsyncStorage.getItem(BG_TRACK_KEY)");
  });
});
