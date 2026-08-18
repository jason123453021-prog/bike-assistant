import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = process.cwd();
const settingsContextSource = readFileSync(resolve(projectRoot, "lib/settings-context.tsx"), "utf8");
const settingsScreenSource = readFileSync(resolve(projectRoot, "app/(tabs)/settings.tsx"), "utf8");
const powerSavingSource = readFileSync(resolve(projectRoot, "lib/power-saving/smart-power-saving-system.ts"), "utf8");

describe("reset all settings", () => {
  it("overwrites only the dedicated settings key with cloned defaults", () => {
    expect(settingsContextSource).toContain("const resetAllSettings = async () =>");
    expect(settingsContextSource).toContain("const next = createDefaultSettings()");
    expect(settingsContextSource).toContain("AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next))");
    expect(settingsContextSource).not.toContain("AsyncStorage.clear()");
    expect(settingsContextSource).toContain("騎乘活動、軌跡、相片與活動統計使用其他本機資料");
  });

  it("prevents an older asynchronous hydration result from overwriting a newer reset", () => {
    expect(settingsContextSource).toContain("const settingsWriteRevisionRef = useRef(0)");
    expect(settingsContextSource).toContain("const hydrationRevision = settingsWriteRevisionRef.current");
    expect(settingsContextSource).toContain("if (settingsWriteRevisionRef.current !== hydrationRevision) return;");
    expect(settingsContextSource).toContain("settingsWriteRevisionRef.current += 1;");
    expect(powerSavingSource).toContain("private settingsWriteRevision = 0;");
    expect(powerSavingSource).toContain("if (hydrationRevision !== this.settingsWriteRevision) return this.settings;");
  });

  it("also restores the separate power-saving preferences without touching activity data", () => {
    expect(powerSavingSource).toContain("async resetSettings(): Promise<PowerSavingSettings>");
    expect(powerSavingSource).toContain("await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next))");
    expect(powerSavingSource).toContain("await this.wakeUp()");
  });

  it("requires an explicit destructive confirmation and tells the rider that activities remain", () => {
    expect(settingsScreenSource).toContain('Alert.alert(\n      "重設所有設定"');
    expect(settingsScreenSource).toContain("騎乘活動、軌跡與照片不會被刪除");
    expect(settingsScreenSource).toContain("await resetAllSettings()");
    expect(settingsScreenSource).toContain("powerSavingManagerRef.current.resetSettings()");
    expect(settingsScreenSource).toContain("powerSavingHydrationRevisionRef.current += 1;");
    expect(settingsScreenSource).toContain('>重設所有設定</Text>');
  });
});
