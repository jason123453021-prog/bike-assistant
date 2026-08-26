import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Switch,
  TextInput,
  Alert,
  Modal,
  PanResponder,
  Animated,
  LayoutAnimation,
  Platform,
  UIManager,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Slider from "@react-native-community/slider";
import { router } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { AdaptiveFormText } from "@/components/adaptive-form-text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useThemeContext } from "@/lib/theme-provider";
import {
  useSettings,
  AUTO_LAP_DISTANCE_PRESETS_KM,
  DEFAULT_FIELD_ORDER,
  DEFAULT_SIMPLIFIED_FIELD_ORDER,
  type NormalFieldKey,
  type SimplifiedFieldKey,
  type SupplyItem,
} from "@/lib/settings-context";
import {
  SmartPowerSavingManager,
  type PowerSavingSettings,
} from "@/lib/power-saving/smart-power-saving-system";
import { useRide } from "@/lib/ride-context";
import { SPORT_META } from "@/lib/sport-metrics";
import { deriveAutoPersonalMetrics } from "@/lib/auto-personal-metrics";
import {
  calculateAgeFromBirthday,
  normalizeBirthday,
} from "@/lib/personal-profile";
import { RidePermissionReadiness } from "@/components/ride-permission-readiness";
import { TOUCH_GUARD_UNLOCK_HOLD_PRESETS } from "@/lib/live-ride-readings";
import { resolveCarbohydrateHourlyLimit } from "@/lib/smart-supply-plan";
import { useTranslation } from "react-i18next";
import { LANGUAGE_NATIVE_NAMES, SUPPORTED_LOCALES } from "@/lib/i18n/i18n";
import { useLanguage } from "@/lib/i18n/language-provider";

import Constants from "expo-constants";

