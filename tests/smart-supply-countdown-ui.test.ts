import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const mapSource = readFileSync(resolve(process.cwd(), "app/(tabs)/map.tsx"), "utf8");
const modalSource = readFileSync(resolve(process.cwd(), "components/supply-modal.tsx"), "utf8");
const feedbackSource = readFileSync(resolve(process.cwd(), "lib/feedback-service.ts"), "utf8");
const settingsSource = readFileSync(resolve(process.cwd(), "app/(tabs)/settings.tsx"), "utf8");
const settingsContextSource = readFileSync(resolve(process.cwd(), "lib/settings-context.tsx"), "utf8");
const backgroundSource = readFileSync(resolve(process.cwd(), "lib/background-location.ts"), "utf8");
const hydrationRecalculationSource = readFileSync(resolve(process.cwd(), "lib/hydration-recalculation.ts"), "utf8");

describe("smart supply countdown UI", () => {
  it("shows countdown status and restarts only after explicit confirmation", () => {
    expect(mapSource).toContain("能量倒數");
    expect(mapSource).toContain("補水倒數");
    expect(mapSource).toContain("restartSmartSupplyCountdown");
    expect(mapSource).toContain("const smartEnergySupplyEnabled = smartSupplyChannels.energy");
    expect(mapSource).toContain("const smartWaterSupplyEnabled = smartSupplyChannels.water");
    expect(mapSource).toContain('type === "calorie" ? smartEnergySupplyEnabled : smartWaterSupplyEnabled');
    expect(mapSource).toContain("currentCountdown ?? createSmartSupplyCountdown(supplyPlan, currentState.elapsed)");
    expect(mapSource).not.toContain("refreshSmartSupplyCountdown");
  });

  it("updates the paused dashboard once per second without moving the locked due point, and buffers pause recovery per channel", () => {
    expect(mapSource).toContain("const [smartSupplyCountdownNowMs, setSmartSupplyCountdownNowMs]");
    expect(mapSource).toContain("setInterval(() => setSmartSupplyCountdownNowMs(Date.now()), 1_000)");
    expect(mapSource).toContain("smartSupplyCountdownRemainingSec(smartSupplyCountdown, \"calorie\", smartSupplyCountdownNowMs)");
    expect(mapSource).toContain("smartSupplyCountdownRemainingSec(smartSupplyCountdown, \"water\", smartSupplyCountdownNowMs)");
    expect(mapSource).toContain("const supplyRoundPauseRef = useRef<Record<\"calorie\" | \"water\"");
    expect(mapSource).toContain("consumePausedRecoveryForNextRound(\"calorie\")");
    expect(mapSource).toContain("consumePausedRecoveryForNextRound(\"water\")");
    expect(mapSource).toContain("GPS 位置回呼可能在手動暫停、室內或訊號中斷時停止");
    expect(mapSource).toContain("isSmartSupplyCountdownDue(countdown, \"calorie\", smartSupplyCountdownNowMs)");
    expect(mapSource).toContain("isSmartSupplyCountdownDue(countdown, \"water\", smartSupplyCountdownNowMs)");
    expect(backgroundSource).toContain("smartCalorieCountdownPausedTotalMs");
    expect(backgroundSource).toContain("smartWaterCountdownPausedTotalMs");
  });

  it("initializes concrete smart countdowns at ride start without waiting for the first accepted GPS sample", () => {
    expect(mapSource).toContain("getLastKnownPositionAsync({");
    expect(mapSource).toContain("maxAge: 2 * 60 * 1000,");
    expect(mapSource).toContain("const initialSupplyPlanInput = buildInitialSupplyPlanInput({");
    expect(mapSource).toContain("const initialSupplyPlan = createSupplyPlan(initialSupplyPlanInput);");
    expect(mapSource).toContain("resolveInitialWeather");
    expect(mapSource).toContain("setTimeout(() => resolve(null), 1_500)");
    expect(mapSource).toContain('lastBackgroundCountdownSnapshotRef.current = "";');
    expect(mapSource).toContain("syncSmartSupplyCountdown(createSmartSupplyCountdown(initialSupplyPlan, 0));");
  });

  it("waits for weather and sensor inputs when starting the next smart-water round, then uses the defined safe fallback", () => {
    expect(mapSource).toContain("awaitHydrationInputs({ weatherPromise, sensorPromise })");
    expect(mapSource).toContain("void refreshSmartWaterCountdown(confirmedPlan");
    expect(hydrationRecalculationSource).toContain("Promise.all([input.weatherPromise, input.sensorPromise])");
    expect(hydrationRecalculationSource).toContain("HYDRATION_DATA_TIMEOUT_MS = 60 * 1000");
    expect(hydrationRecalculationSource).toContain("return MIN_WATER_COUNTDOWN_SEC");
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
    expect(mapSource).toContain('allowSnooze={(!calorieAlert || !smartEnergySupplyEnabled) && (!waterAlert || !smartWaterSupplyEnabled)}');
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

  it("does not expose a settings-only supply modal preview", () => {
    expect(settingsSource).not.toContain("supplyPreview");
    expect(settingsSource).not.toContain("<SupplyModal");
    expect(settingsSource).not.toContain("預覽補給彈窗");
    expect(settingsSource).not.toContain("整合提醒類別");
    expect(modalSource).not.toContain("previewSummary");
  });

  it("uses one reminder interval setting while exposing no preview or feedback test controls", () => {
    expect(settingsSource).toContain("未關閉時重複提醒間隔");
    expect(settingsSource).toContain("0 = 停用");
    expect(settingsSource).not.toContain("calorieRepeatUntilDismissed");
    expect(settingsSource).not.toContain("waterRepeatUntilDismissed");
    expect(settingsSource).not.toContain("PauseOnDownhill");
    expect(settingsSource).not.toContain("長下坡暫停提醒");
    expect(settingsSource).not.toContain("testPreviewAlertSound");
    expect(settingsSource).not.toContain("testCustomSupplyFeedback");
    expect(settingsSource).not.toContain("testSupplySoundAndSpeech");
    expect(settingsSource).not.toContain("previewControls={{");
    expect(modalSource).not.toContain("previewControls");
    expect(modalSource).not.toContain("測試震動");
    expect(modalSource).not.toContain("測試音效與語音");
    expect(modalSource).not.toContain("預覽提醒設定");
  });

  it("uses the shared reminder interval for smart, interval, and custom supply alerts", () => {
    expect(mapSource).toContain("// 唯一的重複提醒間隔：0 代表關閉，正值同時套用能量與補水。");
    expect(mapSource).toContain("// 使用唯一的全域重複間隔；0 代表關閉。");
    expect(mapSource).not.toContain("calorieRepeatUntilDismissed");
    expect(mapSource).not.toContain("waterRepeatUntilDismissed");
    expect(mapSource).not.toContain("}, 5000);");
  });

  it("offers 0, 30, and 60 second reminder interval quick choices while retaining manual editing", () => {
    expect(settingsSource).toContain("快速設定");
    expect(settingsSource).toContain("[0, 30, 60].map");
    expect(settingsSource).toContain('updateSettings({ supplyReminderRepeatSec: seconds })');
    expect(settingsSource).toContain('openEdit("supplyReminderRepeatSec"');
    expect(settingsSource).toContain("關閉補給重複提醒");
  });

  it("provides a master supply switch that stops foreground and background reminders while preserving user preferences", () => {
    expect(settingsContextSource).toContain("supplyReminderEnabled: boolean");
    expect(settingsContextSource).toContain("supplyReminderEnabled: true");
    expect(settingsContextSource).toContain("supplyReminderEnabled: saved.supplyReminderEnabled !== false");
    expect(settingsSource).toContain("啟用補給與補水提醒");
    expect(settingsSource).toContain("disabled={supplyControlsDisabled}");
    expect(settingsSource).toContain("const supplyControlsDisabled = !settings.supplyReminderEnabled");
    expect(mapSource).toContain("clearAllActiveSupplyReminders");
    expect(mapSource).toContain("if (!settings.supplyReminderEnabled) return;");
    expect(mapSource).toContain("setBackgroundSupplyReminderEnabled(false)");
    expect(mapSource).toContain("settings.supplyReminderEnabled && bgState && bgState.supplyReminderEnabled !== false");
    expect(backgroundSource).toContain("supplyReminderEnabled?: boolean");
    expect(backgroundSource).toContain("const supplyReminderEnabled = state.supplyReminderEnabled !== false");
    expect(backgroundSource).toContain("setBackgroundSupplyReminderEnabled");
    expect(feedbackSource).toContain("clearAllSupplyNotifications");
    expect(feedbackSource).toContain('data?.type === "supply_reminder"');
  });

  it("restores background or lock-screen overdue reminders on foreground without requiring new GPS points", () => {
    expect(mapSource).toContain("const backgroundSmartChannels = resolveSmartSupplyChannels(bgState)");
    expect(mapSource).toContain("const smartCalorieDue = backgroundSmartChannels.energy");
    expect(mapSource).toContain("const smartWaterDue = backgroundSmartChannels.water");
    expect(mapSource).toContain("shouldRestoreBackgroundSupplyReminder");
    expect(mapSource).toContain("pendingInForeground: pendingCalorieRef.current");
    expect(mapSource).toContain("pendingInForeground: pendingWaterRef.current");
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
    expect(mapSource).toContain("void clearAllSupplyNotifications();");
  });
});
