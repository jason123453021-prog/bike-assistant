import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  AUTO_LAP_DISTANCE_PRESETS_KM,
  normalizeAutoLapDistanceKm,
} from "../lib/settings-context";

const projectRoot = resolve(process.cwd());
const settingsSource = readFileSync(
  resolve(projectRoot, "app/(tabs)/settings.tsx"),
  "utf8",
);
const mapSource = readFileSync(
  resolve(projectRoot, "app/(tabs)/map.tsx"),
  "utf8",
);
const themeSource = readFileSync(
  resolve(projectRoot, "lib/theme-provider.tsx"),
  "utf8",
);

describe("全域 Lap 設定與設定頁 Accordion", () => {
  it("只接受 1、5、10 km 的安全自動計圈距離，並以 5 km 作為缺省值", () => {
    expect(AUTO_LAP_DISTANCE_PRESETS_KM).toEqual([1, 5, 10]);
    expect(normalizeAutoLapDistanceKm(undefined)).toBe(5);
    expect(normalizeAutoLapDistanceKm(0.2)).toBe(1);
    expect(normalizeAutoLapDistanceKm(4.6)).toBe(5);
    expect(normalizeAutoLapDistanceKm(8.7)).toBe(10);
  });

  it("持久化自動計圈主開關與距離，並在設定頁完整呈現控制項", () => {
    expect(settingsSource).toContain('t("settings.autoLap")');
    expect(settingsSource).toContain('t("settings.autoLapDistance")');
    expect(settingsSource).toContain("AUTO_LAP_DISTANCE_PRESETS_KM");
    expect(settingsSource).toContain("lapEnabled");
    expect(settingsSource).toContain("autoLapDistanceKm");
    expect(settingsSource).not.toContain("計圈模式");
    expect(settingsSource).not.toContain("手動介入");
    expect(settingsSource).toContain('t("settings.presetSport")');
    expect(settingsSource).toContain('t("settings.autoPauseRules")');
    expect(settingsSource).not.toContain("自動暫停速度門檻");
    expect(settingsSource).not.toContain("自動暫停延遲時間");
  });

  it("開啟時以全程里程倍數自動觸發，且不保留手動 Lap 控制", () => {
    expect(mapSource).toContain("advanceAutoLapMilestones");
    expect(mapSource).toContain("autoLapMilestoneStateRef");
    expect(mapSource).toContain("nextAutoLapDistanceMRef");
    expect(mapSource).toContain(
      "nextAutoLapDistanceMRef.current = result.nextDistanceM",
    );
    expect(mapSource).toContain('type: "SYNC_AUTO_LAPS"');
    expect(mapSource).not.toContain("handleMarkLap");
    expect(mapSource).not.toContain("lapFloatingControlWrap");
    expect(mapSource).toContain("autoPauseStillForSeconds:");
    expect(mapSource).toContain("getSportTrackingPolicy(state.sportType)");
    expect(mapSource).toContain("autoPauseEnabledForSport");
  });

  it("設定頁預設只顯示四個高層分類，並保有動畫與主題選擇", () => {
    expect(settingsSource).toContain('title={t("settings.rideDashboard")}');
    expect(settingsSource).toContain('title={t("settings.supplyReminders")}');
    expect(settingsSource).toContain('title={t("settings.displayAppearance")}');
    expect(settingsSource).toContain(
      'title={t("settingsActions.systemDataTitle")}',
    );
    expect(settingsSource).toContain("LayoutAnimation.configureNext");
    expect(settingsSource).toContain('t("settingsDetail.appearanceTheme")');
    expect(settingsSource).not.toContain(
      't("settingsActions.clearCacheLabel")',
    );
    expect(settingsSource).toContain(
      't("settingsActions.openHistoryBackupLabel")',
    );
    expect(themeSource).toContain("themePreference");
    expect(themeSource).toContain("setThemePreference");
  });

  it("把語言入口放在系統與資料管理，避免使用者在外觀分類找不到設定", () => {
    const systemCategoryIndex = settingsSource.indexOf(
      'title={t("settingsActions.systemDataTitle")}',
    );
    const permissionsIndex = settingsSource.indexOf(
      "<RidePermissionReadiness />",
    );
    const languageEntryIndex = settingsSource.indexOf(
      'accessibilityLabel={`${t("settings.languageTitle")}：${selectedLanguageLabel}`}',
    );
    const displayCategoryIndex = settingsSource.indexOf(
      'title={t("settings.displayAppearance")}',
    );

    expect(systemCategoryIndex).toBeGreaterThan(-1);
    expect(languageEntryIndex).toBeGreaterThan(permissionsIndex);
    expect(languageEntryIndex).toBeGreaterThan(systemCategoryIndex);
    expect(languageEntryIndex).toBeGreaterThan(displayCategoryIndex);
    expect(settingsSource).not.toContain(
      'title={t("settings.displayAppearance")}\n          subtitle="主題、螢幕常亮、省電與儀表版面"\n          colors={colors}\n          expanded={Boolean(openCategories.display)}\n          onPress={() => toggleCategory("display")}\n        >\n          <View\n            style={[\n              styles.appearanceCard,\n              {\n                borderColor: colors.border,\n                backgroundColor: colors.surface,\n                marginTop: 12,\n              },\n            ]}\n          >\n            <Pressable\n              accessibilityRole="button"\n              accessibilityLabel={`${t("settings.languageTitle")}：${selectedLanguageLabel}`}',
    );
  });

  it("提供可本機保存的閒置歸位時間，並套用到手動地圖操作後的自動置中計時", () => {
    expect(settingsSource).toContain('t("settingsDetail.idleRecenter")');
    expect(settingsSource).toContain('testID="idle-recenter-time-slider"');
    expect(settingsSource).toContain("updateSettings({ autoRecenterSec");
    expect(mapSource).toContain("settings.autoRecenterSec * 1000");
  });
});