// 啟用 Android LayoutAnimation
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function SettingsScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const {
    preference: languagePreference,
    activeLanguage,
    setLanguagePreference,
  } = useLanguage();
  const isRtl = activeLanguage === "ar-SA";
  const { themePreference, setThemePreference } = useThemeContext();
  const {
    settings,
    updateSettings,
    resetAllSettings,
    updateNormalFields,
    updateSimplifiedFields,
    updateFieldOrder,
    updateSimplifiedFieldOrder,
    addSupplyItem,
    updateSupplyItem,
    deleteSupplyItem,
  } = useSettings();
  const { state: rideState } = useRide();
  const autoPersonalMetrics = deriveAutoPersonalMetrics(rideState.records, {
    ftpW: settings.ftp,
    age: settings.age,
    birthday: settings.birthday,
    maxHeartRate: settings.maxHeartRate,
    restingHeartRate: settings.restingHeartRate,
  });
  const currentAge =
    calculateAgeFromBirthday(settings.birthday) ?? settings.age;
  const supplyControlsDisabled = !settings.supplyReminderEnabled;
  const effectiveCarbohydrateHourlyLimitG = resolveCarbohydrateHourlyLimit({
    riderWeightKg: settings.weight,
    energyCarbohydrateHourlyLimitMode:
      settings.energyCarbohydrateHourlyLimitMode,
    energyCarbohydrateHourlyLimitG: settings.energyCarbohydrateHourlyLimitG,
  }).gramsPerHour;
  const smartCarbohydrateHourlySuggestionG = resolveCarbohydrateHourlyLimit({
    riderWeightKg: settings.weight,
    energyCarbohydrateHourlyLimitMode: "science",
  }).gramsPerHour;
  const powerSavingManagerRef = useRef(SmartPowerSavingManager.getInstance());
  const [powerSavingSettings, setPowerSavingSettings] =
    useState<PowerSavingSettings>(powerSavingManagerRef.current.getSettings());
  const [languageModalVisible, setLanguageModalVisible] = useState(false);
  const selectedLanguageLabel =
    languagePreference === "system"
      ? t("settings.followSystem")
      : LANGUAGE_NATIVE_NAMES[languagePreference];

  useEffect(() => {
    let mounted = true;
    powerSavingManagerRef.current.loadSettings().then((loaded) => {
      if (mounted) setPowerSavingSettings(loaded);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const updatePowerSavingSettings = async (
    patch: Partial<PowerSavingSettings>,
  ) => {
    const next = { ...powerSavingSettings, ...patch };
    setPowerSavingSettings(next);
    await powerSavingManagerRef.current.saveSettings(patch);
  };

  const [editModal, setEditModal] = useState<{
    visible: boolean;
    key: string;
    label: string;
    value: string;
    unit: string;
    isNumber: boolean;
  }>({
    visible: false,
    key: "",
    label: "",
    value: "",
    unit: "",
    isNumber: true,
  });

  // ── 補給品管理 Modal 狀態 ──
  const [supplyModal, setSupplyModal] = useState<{
    visible: boolean;
    mode: "add" | "edit";
    item: SupplyItem | null;
  }>({ visible: false, mode: "add", item: null });

  const [supplyForm, setSupplyForm] = useState<SupplyItem>({
    id: "",
    name: "",
    target: "energy",
    triggerType: "time",
    triggerValue: 10,
    triggerHours: 0,
    triggerMinutes: 5,
    triggerSeconds: 0,
    enabled: true,
  });
  const [editTouched, setEditTouched] = useState(false);
  const [supplyTouched, setSupplyTouched] = useState({
    name: false,
    time: false,
  });
  const editInlineError = !editTouched
    ? null
    : editModal.isNumber
      ? Number.isFinite(Number(editModal.value)) && Number(editModal.value) > 0
        ? null
        : t("forms.errors.numberBody")
      : normalizeBirthday(editModal.value.trim())
        ? null
        : t("forms.errors.birthdayBody");
  const supplyNameError =
    supplyTouched.name && !supplyForm.name.trim()
      ? t("forms.errors.supplyNameRequired")
      : null;
  const supplyTimeError =
    supplyTouched.time &&
    supplyForm.triggerType === "time" &&
    supplyForm.triggerHours === 0 &&
    supplyForm.triggerMinutes === 0 &&
    supplyForm.triggerSeconds === 0
      ? t("forms.errors.timePositive")
      : null;

  const openSupplyModal = (item?: SupplyItem) => {
    setSupplyTouched({ name: false, time: false });
    if (item) {
      setSupplyForm(item);
      setSupplyModal({ visible: true, mode: "edit", item });
    } else {
      setSupplyForm({
        id: Date.now().toString(),
        name: "",
        target: "energy",
        triggerType: "time",
        triggerValue: 10,
        triggerHours: 0,
        triggerMinutes: 5,
        triggerSeconds: 0,
        enabled: true,
      });
      setSupplyModal({ visible: true, mode: "add", item: null });
    }
  };

  const closeSupplyModal = () => {
    setSupplyModal({ visible: false, mode: "add", item: null });
    setSupplyTouched({ name: false, time: false });
  };

  const handleSaveSupply = async () => {
    setSupplyTouched({ name: true, time: true });
    if (
      !supplyForm.name.trim() ||
      (supplyForm.triggerType === "time" &&
        supplyForm.triggerHours === 0 &&
        supplyForm.triggerMinutes === 0 &&
        supplyForm.triggerSeconds === 0)
    )
      return;
    if (supplyModal.mode === "add") {
      await addSupplyItem(supplyForm);
    } else if (supplyModal.item) {
      await updateSupplyItem(supplyModal.item.id, supplyForm);
    }
    closeSupplyModal();
  };

  const handleDeleteSupply = async (id: string) => {
    Alert.alert(
      t("settingsActions.deleteSupplyTitle"),
      t("settingsActions.deleteSupplyBody"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("settingsActions.delete"),
          style: "destructive",
          onPress: () => deleteSupplyItem(id),
        },
      ],
    );
  };

  const handleResetAllSettings = () => {
    Alert.alert(
      t("settingsActions.resetTitle"),
      t("settingsActions.resetBody"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("settingsActions.reset"),
          style: "destructive",
          onPress: () => {
            void (async () => {
              try {
                await resetAllSettings();
                const defaultPowerSavingSettings =
                  await powerSavingManagerRef.current.resetSettings();
                setPowerSavingSettings(defaultPowerSavingSettings);
                setCollapsedSections({});
                setEditModal({
                  visible: false,
                  key: "",
                  label: "",
                  value: "",
                  unit: "",
                  isNumber: true,
                });
                closeSupplyModal();
                Alert.alert(
                  t("settingsActions.resetDoneTitle"),
                  t("settingsActions.resetDoneBody"),
                );
              } catch {
                Alert.alert(
                  t("settingsActions.resetFailedTitle"),
                  t("settingsActions.resetFailedBody"),
                );
              }
            })();
          },
        },
      ],
    );
  };

  // 各區塊折疊狀態（預設全部展開）
  const [collapsedSections, setCollapsedSections] = useState<
    Record<string, boolean>
  >({});
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>(
    {},
  );
  const toggleSection = (key: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCollapsedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };
  const toggleCategory = (key: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenCategories((previous) => ({ ...previous, [key]: !previous[key] }));
  };

  useEffect(() => {
    if (settings.appearanceMode !== themePreference) {
      setThemePreference(settings.appearanceMode);
    }
  }, [setThemePreference, settings.appearanceMode, themePreference]);

  // 拖曳排序狀態
  const [dragOrder, setDragOrder] = useState<NormalFieldKey[]>(
    settings.normalModeFieldOrder ?? DEFAULT_FIELD_ORDER,
  );
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const dragY = useRef(new Animated.Value(0)).current;
  const dragStartY = useRef(0);
  const ITEM_H = 52; // 每列高度

  // 同步 settings 變化到 dragOrder
  React.useEffect(() => {
    setDragOrder(settings.normalModeFieldOrder ?? DEFAULT_FIELD_ORDER);
  }, [settings.normalModeFieldOrder]);

  // 精簡模式拖曳排序狀態
  const [simpDragOrder, setSimpDragOrder] = useState<SimplifiedFieldKey[]>(
    settings.simplifiedModeFieldOrder ?? DEFAULT_SIMPLIFIED_FIELD_ORDER,
  );
  const [simpDraggingIdx, setSimpDraggingIdx] = useState<number | null>(null);
  const [simpHoverIdx, setSimpHoverIdx] = useState<number | null>(null);
  const simpDragY = useRef(new Animated.Value(0)).current;
  const simpDragStartY = useRef(0);

  React.useEffect(() => {
    setSimpDragOrder(
      settings.simplifiedModeFieldOrder ?? DEFAULT_SIMPLIFIED_FIELD_ORDER,
    );
  }, [settings.simplifiedModeFieldOrder]);

  const SIMP_FIELD_LABELS: Record<SimplifiedFieldKey, string> = {
    showDirection: t("settingsDetail.fieldDirection"),
    showRemaining: t("settingsDetail.fieldRemaining"),
    showSpeed: t("settingsDetail.fieldSpeed"),
    showDistance: t("settingsDetail.fieldDistance"),
    showElapsed: t("settingsDetail.fieldRideTime"),
    showCurrentTime: t("settingsDetail.fieldCurrentTime"),
    showGrade: t("settingsDetail.fieldGrade"),
    showPower: t("settingsDetail.fieldPower"),
    showAvgSpeed: t("settingsDetail.fieldAvgSpeed"),
    showCalories: t("settingsDetail.fieldCalories"),
    showPausedTime: t("settingsDetail.fieldPausedTime"),
    showTotalAscent: t("settingsDetail.fieldTotalAscent"),
    showCurrentAltitude: t("settingsDetail.fieldCurrentAltitude"),
  };

  const makeSimpDragResponder = (idx: number) =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        simpDragStartY.current = e.nativeEvent.pageY;
        simpDragY.setValue(0);
        setSimpDraggingIdx(idx);
        setSimpHoverIdx(idx);
      },
      onPanResponderMove: (e) => {
        const dy = e.nativeEvent.pageY - simpDragStartY.current;
        simpDragY.setValue(dy);
        const newIdx = Math.max(
          0,
          Math.min(simpDragOrder.length - 1, idx + Math.round(dy / ITEM_H)),
        );
        setSimpHoverIdx(newIdx);
      },
      onPanResponderRelease: (e) => {
        const dy = e.nativeEvent.pageY - simpDragStartY.current;
        const newIdx = Math.max(
          0,
          Math.min(simpDragOrder.length - 1, idx + Math.round(dy / ITEM_H)),
        );
        if (newIdx !== idx) {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          const next = [...simpDragOrder];
          const [moved] = next.splice(idx, 1);
          next.splice(newIdx, 0, moved);
          setSimpDragOrder(next);
          updateSimplifiedFieldOrder(next);
        }
        setSimpDraggingIdx(null);
        setSimpHoverIdx(null);
        simpDragY.setValue(0);
      },
      onPanResponderTerminate: () => {
        setSimpDraggingIdx(null);
        setSimpHoverIdx(null);
        simpDragY.setValue(0);
      },
    });

  const FIELD_LABELS: Record<NormalFieldKey, string> = {
    showElapsed: t("settingsDetail.fieldRideTime"),
    showSpeed: t("settingsDetail.fieldSpeed"),
    showDistance: t("settingsDetail.fieldDistance"),
    showGrade: t("settingsDetail.fieldGrade"),
    showPower: t("settingsDetail.fieldPower"),
    showAvgSpeed: t("settingsDetail.fieldAvgSpeed"),
    showCalories: t("settingsDetail.fieldCalories"),
    showPausedTime: t("settingsDetail.fieldPausedTime"),
    showTotalAscent: t("settingsDetail.fieldTotalAscent"),
    showCurrentAltitude: t("settingsDetail.fieldCurrentAltitude"),
    showGradeDistribution: t("settingsDetail.fieldGradeDistribution"),
  };

  const makeDragResponder = (idx: number) =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        dragStartY.current = e.nativeEvent.pageY;
        dragY.setValue(0);
        setDraggingIdx(idx);
        setHoverIdx(idx);
      },
      onPanResponderMove: (e) => {
        const dy = e.nativeEvent.pageY - dragStartY.current;
        dragY.setValue(dy);
        const newIdx = Math.max(
          0,
          Math.min(dragOrder.length - 1, idx + Math.round(dy / ITEM_H)),
        );
        setHoverIdx(newIdx);
      },
      onPanResponderRelease: (e) => {
        const dy = e.nativeEvent.pageY - dragStartY.current;
        const newIdx = Math.max(
          0,
          Math.min(dragOrder.length - 1, idx + Math.round(dy / ITEM_H)),
        );
        if (newIdx !== idx) {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          const next = [...dragOrder];
          const [moved] = next.splice(idx, 1);
          next.splice(newIdx, 0, moved);
          setDragOrder(next);
          updateFieldOrder(next);
        }
        setDraggingIdx(null);
        setHoverIdx(null);
        dragY.setValue(0);
      },
      onPanResponderTerminate: () => {
        setDraggingIdx(null);
        setHoverIdx(null);
        dragY.setValue(0);
      },
    });

  const openEdit = (
    key: string,
    label: string,
    value: number,
    unit: string,
  ) => {
    setEditTouched(false);
    setEditModal({
      visible: true,
      key,
      label,
      value: String(value),
      unit,
      isNumber: true,
    });
  };
  const openBirthdayEdit = () => {
    setEditTouched(false);
    setEditModal({
      visible: true,
      key: "birthday",
      label: t("formLabels.birthday"),
      value: settings.birthday ?? "",
      unit: "YYYY-MM-DD",
      isNumber: false,
    });
  };

  const saveEdit = async () => {
    setEditTouched(true);
    if (!editModal.isNumber) {
      const birthday = normalizeBirthday(editModal.value.trim());
      if (!birthday) {
        return;
      }
      await updateSettings({ birthday });
      setEditModal({ ...editModal, visible: false });
      return;
    }
    const num = parseFloat(editModal.value);
    if (isNaN(num) || num <= 0) {
      return;
    }
    const boundedNum =
      editModal.key === "touchGuardAutoRelockSec"
        ? Math.min(60, Math.max(1, Math.round(num)))
        : editModal.key === "energyServingCarbohydrateG"
          ? Math.min(100, Math.max(10, Math.round(num)))
          : editModal.key === "energyCarbohydrateHourlyLimitG"
            ? Math.min(90, Math.max(20, Math.round(num)))
            : editModal.key === "bikeWeight"
              ? Math.min(35, Math.max(3, Math.round(num * 10) / 10))
              : num;
    await updateSettings({ [editModal.key]: boundedNum });
    setEditModal({ ...editModal, visible: false });
  };

  return (
    <ScreenContainer containerClassName="bg-background">
      <ScrollView
        key={activeLanguage}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.title, { color: colors.foreground }]}>
          {t("settings.title")}
        </Text>

        <SettingsCategory
          icon="bicycle"
          title={t("settings.rideDashboard")}
          subtitle={t("settings.rideDashboardHint")}
          colors={colors}
          expanded={Boolean(openCategories.riding)}
          onPress={() => toggleCategory("riding")}
        >
          <View
            style={[
              styles.lapSettingsCard,
              { borderColor: colors.border, backgroundColor: colors.surface },
            ]}
          >
            <ToggleRow
              icon="flag.fill"
              label={t("settings.autoLap")}
              value={settings.lapEnabled}
              colors={colors}
              onToggle={(enabled) => updateSettings({ lapEnabled: enabled })}
            />
            {settings.lapEnabled && (
              <>
                <Divider colors={colors} />
                <View style={styles.lapSettingContent}>
                  <Text style={[styles.rowLabel, { color: colors.foreground }]}>
                    {t("settings.autoLapDistance")}
                  </Text>
                  <Text style={[styles.rowHint, { color: colors.muted }]}>
                    {t("settings.autoLapHint")}
                  </Text>
                  <View style={styles.lapModeOptions}>
                    {AUTO_LAP_DISTANCE_PRESETS_KM.map((distanceKm) => {
                      const selected =
                        settings.autoLapDistanceKm === distanceKm;
                      return (
                        <Pressable
                          key={distanceKm}
                          accessibilityRole="button"
                          accessibilityState={{ selected }}
                          onPress={() =>
                            void updateSettings({
                              autoLapDistanceKm: distanceKm,
                            })
                          }
                          style={({ pressed }) => [
                            styles.lapModeOption,
                            {
                              backgroundColor: selected
                                ? colors.accent
                                : colors.background,
                              borderColor: selected
                                ? colors.accent
                                : colors.border,
                              opacity: pressed ? 0.72 : 1,
                            },
                          ]}
                        >
                          <Text
                            style={{
                              color: selected
                                ? colors.onAccent
                                : colors.foreground,
                              fontSize: 14,
                              fontWeight: "800",
                            }}
                          >
                            {distanceKm} km
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              </>
            )}
          </View>

          <View
            style={[
              styles.defaultSportCard,
              { borderColor: colors.border, backgroundColor: colors.surface },
            ]}
          >
            <Text style={[styles.rowLabel, { color: colors.foreground }]}>
              {t("settings.presetSport")}
            </Text>
            <Text style={[styles.rowHint, { color: colors.muted }]}>
              {t("settings.presetSportHint")}
            </Text>
            <View style={styles.defaultSportOptions}>
              {Object.entries(SPORT_META).map(([sportType, meta]) => {
                const selected = settings.defaultSportType === sportType;
                return (
                  <Pressable
                    key={sportType}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() =>
                      void updateSettings({
                        defaultSportType: sportType as keyof typeof SPORT_META,
                      })
                    }
                    style={({ pressed }) => [
                      styles.defaultSportOption,
                      {
                        borderColor: selected ? meta.accent : colors.border,
                        backgroundColor: selected
                          ? `${meta.accent}22`
                          : colors.background,
                        opacity: pressed ? 0.7 : 1,
                      },
                    ]}
                  >
                    <Text style={styles.defaultSportIcon}>{meta.icon}</Text>
                    <Text
                      numberOfLines={1}
                      style={{
                        color: selected ? meta.accent : colors.foreground,
                        fontSize: 12,
                        fontWeight: "800",
                      }}
                    >
                      {t(
                        `sports.${sportType === "trail_running" ? "trailRunning" : sportType}`,
                      )}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View
            style={[
              styles.defaultSportCard,
              {
                borderColor: colors.border,
                backgroundColor: colors.surface,
                marginTop: 14,
              },
            ]}
          >
            <ToggleRow
              icon="pause.circle.fill"
              label={t("supply.autoPause")}
              value={settings.idleAutoPauseEnabled}
              colors={colors}
              onToggle={(enabled) =>
                updateSettings({ idleAutoPauseEnabled: enabled })
              }
            />
            <Divider colors={colors} />
            <View style={styles.lapSettingContent}>
              <Text style={[styles.rowLabel, { color: colors.foreground }]}>
                {t("settings.autoPauseRules")}
              </Text>
              <Text style={[styles.rowHint, { color: colors.muted }]}>
                {t("settings.autoPauseDescription")}
              </Text>
            </View>
          </View>

          {/* ── 個人資料 ── */}
          <SectionHeader
            title={t("settingsDetail.personalProfile")}
            colors={colors}
            onToggle={() => toggleSection("personal")}
            collapsed={collapsedSections["personal"]}
          />
          {!collapsedSections["personal"] && (
            <View style={[styles.section, { borderColor: colors.border }]}>
              <TextRow
                icon="calendar"
                label={t("settingsDetail.birthday")}
                value={settings.birthday ?? t("settingsDetail.notSet")}
                colors={colors}
                hint={
                  settings.birthday
                    ? t("settingsDetail.birthdaySetHint", { age: currentAge })
                    : t("settingsDetail.birthdayUnsetHint")
                }
                onPress={openBirthdayEdit}
              />
              <Divider colors={colors} />
              <NumberRow
                icon="person.fill"
                label={t("settingsDetail.weight")}
                value={settings.weight}
                unit="kg"
                colors={colors}
                onPress={() =>
                  openEdit(
                    "weight",
                    t("settingsDetail.weight"),
                    settings.weight,
                    "kg",
                  )
                }
              />
              <Divider colors={colors} />
              <NumberRow
                icon="bicycle"
                label={t("settingsDetail.bikeWeight")}
                value={settings.bikeWeight}
                unit="kg"
                colors={colors}
                hint={t("settingsDetail.bikeWeightHint")}
                onPress={() =>
                  openEdit(
                    "bikeWeight",
                    t("settingsDetail.bikeWeightEdit"),
                    settings.bikeWeight,
                    "kg",
                  )
                }
              />
              <Divider colors={colors} />
              <NumberRow
                icon="arrow.up"
                label={t("settingsDetail.height")}
                value={settings.height}
                unit="cm"
                colors={colors}
                onPress={() =>
                  openEdit(
                    "height",
                    t("settingsDetail.height"),
                    settings.height,
                    "cm",
                  )
                }
              />
              <Divider colors={colors} />
              <View style={styles.autoMetricsNote}>
                <Text style={[styles.rowHint, { color: colors.muted }]}>
                  {t("settingsDetail.autoMetricsIntro")}
                </Text>
              </View>
              <Divider colors={colors} />
              <View style={styles.autoMetricValues}>
                <Text style={[styles.rowLabel, { color: colors.foreground }]}>
                  {t("settingsDetail.appEstimated")}
                </Text>
                <Text style={[styles.rowHint, { color: colors.muted }]}>
                  {t("settingsDetail.autoMetrics", {
                    ftp: autoPersonalMetrics.ftpW,
                    maxHeartRate: autoPersonalMetrics.maxHeartRate,
                    restingHeartRate: autoPersonalMetrics.restingHeartRate,
                  })}
                </Text>
                <Text style={[styles.rowHint, { color: colors.muted }]}>
                  {t("settingsDetail.rpeHint")}
                </Text>
                <Text style={[styles.rowHint, { color: colors.muted }]}>
                  {autoPersonalMetrics.sourceRideCount
                    ? t("settingsDetail.metricsFromRides", {
                        count: autoPersonalMetrics.sourceRideCount,
                      })
                    : t("settingsDetail.metricsFallback")}
                </Text>
              </View>
            </View>
          )}

          {/* ── 背景 GPS 精度 ── */}
          <SectionHeader
            title={t("settingsDetail.backgroundGpsAccuracy")}
            colors={colors}
            onToggle={() => toggleSection("gpsAccuracy")}
            collapsed={collapsedSections["gpsAccuracy"]}
          />
          {!collapsedSections["gpsAccuracy"] && (
            <View style={[styles.section, { borderColor: colors.border }]}>
              <View
                style={{ paddingHorizontal: 16, paddingVertical: 12, gap: 12 }}
              >
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  {t("settingsDetail.backgroundGpsHint")}
                </Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {(["power_saving", "standard", "high_accuracy"] as const).map(
                    (level) => (
                      <Pressable
                        key={level}
                        style={({ pressed }) => [
                          {
                            flex: 1,
                            paddingVertical: 10,
                            paddingHorizontal: 8,
                            borderRadius: 8,
                            backgroundColor:
                              settings.gpsAccuracy === level
                                ? colors.primary
                                : colors.surface,
                            borderWidth: 1,
                            borderColor:
                              settings.gpsAccuracy === level
                                ? colors.primary
                                : colors.border,
                            opacity: pressed ? 0.8 : 1,
                          },
                        ]}
                        onPress={() => updateSettings({ gpsAccuracy: level })}
                      >
                        <Text
                          style={{
                            color:
                              settings.gpsAccuracy === level
                                ? colors.onAccent
                                : colors.foreground,
                            fontSize: 12,
                            fontWeight: "700",
                            textAlign: "center",
                          }}
                        >
                          {level === "power_saving"
                            ? t("settingsDetail.gpsPowerSaving")
                            : level === "standard"
                              ? t("settingsDetail.gpsStandard")
                              : t("settingsDetail.gpsHighAccuracy")}
                        </Text>
                        <Text
                          style={{
                            color:
                              settings.gpsAccuracy === level
                                ? colors.onAccent
                                : colors.muted,
                            fontSize: 11,
                            fontWeight: "600",
                            textAlign: "center",
                            marginTop: 2,
                          }}
                        >
                          {level === "power_saving"
                            ? "15s / 30m"
                            : level === "standard"
                              ? "5s / 10m"
                              : "3s / 5m"}
                        </Text>
                      </Pressable>
                    ),
                  )}
                </View>
              </View>
            </View>
          )}
        </SettingsCategory>

        <SettingsCategory
          icon="bell.fill"
          title={t("settings.supplyReminders")}
          subtitle={t("settings.supplyRemindersHint")}
          colors={colors}
          expanded={Boolean(openCategories.alerts)}
          onPress={() => toggleCategory("alerts")}
        >
          {/* ── 補給提醒 ── */}
          <SectionHeader
            title={t("settingsDetail.supplyReminders")}
            colors={colors}
            onToggle={() => toggleSection("supply")}
            collapsed={collapsedSections["supply"]}
          />
          {!collapsedSections["supply"] && (
            <View style={[styles.section, { borderColor: colors.border }]}>
              <ToggleRow
                icon="bell.badge.fill"
                label={t("settingsDetail.enableSupplyReminders")}
                value={settings.supplyReminderEnabled}
                colors={colors}
                onToggle={(enabled) =>
                  updateSettings({ supplyReminderEnabled: enabled })
                }
              />
              <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
                <Text
                  style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}
                >
                  {settings.supplyReminderEnabled
                    ? t("settingsDetail.supplyEnabledHint")
                    : t("settingsDetail.supplyDisabledHint")}
                </Text>
              </View>
              <Divider colors={colors} />
              <ToggleRow
                icon="flame.fill"
                label={t("settingsDetail.smartEnergy")}
                value={settings.smartEnergySupplyEnabled}
                colors={colors}
                disabled={supplyControlsDisabled}
                onToggle={(enabled) =>
                  updateSettings({
                    smartEnergySupplyEnabled: enabled,
                    ...(enabled
                      ? {
                          supplyEnergyTimeIntervalEnabled: false,
                          supplyEnergyDistanceIntervalEnabled: false,
                        }
                      : {}),
                  })
                }
              />
              <ToggleRow
                icon="drop.fill"
                label={t("settingsDetail.smartHydration")}
                value={settings.smartWaterSupplyEnabled}
                colors={colors}
                disabled={supplyControlsDisabled}
                onToggle={(enabled) =>
                  updateSettings({
                    smartWaterSupplyEnabled: enabled,
                    ...(enabled
                      ? {
                          supplyWaterTimeIntervalEnabled: false,
                          supplyWaterDistanceIntervalEnabled: false,
                        }
                      : {}),
                  })
                }
              />
              <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
                <Text
                  style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}
                >
                  {settings.smartEnergySupplyEnabled &&
                  settings.smartWaterSupplyEnabled
                    ? t("settingsDetail.smartBothHint", {
                        serving: settings.energyServingCarbohydrateG,
                      })
                    : settings.smartEnergySupplyEnabled
                      ? t("settingsDetail.smartEnergyHint", {
                          serving: settings.energyServingCarbohydrateG,
                        })
                      : settings.smartWaterSupplyEnabled
                        ? t("settingsDetail.smartWaterHint")
                        : t("settingsDetail.smartOffHint")}
                </Text>
              </View>
              <Divider colors={colors} />
              <NumberRow
                icon="flame.fill"
                label={t("settingsDetail.servingCarbohydrate")}
                value={settings.energyServingCarbohydrateG}
                unit="g"
                colors={colors}
                iconColor="#D97706"
                hint={t("settingsDetail.servingCarbohydrateHint")}
                disabled={supplyControlsDisabled}
                onPress={() =>
                  openEdit(
                    "energyServingCarbohydrateG",
                    t("settingsDetail.servingCarbohydrateEdit"),
                    settings.energyServingCarbohydrateG,
                    "g",
                  )
                }
              />
              <Divider colors={colors} />
              <ToggleRow
                icon="chart.bar.fill"
                label={t("settingsDetail.scienceCarbohydrate")}
                value={settings.energyCarbohydrateHourlyLimitMode === "science"}
                colors={colors}
                disabled={supplyControlsDisabled}
                onToggle={(enabled) =>
                  updateSettings({
                    energyCarbohydrateHourlyLimitMode: enabled
                      ? "science"
                      : "manual",
                  })
                }
              />
              <NumberRow
                icon="chart.bar.fill"
                label={t("settingsDetail.hourlyCarbohydrateLimit")}
                value={effectiveCarbohydrateHourlyLimitG}
                unit="g/h"
                colors={colors}
                iconColor="#D97706"
                hint={
                  settings.energyCarbohydrateHourlyLimitMode === "science"
                    ? t("settingsDetail.scienceCarbohydrateHint", {
                        weight: settings.weight,
                        rate: effectiveCarbohydrateHourlyLimitG,
                        perKg: "0.7",
                      })
                    : t("settingsDetail.manualCarbohydrateHint")
                }
                disabled={
                  supplyControlsDisabled ||
                  settings.energyCarbohydrateHourlyLimitMode === "science"
                }
                onPress={() =>
                  openEdit(
                    "energyCarbohydrateHourlyLimitG",
                    t("settingsDetail.hourlyCarbohydrateLimit"),
                    settings.energyCarbohydrateHourlyLimitG,
                    "g/h",
                  )
                }
              />
              {settings.energyCarbohydrateHourlyLimitMode === "manual" && (
                <View style={styles.supplyRepeatPresetRow}>
                  <Text
                    style={[
                      styles.supplyRepeatPresetLabel,
                      { color: colors.muted },
                    ]}
                  >
                    {t("settingsDetail.smartCalculation")}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t(
                      "settingsDetail.applyHourlyLimitA11y",
                      { rate: smartCarbohydrateHourlySuggestionG },
                    )}
                    disabled={supplyControlsDisabled}
                    onPress={() =>
                      void updateSettings({
                        energyCarbohydrateHourlyLimitG:
                          smartCarbohydrateHourlySuggestionG,
                      })
                    }
                    style={({ pressed }) => [
                      styles.supplyRepeatPreset,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                        opacity: supplyControlsDisabled
                          ? 0.45
                          : pressed
                            ? 0.65
                            : 1,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color: supplyControlsDisabled
                          ? colors.muted
                          : colors.foreground,
                        fontSize: 14,
                        fontWeight: "800",
                      }}
                    >
                      {t("settingsDetail.applyHourlyLimit", {
                        rate: smartCarbohydrateHourlySuggestionG,
                      })}
                    </Text>
                  </Pressable>
                </View>
              )}
              <Divider colors={colors} />
              {(settings.smartEnergySupplyEnabled ||
                settings.smartWaterSupplyEnabled) && (
                <View style={{ paddingHorizontal: 16, paddingVertical: 10 }}>
                  <Text
                    style={{
                      color: colors.muted,
                      fontSize: 12,
                      lineHeight: 18,
                    }}
                  >
                    {t("settingsDetail.smartRuleNotice")}
                  </Text>
                </View>
              )}
              {!settings.smartEnergySupplyEnabled && (
                <>
                  <View style={styles.intervalGroupHeader}>
                    <IconSymbol name="flame.fill" size={18} color="#D97706" />
                    <View style={styles.intervalGroupTitleWrap}>
                      <Text
                        style={[
                          styles.intervalGroupTitle,
                          { color: colors.foreground },
                        ]}
                      >
                        {t("settingsDetail.energyReminders")}
                      </Text>
                      <Text
                        style={[
                          styles.intervalGroupHint,
                          { color: colors.muted },
                        ]}
                      >
                        {t("settingsDetail.energyRuleHint")}
                      </Text>
                    </View>
                  </View>
                  <ToggleRow
                    icon="clock.fill"
                    label={t("settingsDetail.energyByTime")}
                    value={settings.supplyEnergyTimeIntervalEnabled}
                    colors={colors}
                    disabled={supplyControlsDisabled}
                    onToggle={(enabled) =>
                      updateSettings({
                        supplyEnergyTimeIntervalEnabled: enabled,
                        ...(enabled
                          ? { supplyEnergyDistanceIntervalEnabled: false }
                          : {}),
                      })
                    }
                  />
                  {settings.supplyEnergyTimeIntervalEnabled && (
                    <NumberRow
                      icon="clock.fill"
                      label={t("settingsDetail.energyTimeInterval")}
                      value={settings.supplyEnergyTimeIntervalMinutes}
                      unit={t("settingsDetail.minutes")}
                      colors={colors}
                      iconColor="#D97706"
                      hint={t("settingsDetail.restartEnergyTimer")}
                      disabled={supplyControlsDisabled}
                      onPress={() =>
                        openEdit(
                          "supplyEnergyTimeIntervalMinutes",
                          t("settingsDetail.energyTimeEdit"),
                          settings.supplyEnergyTimeIntervalMinutes,
                          t("settingsDetail.minutes"),
                        )
                      }
                    />
                  )}
                  <ToggleRow
                    icon="location.fill"
                    label={t("settingsDetail.energyByDistance")}
                    value={settings.supplyEnergyDistanceIntervalEnabled}
                    colors={colors}
                    disabled={supplyControlsDisabled}
                    onToggle={(enabled) =>
                      updateSettings({
                        supplyEnergyDistanceIntervalEnabled: enabled,
                        ...(enabled
                          ? { supplyEnergyTimeIntervalEnabled: false }
                          : {}),
                      })
                    }
                  />
                  {settings.supplyEnergyDistanceIntervalEnabled && (
                    <NumberRow
                      icon="location.fill"
                      label={t("settingsDetail.energyDistanceInterval")}
                      value={settings.supplyEnergyDistanceIntervalKm}
                      unit="km"
                      colors={colors}
                      iconColor="#D97706"
                      hint={t("settingsDetail.restartEnergyDistance")}
                      disabled={supplyControlsDisabled}
                      onPress={() =>
                        openEdit(
                          "supplyEnergyDistanceIntervalKm",
                          t("settingsDetail.energyDistanceEdit"),
                          settings.supplyEnergyDistanceIntervalKm,
                          "km",
                        )
                      }
                    />
                  )}
                </>
              )}
              {!settings.smartWaterSupplyEnabled && (
                <>
                  <Divider colors={colors} />
                  <View style={styles.intervalGroupHeader}>
                    <IconSymbol name="drop.fill" size={18} color="#0284C7" />
                    <View style={styles.intervalGroupTitleWrap}>
                      <Text
                        style={[
                          styles.intervalGroupTitle,
                          { color: colors.foreground },
                        ]}
                      >
                        {t("settingsDetail.waterReminders")}
                      </Text>
                      <Text
                        style={[
                          styles.intervalGroupHint,
                          { color: colors.muted },
                        ]}
                      >
                        {t("settingsDetail.waterRuleHint")}
                      </Text>
                    </View>
                  </View>
                  <ToggleRow
                    icon="clock.fill"
                    label={t("settingsDetail.waterByTime")}
                    value={settings.supplyWaterTimeIntervalEnabled}
                    colors={colors}
                    disabled={supplyControlsDisabled}
                    onToggle={(enabled) =>
                      updateSettings({
                        supplyWaterTimeIntervalEnabled: enabled,
                        ...(enabled
                          ? { supplyWaterDistanceIntervalEnabled: false }
                          : {}),
                      })
                    }
                  />
                  {settings.supplyWaterTimeIntervalEnabled && (
                    <NumberRow
                      icon="clock.fill"
                      label={t("settingsDetail.waterTimeInterval")}
                      value={settings.supplyWaterTimeIntervalMinutes}
                      unit={t("settingsDetail.minutes")}
                      colors={colors}
                      iconColor="#0284C7"
                      hint={t("settingsDetail.restartWaterTimer")}
                      disabled={supplyControlsDisabled}
                      onPress={() =>
                        openEdit(
                          "supplyWaterTimeIntervalMinutes",
                          t("settingsDetail.waterTimeEdit"),
                          settings.supplyWaterTimeIntervalMinutes,
                          t("settingsDetail.minutes"),
                        )
                      }
                    />
                  )}
                  <ToggleRow
                    icon="location.fill"
                    label={t("settingsDetail.waterByDistance")}
                    value={settings.supplyWaterDistanceIntervalEnabled}
                    colors={colors}
                    disabled={supplyControlsDisabled}
                    onToggle={(enabled) =>
                      updateSettings({
                        supplyWaterDistanceIntervalEnabled: enabled,
                        ...(enabled
                          ? { supplyWaterTimeIntervalEnabled: false }
                          : {}),
                      })
                    }
                  />
                  {settings.supplyWaterDistanceIntervalEnabled && (
                    <NumberRow
                      icon="location.fill"
                      label={t("settingsDetail.waterDistanceInterval")}
                      value={settings.supplyWaterDistanceIntervalKm}
                      unit="km"
                      colors={colors}
                      iconColor="#0284C7"
                      hint={t("settingsDetail.restartWaterDistance")}
                      disabled={supplyControlsDisabled}
                      onPress={() =>
                        openEdit(
                          "supplyWaterDistanceIntervalKm",
                          t("settingsDetail.waterDistanceEdit"),
                          settings.supplyWaterDistanceIntervalKm,
                          "km",
                        )
                      }
                    />
                  )}
                </>
              )}
              <Divider colors={colors} />
              <NumberRow
                icon="bell.badge.fill"
                label={t("settingsDetail.repeatReminder")}
                value={settings.supplyReminderRepeatSec}
                unit={t("settingsDetail.seconds")}
                colors={colors}
                iconColor={colors.primary}
                hint={
                  settings.supplyReminderRepeatSec === 0
                    ? t("settingsDetail.repeatOffHint")
                    : t("settingsDetail.repeatHint", {
                        seconds: settings.supplyReminderRepeatSec,
                      })
                }
                disabled={supplyControlsDisabled}
                onPress={() =>
                  openEdit(
                    "supplyReminderRepeatSec",
                    t("settingsDetail.repeatEdit"),
                    settings.supplyReminderRepeatSec,
                    t("settingsDetail.seconds"),
                  )
                }
              />
              <View style={styles.supplyRepeatPresetRow}>
                <Text
                  style={[
                    styles.supplyRepeatPresetLabel,
                    { color: colors.muted },
                  ]}
                >
                  {t("settingsDetail.quickSet")}
                </Text>
                {[0, 30, 60].map((seconds) => {
                  const selected = settings.supplyReminderRepeatSec === seconds;
                  return (
                    <Pressable
                      key={seconds}
                      accessibilityRole="button"
                      accessibilityState={{
                        selected,
                        disabled: supplyControlsDisabled,
                      }}
                      accessibilityLabel={
                        seconds === 0
                          ? t("settingsDetail.disableRepeats")
                          : t("settingsDetail.repeatEvery", { seconds })
                      }
                      disabled={supplyControlsDisabled}
                      onPress={() =>
                        void updateSettings({
                          supplyReminderRepeatSec: seconds,
                        })
                      }
                      style={({ pressed }) => [
                        styles.supplyRepeatPreset,
                        {
                          backgroundColor:
                            selected && !supplyControlsDisabled
                              ? colors.accent
                              : colors.surface,
                          borderColor:
                            selected && !supplyControlsDisabled
                              ? colors.accent
                              : colors.border,
                          opacity: supplyControlsDisabled
                            ? 0.45
                            : pressed
                              ? 0.65
                              : 1,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          color:
                            selected && !supplyControlsDisabled
                              ? colors.onAccent
                              : supplyControlsDisabled
                                ? colors.muted
                                : colors.foreground,
                          fontSize: 14,
                          fontWeight: "800",
                        }}
                      >
                        {seconds === 0
                          ? t("settingsDetail.off")
                          : t("settingsDetail.repeatEvery", { seconds })}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {/* ── 自訂補給品清單 ── */}
          <SectionHeader
            title={t("settingsDetail.customSupply")}
            colors={colors}
            onToggle={() => toggleSection("customSupply")}
            collapsed={collapsedSections["customSupply"]}
          />
          {!collapsedSections["customSupply"] && (
            <View
              style={[
                styles.section,
                { borderColor: colors.border },
                supplyControlsDisabled && { opacity: 0.45 },
              ]}
            >
              {/* 快速新延預設補給品已移除 */}
              {settings.supplyItems.length === 0 ? (
                <View style={{ padding: 16, alignItems: "center" }}>
                  <Text style={{ color: colors.muted, fontSize: 14 }}>
                    {t("settingsDetail.noCustomSupply")}
                  </Text>
                </View>
              ) : (
                settings.supplyItems.map((item, idx) => (
                  <View key={item.id}>
                    <View style={[styles.row, { paddingVertical: 12 }]}>
                      <View style={{ flex: 1 }}>
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 8,
                            marginBottom: 4 /* internal spacing */,
                          }}
                        >
                          <Switch
                            value={item.enabled}
                            onValueChange={(v) =>
                              updateSupplyItem(item.id, { enabled: v })
                            }
                            disabled={supplyControlsDisabled}
                          />
                          <Pressable
                            style={{ flex: 1 }}
                            onPress={() => openSupplyModal(item)}
                            disabled={supplyControlsDisabled}
                          >
                            <Text
                              style={[
                                styles.rowLabel,
                                { color: colors.foreground },
                              ]}
                            >
                              {item.name}
                            </Text>
                            <Text
                              style={[
                                styles.rowHint,
                                { color: colors.muted, fontSize: 12 },
                              ]}
                            >
                              {item.target === "water"
                                ? t("settingsDetail.sharedWaterReminder")
                                : t("settingsDetail.sharedEnergyReminder")}{" "}
                              •{" "}
                              {item.triggerType === "time"
                                ? t("settingsDetail.supplyTimeSummary", {
                                    hours: item.triggerHours || 0,
                                    minutes: item.triggerMinutes || 0,
                                    seconds: item.triggerSeconds || 0,
                                  })
                                : t("settingsDetail.supplyDistanceSummary", {
                                    distance: item.triggerValue,
                                  })}
                            </Text>
                          </Pressable>
                        </View>
                      </View>
                      <Pressable
                        style={({ pressed }) => [
                          {
                            opacity: supplyControlsDisabled
                              ? 0.45
                              : pressed
                                ? 0.6
                                : 1,
                          },
                        ]}
                        onPress={() => handleDeleteSupply(item.id)}
                        disabled={supplyControlsDisabled}
                      >
                        <IconSymbol
                          name="trash.fill"
                          size={18}
                          color={colors.error}
                        />
                      </Pressable>
                    </View>
                    {idx < settings.supplyItems.length - 1 && (
                      <Divider colors={colors} />
                    )}
                  </View>
                ))
              )}
              <Divider colors={colors} />
              <Pressable
                style={({ pressed }) => [
                  styles.row,
                  {
                    opacity: supplyControlsDisabled ? 0.45 : pressed ? 0.7 : 1,
                  },
                ]}
                onPress={() => openSupplyModal()}
                disabled={supplyControlsDisabled}
              >
                <IconSymbol
                  name="plus.circle.fill"
                  size={18}
                  color={colors.primary}
                />
                <Text style={[styles.rowLabel, { color: colors.primary }]}>
                  {t("settingsDetail.addSupply")}
                </Text>
              </Pressable>
            </View>
          )}

          {/* ── 回饋設定 ── */}
          <SectionHeader
            title={t("settingsDetail.feedback")}
            colors={colors}
            onToggle={() => toggleSection("feedback")}
            collapsed={collapsedSections["feedback"]}
          />
          {!collapsedSections["feedback"] && (
            <View style={[styles.section, { borderColor: colors.border }]}>
              <ToggleRow
                icon="iphone.radiowaves.left.and.right"
                label={t("settingsDetail.vibration")}
                value={settings.vibrationEnabled}
                colors={colors}
                onToggle={(v) => updateSettings({ vibrationEnabled: v })}
              />
              <Divider colors={colors} />
              <ToggleRow
                icon="speaker.wave.2.fill"
                label={t("settingsDetail.tts")}
                value={settings.ttsEnabled}
                colors={colors}
                onToggle={(v) => updateSettings({ ttsEnabled: v })}
              />
              <Divider colors={colors} />
              <ToggleRow
                icon="music.note"
                label={t("settingsDetail.sound")}
                value={settings.soundEnabled}
                colors={colors}
                onToggle={(v) => updateSettings({ soundEnabled: v })}
              />
              <Divider colors={colors} />
              <ToggleRow
                icon="bell.fill"
                label={t("settingsDetail.notifications")}
                value={settings.notificationEnabled}
                colors={colors}
                onToggle={(v) => updateSettings({ notificationEnabled: v })}
              />
            </View>
          )}
        </SettingsCategory>

        <SettingsCategory
          icon="moon.fill"
          title={t("settings.displayAppearance")}
          subtitle={t("settingsDetail.displayAppearanceHint")}
          colors={colors}
          expanded={Boolean(openCategories.display)}
          onPress={() => toggleCategory("display")}
        >
          <View
            style={[
              styles.appearanceCard,
              { borderColor: colors.border, backgroundColor: colors.surface },
            ]}
          >
            <Text style={[styles.rowLabel, { color: colors.foreground }]}>
              {t("settingsDetail.appearanceTheme")}
            </Text>
            <Text style={[styles.rowHint, { color: colors.muted }]}>
              {t("settingsDetail.appearanceThemeHint")}
            </Text>
            <View style={styles.lapModeOptions}>
              {(
                [
                  { key: "system", label: t("settingsDetail.themeSystem") },
                  { key: "light", label: t("settingsDetail.themeLight") },
                  { key: "dark", label: t("settingsDetail.themeDark") },
                ] as const
              ).map(({ key, label }) => {
                const selected = settings.appearanceMode === key;
                return (
                  <Pressable
                    key={key}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => void updateSettings({ appearanceMode: key })}
                    style={({ pressed }) => [
                      styles.lapModeOption,
                      {
                        backgroundColor: selected
                          ? colors.accent
                          : colors.background,
                        borderColor: selected ? colors.accent : colors.border,
                        opacity: pressed ? 0.72 : 1,
                      },
                    ]}
                  >
                    <Text
                      numberOfLines={1}
                      style={{
                        color: selected ? colors.onAccent : colors.foreground,
                        fontSize: 13,
                        fontWeight: "800",
                      }}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          {/* ── 智慧省電模式 ── */}
          <SectionHeader
            title={t("settingsDetail.smartPowerSaving")}
            colors={colors}
            onToggle={() => toggleSection("powerSaving")}
            collapsed={collapsedSections["powerSaving"]}
          />
          {!collapsedSections["powerSaving"] && (
            <View style={[styles.section, { borderColor: colors.border }]}>
              <ToggleRow
                icon="moon.fill"
                label={t("settingsDetail.autoPowerSaving")}
                value={powerSavingSettings.enabled}
                colors={colors}
                onToggle={(enabled) => {
                  void updatePowerSavingSettings({ enabled });
                }}
              />
              <Divider colors={colors} />
              <View style={styles.row}>
                <IconSymbol name="moon.fill" size={18} color={colors.muted} />
                <View style={styles.rowCopy}>
                  <Text
                    style={[styles.rowLabel, { color: colors.foreground }]}
                    allowFontScaling
                  >
                    {t("settingsDetail.dimAfterIdle")}
                  </Text>
                  <Text
                    style={[styles.rowHint, { color: colors.muted }]}
                    allowFontScaling
                  >
                    {t("settingsDetail.dimAfterIdleHint")}
                  </Text>
                </View>
                <TextInput
                  style={[
                    styles.numericInput,
                    { color: colors.foreground, borderColor: colors.border },
                  ]}
                  value={String(powerSavingSettings.timeoutSeconds)}
                  onChangeText={(value) => {
                    const seconds = Math.max(
                      15,
                      Math.min(3600, Number.parseInt(value || "15", 10) || 15),
                    );
                    void updatePowerSavingSettings({ timeoutSeconds: seconds });
                  }}
                  keyboardType="number-pad"
                  returnKeyType="done"
                  editable={powerSavingSettings.enabled}
                />
                <Text
                  style={[
                    styles.rowHint,
                    { color: colors.muted, marginLeft: 6 },
                  ]}
                >
                  {t("settingsDetail.seconds")}
                </Text>
              </View>
              <Divider colors={colors} />
              <View style={styles.row}>
                <IconSymbol
                  name="clock.badge.exclamationmark"
                  size={18}
                  color={colors.muted}
                />
                <View style={styles.rowCopy}>
                  <Text
                    style={[styles.rowLabel, { color: colors.foreground }]}
                    allowFontScaling
                  >
                    {t("settingsDetail.idlePowerMonitoring")}
                  </Text>
                  <Text
                    style={[styles.rowHint, { color: colors.muted }]}
                    allowFontScaling
                  >
                    {t("settingsDetail.idlePowerMonitoringHint")}
                  </Text>
                </View>
                <TextInput
                  style={[
                    styles.numericInput,
                    { color: colors.foreground, borderColor: colors.border },
                  ]}
                  value={String(settings.idleAutoPauseSeconds)}
                  onChangeText={(value) => {
                    const seconds = Math.max(
                      30,
                      Math.min(900, Number.parseInt(value || "30", 10) || 30),
                    );
                    void updateSettings({ idleAutoPauseSeconds: seconds });
                  }}
                  keyboardType="number-pad"
                  returnKeyType="done"
                  editable={settings.idleAutoPauseEnabled}
                />
                <Text
                  style={[
                    styles.rowHint,
                    { color: colors.muted, marginLeft: 6 },
                  ]}
                >
                  {t("settingsDetail.seconds")}
                </Text>
              </View>
            </View>
          )}

          {/* ── 騎乘防誤觸 ── */}
          <SectionHeader
            title={t("settingsDetail.touchGuard")}
            colors={colors}
            onToggle={() => toggleSection("touchGuard")}
            collapsed={collapsedSections["touchGuard"]}
          />
          {!collapsedSections["touchGuard"] && (
            <View style={[styles.section, { borderColor: colors.border }]}>
              <ToggleRow
                icon="lock.fill"
                label={t("settingsDetail.autoLockTouch")}
                value={settings.touchGuardEnabled}
                colors={colors}
                onToggle={(enabled) =>
                  updateSettings({ touchGuardEnabled: enabled })
                }
              />
              <Divider colors={colors} />
              <View style={[styles.row, { alignItems: "flex-start" }]}>
                <IconSymbol name="lock.fill" size={18} color={colors.muted} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowLabel, { color: colors.foreground }]}>
                    {t("settingsDetail.unlockHold")}
                  </Text>
                  <Text style={[styles.rowHint, { color: colors.muted }]}>
                    {t("settingsDetail.unlockHoldHint")}
                  </Text>
                  <View style={styles.touchGuardPresetRow}>
                    {TOUCH_GUARD_UNLOCK_HOLD_PRESETS.map((milliseconds) => {
                      const selected =
                        settings.touchGuardUnlockHoldMs === milliseconds;
                      return (
                        <Pressable
                          key={milliseconds}
                          accessibilityRole="button"
                          accessibilityState={{
                            selected,
                            disabled: !settings.touchGuardEnabled,
                          }}
                          onPress={() =>
                            void updateSettings({
                              touchGuardUnlockHoldMs: milliseconds,
                            })
                          }
                          disabled={!settings.touchGuardEnabled}
                          style={({ pressed }) => [
                            styles.touchGuardPreset,
                            {
                              backgroundColor: selected
                                ? colors.accent
                                : colors.surface,
                              borderColor: selected
                                ? colors.accent
                                : colors.border,
                              opacity:
                                pressed || !settings.touchGuardEnabled
                                  ? 0.6
                                  : 1,
                            },
                          ]}
                        >
                          <Text
                            style={{
                              color: selected
                                ? colors.onAccent
                                : colors.foreground,
                              fontSize: 14,
                              fontWeight: "800",
                            }}
                          >
                            {milliseconds} ms
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              </View>
              <Divider colors={colors} />
              <NumberRow
                icon="lock.fill"
                label={t("settingsDetail.autoRelock")}
                value={settings.touchGuardAutoRelockSec}
                unit={t("settingsDetail.seconds")}
                colors={colors}
                hint={t("settingsDetail.autoRelockHint")}
                disabled={!settings.touchGuardEnabled}
                onPress={() =>
                  openEdit(
                    "touchGuardAutoRelockSec",
                    t("settingsDetail.autoRelock"),
                    settings.touchGuardAutoRelockSec,
                    t("settingsDetail.seconds"),
                  )
                }
              />
            </View>
          )}

          {/* ── 精簡導航模式 ── */}
          <SectionHeader
            title={t("settingsDetail.simplifiedNavigation")}
            colors={colors}
            onToggle={() => toggleSection("simplified")}
            collapsed={collapsedSections["simplified"]}
          />
          {!collapsedSections["simplified"] && (
            <View style={[styles.section, { borderColor: colors.border }]}>
              <View style={styles.row}>
                <IconSymbol name="moon.fill" size={18} color={colors.muted} />
                <Text
                  style={[
                    styles.rowLabel,
                    { color: colors.foreground, flex: 1 },
                  ]}
                >
                  {t("settingsDetail.modeSelection")}
                </Text>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  {(["off", "manual", "auto"] as const).map((mode) => (
                    <Pressable
                      key={mode}
                      style={({ pressed }) => [
                        styles.modeChip,
                        {
                          backgroundColor:
                            settings.simplifiedNavMode === mode
                              ? colors.accent
                              : colors.surface,
                          borderColor:
                            settings.simplifiedNavMode === mode
                              ? colors.accent
                              : colors.border,
                          opacity: pressed ? 0.7 : 1,
                        },
                      ]}
                      onPress={() =>
                        updateSettings({ simplifiedNavMode: mode })
                      }
                    >
                      <Text
                        style={[
                          styles.modeChipText,
                          {
                            color:
                              settings.simplifiedNavMode === mode
                                ? "#fff"
                                : colors.muted,
                          },
                        ]}
                      >
                        {mode === "off"
                          ? t("settingsDetail.off")
                          : mode === "manual"
                            ? t("settingsDetail.manual")
                            : t("settingsDetail.automatic")}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              {settings.simplifiedNavMode === "auto" && (
                <>
                  <Divider colors={colors} />
                  <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 6 /* internal spacing */,
                      }}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <IconSymbol
                          name="clock.fill"
                          size={16}
                          color={colors.muted}
                        />
                        <Text
                          style={{ fontSize: 15, color: colors.foreground }}
                        >
                          {t("settingsDetail.simplifiedIdle")}
                        </Text>
                      </View>
                      <Text
                        style={{
                          fontSize: 15,
                          fontWeight: "600",
                          color: colors.primary,
                        }}
                      >
                        {t("settingsDetail.repeatEvery", {
                          seconds: settings.simplifiedNavIdleSec ?? 30,
                        })}
                      </Text>
                    </View>
                    <Slider
                      style={{ width: "100%", height: 36 }}
                      minimumValue={10}
                      maximumValue={120}
                      step={5}
                      value={settings.simplifiedNavIdleSec ?? 30}
                      onValueChange={(v) =>
                        updateSettings({ simplifiedNavIdleSec: Math.round(v) })
                      }
                      minimumTrackTintColor={colors.primary}
                      maximumTrackTintColor={colors.border}
                      thumbTintColor={colors.primary}
                    />
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                      }}
                    >
                      <Text style={{ fontSize: 11, color: colors.muted }}>
                        {t("settingsDetail.repeatEvery", { seconds: 10 })}
                      </Text>
                      <Text style={{ fontSize: 11, color: colors.muted }}>
                        {t("settingsDetail.repeatEvery", { seconds: 120 })}
                      </Text>
                    </View>
                    <Text
                      style={{
                        fontSize: 12,
                        color: colors.muted,
                        marginTop: 4,
                      }}
                    >
                      {t("settingsDetail.simplifiedIdleHint")}
                    </Text>
                  </View>
                </>
              )}
            </View>
          )}

          {/* ── 地圖互動 ── */}
          <SectionHeader
            title={t("settingsDetail.mapInteraction")}
            colors={colors}
            onToggle={() => toggleSection("mapInteraction")}
            collapsed={collapsedSections["mapInteraction"]}
          />
          {!collapsedSections["mapInteraction"] && (
            <View style={[styles.section, { borderColor: colors.border }]}>
              <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 6,
                  }}
                >
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <Text style={{ fontSize: 15, color: colors.foreground }}>
                      {t("settingsDetail.idleRecenter")}
                    </Text>
                    <Text
                      style={{
                        fontSize: 12,
                        color: colors.muted,
                        marginTop: 3,
                      }}
                    >
                      {t("settingsDetail.idleRecenterHint")}
                    </Text>
                  </View>
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: "600",
                      color: colors.primary,
                    }}
                  >
                    {t("settingsDetail.repeatEvery", {
                      seconds: settings.autoRecenterSec,
                    })}
                  </Text>
                </View>
                <Slider
                  testID="idle-recenter-time-slider"
                  style={{ width: "100%", height: 36 }}
                  minimumValue={3}
                  maximumValue={60}
                  step={1}
                  value={settings.autoRecenterSec}
                  onValueChange={(value) =>
                    updateSettings({ autoRecenterSec: Math.round(value) })
                  }
                  minimumTrackTintColor={colors.primary}
                  maximumTrackTintColor={colors.border}
                  thumbTintColor={colors.primary}
                />
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                  }}
                >
                  <Text style={{ fontSize: 11, color: colors.muted }}>
                    {t("settingsDetail.repeatEvery", { seconds: 3 })}
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.muted }}>
                    {t("settingsDetail.repeatEvery", { seconds: 60 })}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* ── 導航儀表板欄位（拖曳排序 + 開關） ── */}
          {/* 導航儀表板欄位標題 + 恢復預設按鈕 */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: 4 /* internal spacing */,
            }}
          >
            <SectionHeader
              title={t("settingsDetail.navigationDashboardFields")}
              colors={colors}
            />
            <Pressable
              onPress={() => {
                LayoutAnimation.configureNext(
                  LayoutAnimation.Presets.easeInEaseOut,
                );
                setDragOrder(DEFAULT_FIELD_ORDER);
                updateFieldOrder(DEFAULT_FIELD_ORDER);
              }}
              style={({ pressed }) => [
                styles.resetBtn,
                {
                  borderColor: colors.border,
                  backgroundColor: pressed ? colors.surface : "transparent",
                },
              ]}
            >
              <Text style={{ fontSize: 12, color: colors.muted }}>
                {t("settingsDetail.restoreDefaults")}
              </Text>
            </Pressable>
          </View>
          <Text
            style={{
              fontSize: 11,
              color: colors.muted,
              marginBottom: 8 /* internal spacing */,
              paddingHorizontal: 4,
            }}
          >
            {t("settingsDetail.dragDashboardFields", { count: 6 })}
          </Text>
          <View style={[styles.section, { borderColor: colors.border }]}>
            {dragOrder.map((key, idx) => {
              const isDragging = draggingIdx === idx;
              const isHover =
                hoverIdx === idx && draggingIdx !== null && draggingIdx !== idx;
              const responder = makeDragResponder(idx);
              return (
                <React.Fragment key={key}>
                  <Animated.View
                    style={[
                      styles.row,
                      isDragging && {
                        backgroundColor: colors.surface,
                        opacity: 0.92,
                        zIndex: 20,
                        boxShadow: "0px 4px 8px rgba(0, 0, 0, 0.22)",
                        transform: [{ scale: 1.025 }],
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: "#34C759",
                      },
                      isHover && { backgroundColor: colors.border + "55" },
                    ]}
                  >
                    <Switch
                      value={settings.normalModeFields?.[key] ?? false}
                      onValueChange={(v) => updateNormalFields({ [key]: v })}
                      trackColor={{ false: "#767577", true: "#34C759" }}
                      thumbColor="#fff"
                      ios_backgroundColor="#767577"
                    />
                    <Text
                      style={[
                        styles.rowLabel,
                        { color: colors.foreground, flex: 1, marginLeft: 4 },
                      ]}
                    >
                      {FIELD_LABELS[key]}
                    </Text>
                    <Text
                      style={[
                        { fontSize: 11, marginRight: 4 },
                        idx < 6
                          ? { color: "#34C759", fontWeight: "600" }
                          : { color: colors.muted },
                      ]}
                    >
                      {idx < 6
                        ? t("settingsDetail.panel")
                        : t("settingsDetail.expand")}
                    </Text>
                    <View {...responder.panHandlers} style={styles.dragHandle}>
                      <Text
                        style={[
                          { fontSize: 20, lineHeight: 24 },
                          isDragging
                            ? { color: "#34C759" }
                            : { color: colors.muted },
                        ]}
                      >
                        ☰
                      </Text>
                    </View>
                  </Animated.View>
                  {idx < dragOrder.length - 1 &&
                    (idx === 5 ? (
                      /* 面板區 / 展開區 分界線 */
                      <View style={styles.panelDivider}>
                        <View
                          style={[
                            styles.panelDividerLine,
                            { borderColor: "#34C759" },
                          ]}
                        />
                        <Text style={styles.panelDividerLabel}>
                          {t("settingsDetail.panelDivider")}
                        </Text>
                        <View
                          style={[
                            styles.panelDividerLine,
                            { borderColor: "#34C759" },
                          ]}
                        />
                      </View>
                    ) : (
                      <Divider colors={colors} />
                    ))}
                </React.Fragment>
              );
            })}
          </View>

          {/* ── 精簡導航模式欄位（拖曳排序 + 開關 + 上限限制） ── */}
          {(() => {
            const SIMPLIFIED_MAX = 3;
            const simplifiedEnabledCount = simpDragOrder.filter(
              (k) => settings.simplifiedModeFields?.[k] ?? false,
            ).length;
            return (
              <>
                {/* 標題 + 恢復預設按鈕 */}
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginBottom: 4 /* internal spacing */,
                  }}
                >
                  <SectionHeader
                    title={t("settingsDetail.compactFields")}
                    colors={colors}
                  />
                  <Pressable
                    onPress={() => {
                      LayoutAnimation.configureNext(
                        LayoutAnimation.Presets.easeInEaseOut,
                      );
                      setSimpDragOrder(DEFAULT_SIMPLIFIED_FIELD_ORDER);
                      updateSimplifiedFieldOrder(
                        DEFAULT_SIMPLIFIED_FIELD_ORDER,
                      );
                    }}
                    style={({ pressed }) => [
                      styles.resetBtn,
                      {
                        borderColor: colors.border,
                        backgroundColor: pressed
                          ? colors.surface
                          : "transparent",
                      },
                    ]}
                  >
                    <Text style={{ fontSize: 12, color: colors.muted }}>
                      {t("settingsDetail.restoreDefaults")}
                    </Text>
                  </Pressable>
                </View>
                {/* 計數徽章 + 說明 */}
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginBottom: 8 /* internal spacing */,
                    paddingHorizontal: 4,
                  }}
                >
                  <Text style={{ fontSize: 11, color: colors.muted, flex: 1 }}>
                    {t("settingsDetail.dragCompactFields", { count: 3 })}
                  </Text>
                  <Text
                    style={[
                      {
                        fontSize: 12,
                        fontWeight: "700",
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                        borderRadius: 10,
                      },
                      simplifiedEnabledCount >= SIMPLIFIED_MAX
                        ? { color: "#fff", backgroundColor: "#FF3B30" }
                        : { color: "#34C759", backgroundColor: "#34C75920" },
                    ]}
                  >
                    {simplifiedEnabledCount} / {SIMPLIFIED_MAX}
                  </Text>
                </View>
                <View style={[styles.section, { borderColor: colors.border }]}>
                  {simpDragOrder.map((key, idx) => {
                    const isOn = settings.simplifiedModeFields?.[key] ?? false;
                    const isDisabled =
                      !isOn && simplifiedEnabledCount >= SIMPLIFIED_MAX;
                    const isSimpDragging = simpDraggingIdx === idx;
                    const isSimpHover =
                      simpHoverIdx === idx &&
                      simpDraggingIdx !== null &&
                      simpDraggingIdx !== idx;
                    const responder = makeSimpDragResponder(idx);
                    return (
                      <React.Fragment key={key}>
                        <Animated.View
                          style={[
                            styles.row,
                            isDisabled && { opacity: 0.4 },
                            isSimpDragging && {
                              backgroundColor: colors.surface,
                              opacity: 0.92,
                              zIndex: 20,
                              boxShadow: "0px 4px 8px rgba(0, 0, 0, 0.22)",
                              transform: [{ scale: 1.025 }],
                              borderRadius: 10,
                              borderWidth: 1,
                              borderColor: "#34C759",
                            },
                            isSimpHover && {
                              backgroundColor: colors.border + "55",
                            },
                          ]}
                        >
                          <Switch
                            value={isOn}
                            disabled={isDisabled}
                            onValueChange={(v) => {
                              if (
                                v &&
                                simplifiedEnabledCount >= SIMPLIFIED_MAX
                              ) {
                                Alert.alert(
                                  t("settingsActions.simplifiedLimitTitle"),
                                  t("settingsActions.simplifiedLimitBody", {
                                    count: SIMPLIFIED_MAX,
                                  }),
                                  [{ text: t("settingsActions.acknowledge") }],
                                );
                                return;
                              }
                              updateSimplifiedFields({ [key]: v });
                            }}
                            trackColor={{ false: "#767577", true: "#34C759" }}
                            thumbColor="#fff"
                            ios_backgroundColor="#767577"
                          />
                          <Text
                            style={[
                              styles.rowLabel,
                              {
                                color: colors.foreground,
                                flex: 1,
                                marginLeft: 4,
                              },
                            ]}
                          >
                            {SIMP_FIELD_LABELS[key]}
                          </Text>
                          <View
                            {...responder.panHandlers}
                            style={styles.dragHandle}
                          >
                            <Text
                              style={[
                                { fontSize: 20, lineHeight: 24 },
                                isSimpDragging
                                  ? { color: "#34C759" }
                                  : { color: colors.muted },
                              ]}
                            >
                              ☰
                            </Text>
                          </View>
                        </Animated.View>
                        {idx < simpDragOrder.length - 1 && (
                          <Divider colors={colors} />
                        )}
                      </React.Fragment>
                    );
                  })}
                </View>
              </>
            );
          })()}
        </SettingsCategory>

        <SettingsCategory
          icon="gearshape.fill"
          title={t("settingsActions.systemDataTitle")}
          subtitle={t("settingsActions.systemDataHint")}
          colors={colors}
          expanded={Boolean(openCategories.system)}
          onPress={() => toggleCategory("system")}
        >
          <RidePermissionReadiness />
          <View
            style={[
              styles.section,
              { borderColor: colors.border, marginTop: 14 },
            ]}
          >
            <Pressable
              testID="settings-language-selector"
              accessibilityRole="button"
              accessibilityLabel={`${t("settings.languageTitle")}：${selectedLanguageLabel}`}
              onPress={() => setLanguageModalVisible(true)}
              style={({ pressed }) => [
                styles.row,
                {
                  opacity: pressed ? 0.72 : 1,
                  flexDirection: isRtl ? "row-reverse" : "row",
                },
              ]}
            >
              <IconSymbol
                name="gearshape.fill"
                size={18}
                color={colors.primary}
              />
              <View style={{ flex: 1, minWidth: 0 }}>
                <AdaptiveFormText
                  baseFontSize={15}
                  style={[
                    styles.rowLabel,
                    {
                      color: colors.foreground,
                      textAlign: isRtl ? "right" : "left",
                    },
                  ]}
                >
                  {t("settings.languageTitle")}
                </AdaptiveFormText>
                <AdaptiveFormText
                  baseFontSize={12}
                  style={[
                    styles.rowHint,
                    {
                      color: colors.muted,
                      textAlign: isRtl ? "right" : "left",
                    },
                  ]}
                >
                  {t("settings.languageHint")}
                </AdaptiveFormText>
              </View>
              <View
                style={{
                  alignItems: isRtl ? "flex-start" : "flex-end",
                  gap: 2,
                }}
              >
                <AdaptiveFormText
                  baseFontSize={14}
                  style={{
                    color: colors.primary,
                    fontWeight: "800",
                    textAlign: isRtl ? "left" : "right",
                  }}
                >
                  {selectedLanguageLabel}
                </AdaptiveFormText>
                {languagePreference === "system" && (
                  <Text style={{ color: colors.muted, fontSize: 11 }}>
                    {activeLanguage}
                  </Text>
                )}
              </View>
            </Pressable>
          </View>
          <View
            style={[
              styles.section,
              { borderColor: colors.border, marginTop: 14 },
            ]}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("settingsActions.openHistoryBackupLabel")}
              onPress={() => router.push("/history")}
              style={({ pressed }) => [
                styles.row,
                { opacity: pressed ? 0.68 : 1 },
              ]}
            >
              <IconSymbol
                name="square.and.arrow.up"
                size={18}
                color={colors.primary}
              />
              <View style={{ flex: 1, minWidth: 0 }}>
                <AdaptiveFormText
                  baseFontSize={15}
                  style={[
                    styles.rowLabel,
                    {
                      color: colors.foreground,
                      textAlign: isRtl ? "right" : "left",
                    },
                  ]}
                >
                  {t("settingsActions.openHistoryBackupLabel")}
                </AdaptiveFormText>
                <AdaptiveFormText
                  baseFontSize={12}
                  style={[
                    styles.rowHint,
                    {
                      color: colors.muted,
                      textAlign: isRtl ? "right" : "left",
                    },
                  ]}
                >
                  {t("settingsActions.openHistoryBackupHint")}
                </AdaptiveFormText>
              </View>
              <IconSymbol name="chevron.right" size={16} color={colors.muted} />
            </Pressable>
          </View>
          <View
            style={[
              styles.section,
              { borderColor: colors.border, marginTop: 14 },
            ]}
          >
            <Pressable
              testID="privacy-policy-entry"
              accessibilityRole="button"
              accessibilityLabel={t("audit.privacyPolicy")}
              onPress={() => router.push("/privacy")}
              style={({ pressed }) => [
                styles.row,
                {
                  opacity: pressed ? 0.68 : 1,
                  flexDirection: isRtl ? "row-reverse" : "row",
                },
              ]}
            >
              <IconSymbol
                name="gearshape.fill"
                size={18}
                color={colors.primary}
              />
              <View style={{ flex: 1, minWidth: 0 }}>
                <AdaptiveFormText
                  baseFontSize={15}
                  style={[
                    styles.rowLabel,
                    {
                      color: colors.foreground,
                      textAlign: isRtl ? "right" : "left",
                    },
                  ]}
                >
                  {t("audit.privacyPolicy")}
                </AdaptiveFormText>
                <AdaptiveFormText
                  baseFontSize={12}
                  style={[
                    styles.rowHint,
                    {
                      color: colors.muted,
                      textAlign: isRtl ? "right" : "left",
                    },
                  ]}
                >
                  {t("audit.privacyUpdated")}
                </AdaptiveFormText>
              </View>
              <IconSymbol name="chevron.right" size={16} color={colors.muted} />
            </Pressable>
          </View>
          <View
            style={[
              styles.section,
              { borderColor: colors.border, marginTop: 24 },
            ]}
          >
            <AdaptiveFormText
              baseFontSize={15}
              style={{
                fontWeight: "800",
                color: colors.foreground,
                textAlign: isRtl ? "right" : "left",
              }}
            >
              {t("settingsActions.settingsManagement")}
            </AdaptiveFormText>
            <AdaptiveFormText
              baseFontSize={12}
              style={{
                lineHeight: 18,
                color: colors.muted,
                marginTop: 6,
                textAlign: isRtl ? "right" : "left",
              }}
            >
              {t("settingsActions.settingsManagementHint")}
            </AdaptiveFormText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("settingsActions.resetAllLabel")}
              onPress={handleResetAllSettings}
              style={({ pressed }) => ({
                marginTop: 14,
                minHeight: 46,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.error,
                backgroundColor: pressed ? `${colors.error}24` : "transparent",
                alignItems: "center",
                justifyContent: "center",
                opacity: pressed ? 0.78 : 1,
              })}
            >
              <AdaptiveFormText
                baseFontSize={15}
                minFontScale={0.72}
                maxLinesBeforeShrink={1}
                style={{
                  color: colors.error,
                  fontWeight: "800",
                  textAlign: "center",
                }}
              >
                {t("settingsActions.resetAllLabel")}
              </AdaptiveFormText>
            </Pressable>
          </View>

          {/* 版本號 */}
          <View
            style={{
              alignItems: "center",
              paddingVertical: 20,
              paddingBottom: 8 /* internal spacing */,
            }}
          >
            <Text style={{ fontSize: 12, color: colors.muted }}>
              {t("settingsDetail.appVersion", {
                version: Constants.expoConfig?.version ?? "1.0.1",
              })}
            </Text>
          </View>
        </SettingsCategory>
      </ScrollView>

      <Modal
        visible={languageModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setLanguageModalVisible(false)}
      >
        <SafeAreaView
          style={[
            styles.modalOverlay,
            { backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
          ]}
        >
          <View
            style={[
              styles.editCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                width: "100%",
                maxWidth: 640,
                maxHeight: "86%",
                borderBottomLeftRadius: 0,
                borderBottomRightRadius: 0,
              },
            ]}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 8,
              }}
            >
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={[styles.editTitle, { color: colors.foreground }]}>
                  {t("settings.languageTitle")}
                </Text>
                <Text style={[styles.rowHint, { color: colors.muted }]}>
                  {t("settings.languageHint")}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("common.close")}
                onPress={() => setLanguageModalVisible(false)}
                style={({ pressed }) => ({
                  opacity: pressed ? 0.6 : 1,
                  padding: 4,
                })}
              >
                <IconSymbol
                  name="xmark.circle.fill"
                  size={24}
                  color={colors.muted}
                />
              </Pressable>
            </View>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingTop: 8, paddingBottom: 8 }}
            >
              {(["system", ...SUPPORTED_LOCALES] as const).map((option) => {
                const selected = languagePreference === option;
                const label =
                  option === "system"
                    ? t("settings.followSystem")
                    : LANGUAGE_NATIVE_NAMES[option];
                return (
                  <Pressable
                    key={option}
                    testID={`language-option-${option}`}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={label}
                    onPress={() => {
                      void setLanguagePreference(option).finally(() =>
                        setLanguageModalVisible(false),
                      );
                    }}
                    style={({ pressed }) => [
                      {
                        minHeight: 52,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        paddingHorizontal: 14,
                        borderRadius: 12,
                        marginBottom: 6,
                        backgroundColor: selected
                          ? `${colors.accent}20`
                          : colors.background,
                        borderWidth: 1,
                        borderColor: selected ? colors.accent : colors.border,
                        opacity: pressed ? 0.72 : 1,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color: selected ? colors.accent : colors.foreground,
                        fontSize: 16,
                        fontWeight: selected ? "800" : "600",
                      }}
                    >
                      {label}
                    </Text>
                    <Text
                      style={{
                        color: selected ? colors.accent : colors.muted,
                        fontSize: 16,
                        fontWeight: "900",
                      }}
                    >
                      {selected ? "✓" : ""}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Edit Modal */}
      <Modal
        visible={editModal.visible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setEditTouched(false);
          setEditModal({ ...editModal, visible: false });
        }}
      >
        <View style={styles.editOverlay}>
          <View
            style={[
              styles.editCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <AdaptiveFormText
              baseFontSize={18}
              style={[
                styles.editTitle,
                {
                  color: colors.foreground,
                  textAlign: isRtl ? "right" : "left",
                },
              ]}
            >
              {t("settingsActions.systemDataTitle")} · {editModal.label}
            </AdaptiveFormText>
            <View
              style={[
                styles.editInputRow,
                {
                  borderColor: colors.border,
                  flexDirection: isRtl ? "row-reverse" : "row",
                },
              ]}
            >
              <TextInput
                style={[
                  styles.editInput,
                  {
                    color: colors.foreground,
                    textAlign: isRtl ? "right" : "left",
                  },
                ]}
                value={editModal.value}
                onChangeText={(v) => {
                  setEditTouched(true);
                  setEditModal({ ...editModal, value: v });
                }}
                keyboardType={
                  editModal.isNumber ? "numeric" : "numbers-and-punctuation"
                }
                maxLength={editModal.isNumber ? undefined : 10}
                autoFocus
                selectTextOnFocus
                placeholderTextColor={colors.muted}
              />
              <Text style={[styles.editUnit, { color: colors.muted }]}>
                {editModal.unit}
              </Text>
            </View>
            {editInlineError ? (
              <AdaptiveFormText
                baseFontSize={13}
                style={{
                  color: colors.error,
                  lineHeight: 18,
                  marginTop: 8,
                  textAlign: isRtl ? "right" : "left",
                }}
              >
                {editInlineError}
              </AdaptiveFormText>
            ) : null}
            <View style={styles.editBtnRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.editCancelBtn,
                  { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
                ]}
                onPress={() => {
                  setEditTouched(false);
                  setEditModal({ ...editModal, visible: false });
                }}
              >
                <Text style={[styles.editCancelText, { color: colors.muted }]}>
                  {t("common.cancel")}
                </Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.editSaveBtn,
                  {
                    backgroundColor: colors.accent,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
                onPress={saveEdit}
              >
                <Text style={styles.editSaveText}>{t("common.save")}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── 補給品管理 Modal ── */}
      <Modal
        visible={supplyModal.visible}
        transparent
        animationType="slide"
        onRequestClose={closeSupplyModal}
      >
        <SafeAreaView
          style={[styles.modalOverlay, { backgroundColor: "rgba(0,0,0,0.5)" }]}
        >
          <View
            style={[
              styles.modalContent,
              {
                backgroundColor: colors.surface,
                flex: 1,
                display: "flex",
                flexDirection: "column",
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <AdaptiveFormText
                baseFontSize={18}
                style={[
                  styles.modalTitle,
                  {
                    color: colors.foreground,
                    textAlign: isRtl ? "right" : "left",
                  },
                ]}
              >
                {supplyModal.mode === "add"
                  ? t("settingsActions.supplyAddTitle")
                  : t("settingsActions.supplyEditTitle")}
              </AdaptiveFormText>
              <Pressable onPress={closeSupplyModal}>
                <IconSymbol
                  name="xmark.circle.fill"
                  size={24}
                  color={colors.muted}
                />
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{
                paddingHorizontal: 24,
                paddingVertical: 20,
              }}
              style={{ flex: 1 }}
            >
              {/* 補給品名稱 */}
              <View style={{ marginBottom: 24 /* internal spacing */ }}>
                <AdaptiveFormText
                  baseFontSize={16}
                  style={{
                    fontWeight: "700",
                    color: colors.foreground,
                    marginBottom: 10,
                    textAlign: isRtl ? "right" : "left",
                  }}
                >
                  {t("settingsActions.supplyNameLabel")}
                </AdaptiveFormText>
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      borderColor: colors.border,
                      color: colors.foreground,
                      backgroundColor: colors.background,
                      fontSize: 17,
                      paddingVertical: 16,
                      paddingHorizontal: 16,
                      textAlign: isRtl ? "right" : "left",
                    },
                  ]}
                  placeholder={t("settingsActions.supplyNamePlaceholder")}
                  placeholderTextColor={colors.muted}
                  value={supplyForm.name}
                  multiline
                  numberOfLines={2}
                  onChangeText={(text) => {
                    setSupplyTouched((current) => ({ ...current, name: true }));
                    setSupplyForm({ ...supplyForm, name: text });
                  }}
                />
                {supplyNameError ? (
                  <AdaptiveFormText
                    baseFontSize={13}
                    style={{
                      color: colors.error,
                      lineHeight: 18,
                      marginTop: 8,
                      textAlign: isRtl ? "right" : "left",
                    }}
                  >
                    {supplyNameError}
                  </AdaptiveFormText>
                ) : null}
              </View>

              {/* 觸發方式 */}
              <View style={{ marginBottom: 24 /* internal spacing */ }}>
                <AdaptiveFormText
                  baseFontSize={16}
                  style={{
                    fontWeight: "700",
                    color: colors.foreground,
                    marginBottom: 12,
                    textAlign: isRtl ? "right" : "left",
                  }}
                >
                  {t("settingsActions.triggerType")}
                </AdaptiveFormText>
                <View style={{ flexDirection: "row", gap: 12 }}>
                  {(["time", "distance"] as const).map((type) => (
                    <Pressable
                      key={type}
                      style={({ pressed }) => [
                        styles.chipButton,
                        {
                          backgroundColor:
                            supplyForm.triggerType === type
                              ? colors.primary
                              : colors.background,
                          borderColor:
                            supplyForm.triggerType === type
                              ? colors.primary
                              : colors.border,
                          opacity: pressed ? 0.7 : 1,
                        },
                      ]}
                      onPress={() =>
                        setSupplyForm({ ...supplyForm, triggerType: type })
                      }
                    >
                      <AdaptiveFormText
                        baseFontSize={14}
                        minFontScale={0.72}
                        maxLinesBeforeShrink={1}
                        style={{
                          color:
                            supplyForm.triggerType === type
                              ? colors.onAccent
                              : colors.foreground,
                          fontWeight: "600",
                          textAlign: "center",
                        }}
                      >
                        {type === "time"
                          ? t("settingsActions.time")
                          : t("settingsActions.distance")}
                      </AdaptiveFormText>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* 觸發值 */}
              {supplyForm.triggerType === "time" ? (
                <View style={{ marginBottom: 24 /* internal spacing */ }}>
                  <AdaptiveFormText
                    baseFontSize={16}
                    style={{
                      fontWeight: "700",
                      color: colors.foreground,
                      marginBottom: 12,
                      textAlign: isRtl ? "right" : "left",
                    }}
                  >
                    {t("settingsActions.triggerTime")}
                  </AdaptiveFormText>
                  <View
                    style={{
                      flexDirection: isRtl ? "row-reverse" : "row",
                      gap: 14,
                    }}
                  >
                    {/* 時 */}
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 14,
                          color: colors.muted,
                          marginBottom: 8 /* internal spacing */,
                          fontWeight: "600",
                          textAlign: isRtl ? "right" : "left",
                        }}
                      >
                        {t("settingsActions.hours")}
                      </Text>
                      <TextInput
                        style={[
                          styles.textInput,
                          {
                            borderColor: colors.border,
                            color: colors.foreground,
                            backgroundColor: colors.background,
                            fontSize: 18,
                            paddingVertical: 16,
                            textAlign: "center",
                          },
                        ]}
                        placeholder="0"
                        placeholderTextColor={colors.muted}
                        keyboardType="number-pad"
                        value={String(supplyForm.triggerHours)}
                        onChangeText={(text) => {
                          setSupplyTouched((current) => ({
                            ...current,
                            time: true,
                          }));
                          setSupplyForm({
                            ...supplyForm,
                            triggerHours: parseInt(text) || 0,
                          });
                        }}
                      />
                    </View>
                    {/* 分 */}
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 14,
                          color: colors.muted,
                          marginBottom: 8 /* internal spacing */,
                          fontWeight: "600",
                          textAlign: isRtl ? "right" : "left",
                        }}
                      >
                        {t("settingsActions.minutes")}
                      </Text>
                      <TextInput
                        style={[
                          styles.textInput,
                          {
                            borderColor: colors.border,
                            color: colors.foreground,
                            backgroundColor: colors.background,
                            fontSize: 18,
                            paddingVertical: 16,
                            textAlign: "center",
                          },
                        ]}
                        placeholder="0"
                        placeholderTextColor={colors.muted}
                        keyboardType="number-pad"
                        value={String(supplyForm.triggerMinutes)}
                        onChangeText={(text) => {
                          setSupplyTouched((current) => ({
                            ...current,
                            time: true,
                          }));
                          setSupplyForm({
                            ...supplyForm,
                            triggerMinutes: parseInt(text) || 0,
                          });
                        }}
                      />
                    </View>
                    {/* 秒 */}
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 14,
                          color: colors.muted,
                          marginBottom: 8 /* internal spacing */,
                          fontWeight: "600",
                          textAlign: isRtl ? "right" : "left",
                        }}
                      >
                        {t("settingsActions.seconds")}
                      </Text>
                      <TextInput
                        style={[
                          styles.textInput,
                          {
                            borderColor: colors.border,
                            color: colors.foreground,
                            backgroundColor: colors.background,
                            fontSize: 18,
                            paddingVertical: 16,
                            textAlign: "center",
                          },
                        ]}
                        placeholder="0"
                        placeholderTextColor={colors.muted}
                        keyboardType="number-pad"
                        value={String(supplyForm.triggerSeconds)}
                        onChangeText={(text) => {
                          setSupplyTouched((current) => ({
                            ...current,
                            time: true,
                          }));
                          setSupplyForm({
                            ...supplyForm,
                            triggerSeconds: parseInt(text) || 0,
                          });
                        }}
                      />
                    </View>
                  </View>
                  {supplyTimeError ? (
                    <AdaptiveFormText
                      baseFontSize={13}
                      style={{
                        color: colors.error,
                        lineHeight: 18,
                        marginTop: 8,
                        textAlign: isRtl ? "right" : "left",
                      }}
                    >
                      {supplyTimeError}
                    </AdaptiveFormText>
                  ) : null}
                </View>
              ) : (
                <View style={{ marginBottom: 16 /* internal spacing */ }}>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      marginBottom: 6 /* internal spacing */,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: "600",
                        color: colors.foreground,
                      }}
                    >
                      {t("settingsActions.triggerValue")}
                    </Text>
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: "600",
                        color: colors.primary,
                      }}
                    >
                      {supplyForm.triggerValue}{" "}
                      {t("settingsActions.kilometers")}
                    </Text>
                  </View>
                  <Slider
                    style={{ width: "100%", height: 36 }}
                    minimumValue={1}
                    maximumValue={50}
                    step={1}
                    value={supplyForm.triggerValue}
                    onValueChange={(v) =>
                      setSupplyForm({
                        ...supplyForm,
                        triggerValue: Math.round(v),
                      })
                    }
                    minimumTrackTintColor={colors.primary}
                    maximumTrackTintColor={colors.border}
                  />
                </View>
              )}
            </ScrollView>

            {/* 固定底部按鈕區域 */}
            <View
              style={{
                flexDirection: isRtl ? "row-reverse" : "row",
                gap: 8,
                paddingHorizontal: 24,
                paddingVertical: 16,
                paddingBottom: 16 /* internal spacing */,
                borderTopWidth: 1,
                borderTopColor: colors.border,
                backgroundColor: colors.surface,
              }}
            >
              <Pressable
                style={({ pressed }) => [
                  styles.editCancelBtn,
                  {
                    borderColor: colors.border,
                    opacity: pressed ? 0.7 : 1,
                    flex: 1,
                  },
                ]}
                onPress={closeSupplyModal}
              >
                <Text style={[styles.editCancelText, { color: colors.muted }]}>
                  {t("common.cancel")}
                </Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.editConfirmBtn,
                  {
                    backgroundColor: colors.primary,
                    opacity: pressed ? 0.8 : 1,
                    flex: 1,
                  },
                ]}
                onPress={handleSaveSupply}
              >
                <Text
                  style={[styles.editConfirmText, { color: colors.onAccent }]}
                >
                  {t("common.save")}
                </Text>
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    </ScreenContainer>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({
  title,
  colors,
  onToggle,
  collapsed,
}: {
  title: string;
  colors: any;
  onToggle?: () => void;
  collapsed?: boolean;
}) {
  if (!onToggle) {
    return (
      <Text style={[styles.sectionHeader, { color: colors.muted }]}>
        {title}
      </Text>
    );
  }
  return (
    <Pressable
      onPress={onToggle}
      style={({ pressed }) => [
        {
          flexDirection: "row",
          alignItems: "center",
          paddingVertical: 2,
          opacity: pressed ? 0.7 : 1,
          flex: 1,
        },
      ]}
    >
      <Text
        style={[
          styles.sectionHeader,
          {
            color: colors.muted,
            flex: 1,
            marginBottom: 0 /* internal spacing */,
          },
        ]}
      >
        {title}
      </Text>
      <Text style={{ fontSize: 12, color: colors.muted, marginRight: 4 }}>
        {collapsed ? "▶" : "▼"}
      </Text>
    </Pressable>
  );
}

