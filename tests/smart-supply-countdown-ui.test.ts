import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const mapSource = readFileSync(resolve(process.cwd(), "app/(tabs)/map.tsx"), "utf8");
const modalSource = readFileSync(resolve(process.cwd(), "components/supply-modal.tsx"), "utf8");
const feedbackSource = readFileSync(resolve(process.cwd(), "lib/feedback-service.ts"), "utf8");
const settingsSource = readFileSync(resolve(process.cwd(), "app/(tabs)/settings.tsx"), "utf8");

describe("smart supply countdown UI", () => {
  it("shows countdown status and restarts only after explicit confirmation", () => {
    expect(mapSource).toContain("能量倒數");
    expect(mapSource).toContain("補水倒數");
    expect(mapSource).toContain("restartSmartSupplyCountdown");
    expect(mapSource).toContain('settings.supplyCalculationMode === "smart"');
    expect(mapSource).toContain('settings.supplyCalculationMode !== "smart" && autoDismissSeconds');
    expect(mapSource).toContain('settings.supplyCalculationMode === "smart" && (kind === "calorie" || kind === "water")');
    expect(mapSource).toContain("pendingCalorieRef.current ? {");
    expect(mapSource).toContain("pendingWaterRef.current ? {");
  });

  it("uses a native modal over the map and omits amount guidance", () => {
    expect(modalSource).toContain("<Modal");
    expect(modalSource).toContain("hardwareAccelerated");
    expect(modalSource).toContain("請補給能量");
    expect(modalSource).toContain("請補給水分");
    expect(modalSource).not.toContain("recommendedMl");
    expect(modalSource).not.toContain("recommendedEnergyKcal");
    expect(modalSource).not.toContain("recommendedCarbohydrateG");
    expect(modalSource).toContain("allowSnooze = true");
    expect(modalSource).toContain("{allowSnooze && (");
    expect(mapSource).toContain('allowSnooze={settings.supplyCalculationMode !== "smart" || (!calorieAlert && !waterAlert)}');
  });

  it("renders energy and water together when both countdowns expire, then allows either confirmation to keep the other pending", () => {
    expect(mapSource).toContain('if (calorieDue && !calorieReminderSentRef.current && !pendingCalorieRef.current)');
    expect(mapSource).toContain('if (waterDue && !waterReminderSentRef.current && !pendingWaterRef.current)');
    expect(mapSource).toContain('pendingCalorieRef.current = true;\n        setCalorieAlert(true);');
    expect(mapSource).toContain('pendingWaterRef.current = true;\n        setWaterAlert(true);');
    expect(modalSource).toContain('const bothAlert = calorieAlert && waterAlert');
    expect(modalSource).toContain('{calorieAlert && (');
    expect(modalSource).toContain('{waterAlert && (');
    expect(mapSource).toContain('const waterStillPending = pendingWaterRef.current || waterAlert;');
    expect(mapSource).toContain('const calorieStillPending = pendingCalorieRef.current || calorieAlert;');
    expect(mapSource).toContain('restartSmartSupplyCountdown(\n          smartSupplyCountdownRef.current,\n          "calorie"');
    expect(mapSource).toContain('restartSmartSupplyCountdown(\n          smartSupplyCountdownRef.current,\n          "water"');
  });

  it("keeps dual-supply controls readable, scrollable, and independently accessible on smaller screens", () => {
    expect(modalSource).toContain("<ScrollView");
    expect(modalSource).toContain('contentContainerStyle={styles.cardContent}');
    expect(modalSource).toContain('maxHeight: "86%"');
    expect(modalSource).toContain("supplyStack");
    expect(modalSource).toContain("gap: 14");
    expect(modalSource).toContain('accessibilityLabel="確認已補給能量並重新開始能量倒數"');
    expect(modalSource).toContain('accessibilityLabel="確認已補給水分並重新開始補水倒數"');
    expect(modalSource).toContain("hitSlop={6}");
    expect(modalSource).toContain("energyButton");
    expect(modalSource).toContain("waterButton");
  });

  it("provides a settings-only preview that opens both supply sections without writing ride, countdown, or notification state", () => {
    expect(settingsSource).toContain('const [supplyPreview, setSupplyPreview] = useState({ energy: false, water: false })');
    expect(settingsSource).toContain('accessibilityLabel="預覽雙補給彈窗"');
    expect(settingsSource).toContain('onPress={() => setSupplyPreview({ energy: true, water: true })}');
    expect(settingsSource).toContain("<SupplyModal");
    expect(settingsSource).toContain("calorieAlert={supplyPreview.energy}");
    expect(settingsSource).toContain("waterAlert={supplyPreview.water}");
    expect(settingsSource).toContain('onConfirmCalorie={() => setSupplyPreview((current) => ({ ...current, energy: false }))}');
    expect(settingsSource).toContain('onConfirmWater={() => setSupplyPreview((current) => ({ ...current, water: false }))}');
    expect(settingsSource).not.toContain("scheduleSmartSupplyDueNotification");
    expect(settingsSource).not.toContain("setBackgroundSupplyReminderPending");
  });

  it("restores background or lock-screen overdue reminders on foreground without requiring new GPS points", () => {
    expect(mapSource).toContain("const smartCalorieDue = bgState.supplyCalculationMode === \"smart\"");
    expect(mapSource).toContain("const smartWaterDue = bgState.supplyCalculationMode === \"smart\"");
    expect(mapSource).toContain("bgState.calorieReminderSent || smartCalorieDue || pendingCalorieRef.current");
    expect(mapSource).toContain("bgState.waterReminderSent || smartWaterDue || pendingWaterRef.current");
    expect(mapSource).toContain("updateBackgroundSmartSupplyCountdown");
    expect(mapSource).toContain("setBackgroundSupplyReminderPending");
  });

  it("schedules a local Android reminder for countdown expiry and clears it only after confirmation", () => {
    expect(feedbackSource).toContain("scheduleSmartSupplyDueNotification");
    expect(feedbackSource).toContain("clearSmartSupplyDueNotification");
    expect(feedbackSource).toContain("SchedulableTriggerInputTypes.DATE");
    expect(feedbackSource).toContain('channelId: "supply"');
    expect(mapSource).toContain('scheduleSmartSupplyDueNotification(\n        "calorie"');
    expect(mapSource).toContain('scheduleSmartSupplyDueNotification(\n        "water"');
    expect(mapSource).toContain('clearSmartSupplyDueNotification("calorie")');
    expect(mapSource).toContain('clearSmartSupplyDueNotification("water")');
  });
});
