import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  AUTO_LAP_DISTANCE_PRESETS_KM,
  normalizeAutoLapDistanceKm,
} from "../lib/settings-context";

const projectRoot = resolve(process.cwd());
const settingsSource = readFileSync(resolve(projectRoot, "app/(tabs)/settings.tsx"), "utf8");
const mapSource = readFileSync(resolve(projectRoot, "app/(tabs)/map.tsx"), "utf8");
const themeSource = readFileSync(resolve(projectRoot, "lib/theme-provider.tsx"), "utf8");

describe("全域 Lap 設定與設定頁 Accordion", () => {
  it("只接受 1、5、10 km 的安全自動計圈距離，並以 5 km 作為缺省值", () => {
    expect(AUTO_LAP_DISTANCE_PRESETS_KM).toEqual([1, 5, 10]);
    expect(normalizeAutoLapDistanceKm(undefined)).toBe(5);
    expect(normalizeAutoLapDistanceKm(0.2)).toBe(1);
    expect(normalizeAutoLapDistanceKm(4.6)).toBe(5);
    expect(normalizeAutoLapDistanceKm(8.7)).toBe(10);
  });

  it("持久化自動計圈主開關與距離，並在設定頁完整呈現控制項", () => {
    expect(settingsSource).toContain("啟用計圈功能");
    expect(settingsSource).toContain("自動計圈距離");
    expect(settingsSource).toContain("AUTO_LAP_DISTANCE_PRESETS_KM");
    expect(settingsSource).toContain("lapEnabled");
    expect(settingsSource).toContain("autoLapDistanceKm");
    expect(settingsSource).not.toContain("計圈模式");
    expect(settingsSource).not.toContain("手動介入");
    expect(settingsSource).toContain("預設運動模式");
    expect(settingsSource).toContain("自動暫停速度門檻");
  });

  it("開啟時以全程里程倍數自動觸發，且不保留手動 Lap 控制", () => {
    expect(mapSource).toContain("advanceAutoLapMilestones");
    expect(mapSource).toContain("autoLapMilestoneStateRef");
    expect(mapSource).toContain("nextAutoLapDistanceMRef");
    expect(mapSource).toContain("nextAutoLapDistanceMRef.current = result.nextDistanceM");
    expect(mapSource).toContain('type: "SYNC_AUTO_LAPS"');
    expect(mapSource).not.toContain("handleMarkLap");
    expect(mapSource).not.toContain("lapFloatingControlWrap");
    expect(mapSource).toContain("autoPauseSpeedThresholdKmh");
    expect(mapSource).toContain("autoPauseEnabledForSport");
  });

  it("設定頁預設只顯示四個高層分類，並保有動畫與主題選擇", () => {
    expect(settingsSource).toContain("騎乘與儀表板設定");
    expect(settingsSource).toContain("補給與提醒設定");
    expect(settingsSource).toContain("顯示與外觀");
    expect(settingsSource).toContain("系統與資料管理");
    expect(settingsSource).toContain("LayoutAnimation.configureNext");
    expect(settingsSource).toContain("外觀主題");
    expect(settingsSource).toContain("清理地圖與暫存軌跡");
    expect(settingsSource).toContain("匯出／備份 GPX 軌跡");
    expect(themeSource).toContain("themePreference");
    expect(themeSource).toContain("setThemePreference");
  });
});