function SettingsCategory({
  icon,
  title,
  subtitle,
  colors,
  expanded,
  onPress,
  children,
}: {
  icon: string;
  title: string;
  subtitle: string;
  colors: any;
  expanded: boolean;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <View
      style={[
        styles.categoryCard,
        { borderColor: colors.border, backgroundColor: colors.surface },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={onPress}
        style={({ pressed }) => [
          styles.categoryTrigger,
          { opacity: pressed ? 0.72 : 1 },
        ]}
      >
        <View
          style={[
            styles.categoryIcon,
            { backgroundColor: `${colors.accent}18` },
          ]}
        >
          <IconSymbol name={icon as any} size={20} color={colors.accent} />
        </View>
        <View style={styles.categoryCopy}>
          <Text
            style={[styles.categoryTitle, { color: colors.foreground }]}
            allowFontScaling
          >
            {title}
          </Text>
          <Text
            style={[styles.categorySubtitle, { color: colors.muted }]}
            allowFontScaling
          >
            {subtitle}
          </Text>
        </View>
        <IconSymbol
          name="chevron.right"
          size={20}
          color={colors.muted}
          style={{ transform: [{ rotate: expanded ? "90deg" : "0deg" }] }}
        />
      </Pressable>
      {expanded ? <View style={styles.categoryContent}>{children}</View> : null}
    </View>
  );
}

function Divider({ colors }: { colors: any }) {
  return <View style={[styles.divider, { backgroundColor: colors.border }]} />;
}

function NumberRow({
  icon,
  label,
  value,
  unit,
  colors,
  iconColor,
  hint,
  onPress,
  disabled = false,
}: {
  icon: string;
  label: string;
  value: number;
  unit: string;
  colors: any;
  iconColor?: string;
  hint?: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        { opacity: disabled ? 0.45 : pressed ? 0.7 : 1 },
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <IconSymbol
        name={icon as any}
        size={18}
        color={iconColor ?? colors.muted}
      />
      <View style={styles.rowCopy}>
        <Text
          style={[styles.rowLabel, { color: colors.foreground }]}
          allowFontScaling
        >
          {label}
        </Text>
        {hint && (
          <Text
            style={[styles.rowHint, { color: colors.muted }]}
            allowFontScaling
          >
            {hint}
          </Text>
        )}
      </View>
      <View style={styles.rowRight}>
        <Text style={[styles.rowValue, { color: colors.accent }]}>
          {value} {unit}
        </Text>
        <IconSymbol name="chevron.right" size={16} color={colors.muted} />
      </View>
    </Pressable>
  );
}

function TextRow({
  icon,
  label,
  value,
  colors,
  hint,
  onPress,
}: {
  icon: string;
  label: string;
  value: string;
  colors: any;
  hint?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}
      onPress={onPress}
    >
      <IconSymbol name={icon as any} size={18} color={colors.muted} />
      <View style={styles.rowCopy}>
        <Text
          style={[styles.rowLabel, { color: colors.foreground }]}
          allowFontScaling
        >
          {label}
        </Text>
        {hint ? (
          <Text
            style={[styles.rowHint, { color: colors.muted }]}
            allowFontScaling
          >
            {hint}
          </Text>
        ) : null}
      </View>
      <View style={styles.rowRight}>
        <Text style={[styles.rowValue, { color: colors.accent }]}>{value}</Text>
        <IconSymbol name="chevron.right" size={16} color={colors.muted} />
      </View>
    </Pressable>
  );
}

function ToggleRow({
  icon,
  label,
  value,
  colors,
  onToggle,
  disabled = false,
}: {
  icon: string;
  label: string;
  value: boolean;
  colors: any;
  onToggle: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View style={[styles.row, disabled && { opacity: 0.45 }]}>
      <IconSymbol name={icon as any} size={18} color={colors.muted} />
      <Text
        style={[styles.rowLabel, styles.rowCopy, { color: colors.foreground }]}
        allowFontScaling
      >
        {label}
      </Text>
      <Switch
        value={value}
        onValueChange={onToggle}
        disabled={disabled}
        trackColor={{ false: "#767577", true: "#34C759" }}
        thumbColor="#fff"
        ios_backgroundColor="#767577"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 40 /* internal spacing */ },
  title: {
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: -0.5,
    marginBottom: 24 /* internal spacing */,
  },
  categoryCard: {
    borderWidth: 1,
    borderRadius: 18,
    marginBottom: 14,
    overflow: "hidden",
  },
  categoryTrigger: {
    minHeight: 76,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  categoryIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryCopy: { flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 3 },
  categoryTitle: {
    fontSize: 17,
    fontWeight: "900",
    lineHeight: 22,
    flexShrink: 1,
  },
  categorySubtitle: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "600",
    flexShrink: 1,
  },
  categoryContent: {
    paddingHorizontal: 12,
    paddingBottom: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(128,128,128,0.24)",
  },
  lapSettingsCard: {
    borderWidth: 1,
    borderRadius: 14,
    overflow: "hidden",
    marginTop: 14,
    marginBottom: 14,
  },
  lapSettingContent: { paddingHorizontal: 16, paddingVertical: 14 },
  lapModeOptions: { flexDirection: "row", gap: 8, marginTop: 10 },
  lapModeOption: {
    flex: 1,
    minHeight: 42,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  lapDistanceLabel: { fontSize: 12, fontWeight: "800", marginTop: 15 },
  defaultSportCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    marginBottom: 2,
  },
  defaultSportOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  defaultSportOption: {
    width: "47%",
    minHeight: 48,
    borderRadius: 11,
    borderWidth: 1,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  defaultSportIcon: { fontSize: 17 },
  appearanceCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    marginTop: 14,
    marginBottom: 2,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.7,
    marginBottom: 8 /* internal spacing */,
    marginTop: 20,
    paddingHorizontal: 4,
  },
  section: {
    borderWidth: 1,
    borderRadius: 16,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  rowCopy: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
  },
  rowLabel: { fontSize: 16, fontWeight: "600", lineHeight: 21 },
  rowHint: { fontSize: 13, lineHeight: 18, marginTop: 3 },
  rowRight: {
    flexShrink: 0,
    maxWidth: "42%",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  rowValue: {
    flexShrink: 1,
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 22,
    textAlign: "right",
  },
  intervalGroupHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 6,
  },
  intervalGroupTitleWrap: { flex: 1, gap: 2 },
  intervalGroupTitle: { fontSize: 15, fontWeight: "700" },
  intervalGroupHint: { fontSize: 12, lineHeight: 18 },
  ftpRecommendationRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 10,
  },
  autoMetricsNote: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingLeft: 46,
  },
  autoMetricValues: { paddingHorizontal: 16, paddingVertical: 13, gap: 4 },
  ftpApplyButton: { borderRadius: 8, paddingHorizontal: 9, paddingVertical: 7 },
  ftpApplyButtonText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 46 },
  aboutRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  aboutLabel: { flex: 1, minWidth: "58%", fontSize: 14, lineHeight: 20 },
  aboutValue: {
    flexShrink: 1,
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 20,
    textAlign: "right",
  },
  // Edit Modal
  editOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  editCard: {
    width: "100%",
    maxWidth: 320,
    borderRadius: 20,
    padding: 24,
    borderWidth: StyleSheet.hairlineWidth,
  },
  editTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 16 /* internal spacing */,
  },
  editInputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 20 /* internal spacing */,
  },
  editInput: { flex: 1, fontSize: 24, fontWeight: "300", paddingVertical: 12 },
  editUnit: { fontSize: 16 },
  editBtnRow: { flexDirection: "row", gap: 12 },
  editCancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
  },
  editCancelText: { fontSize: 15, fontWeight: "600" },
  editSaveBtn: {
    flex: 2,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: "center",
  },
  editSaveText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  // Mode chip
  modeChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  modeChipText: { fontSize: 13, fontWeight: "600" },
  // Profile card
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 12,
    margin: 4,
  },
  profileAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  profileAvatarText: { fontSize: 22, fontWeight: "700", color: "#fff" },
  profileName: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 2 /* internal spacing */,
  },
  profileEmail: { fontSize: 12, marginBottom: 6 /* internal spacing */ },
  profileBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  profileBadgeText: { fontSize: 11, fontWeight: "600" },
  dragHandle: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  resetBtn: {
    marginLeft: "auto",
    marginTop: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  panelDivider: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 6,
    gap: 8,
  },
  panelDividerLine: {
    flex: 1,
    borderTopWidth: 1,
    borderStyle: "dashed",
  },
  panelDividerLabel: {
    fontSize: 10,
    color: "#34C759",
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  // Delete Account Modal
  deleteIconWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteWarningText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8 /* internal spacing */,
  },
  deleteInfoBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 16 /* internal spacing */,
    gap: 4,
  },
  deleteInfoItem: {
    fontSize: 14,
    lineHeight: 20,
  },
  deleteConfirmBtn: {
    flex: 2,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: "center",
  },
  deleteConfirmText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  deleteErrorText: {
    fontSize: 13,
    marginBottom: 4 /* internal spacing */,
    textAlign: "center",
  },
  deleteStatusText: {
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  chipButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  modeButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  numericInput: {
    width: 76,
    minWidth: 76,
    flexGrow: 0,
    flexShrink: 0,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 7,
    fontSize: 14,
    textAlign: "center",
  },
  touchGuardPresetRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  touchGuardPreset: {
    minWidth: 64,
    minHeight: 36,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    borderWidth: 1,
  },
  supplyRepeatPresetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 4,
    paddingBottom: 12,
  },
  supplyRepeatPresetLabel: {
    fontSize: 12,
    fontWeight: "700",
    marginRight: 2,
  },
  supplyRepeatPreset: {
    minWidth: 64,
    minHeight: 36,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    borderWidth: 1,
  },
  guardModeRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 2,
  },
  guardModeChip: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: "center",
  },
  guardModeChipText: {
    fontSize: 13,
    fontWeight: "700",
  },
  editConfirmBtn: {
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: "center",
  },
  editConfirmText: {
    fontSize: 15,
    fontWeight: "700",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "transparent",
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    width: "100%",
    maxHeight: "85%",
    paddingTop: 16,
    paddingBottom: 0 /* internal spacing */,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
});
