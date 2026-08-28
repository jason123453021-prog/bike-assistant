import React, { useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  Image,
  Alert,
  Pressable,
  StyleSheet,
  ScrollView,
  Share,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import Svg, { G, Path, Circle } from "react-native-svg";
import * as ImagePicker from "expo-image-picker";
import { SafeAreaView } from "react-native-safe-area-context";
import { useColors } from "@/hooks/use-colors";
import { useRide } from "@/lib/ride-context";
import { persistRideMedia } from "@/lib/local-ride-media";
import {
  formatDuration,
  POWER_ZONE_NAMES,
  POWER_ZONE_COLORS,
} from "@/lib/power-calc";
import { buildActivityStatistics } from "@/lib/activity-statistics";
import { IconSymbol } from "@/components/ui/icon-symbol";
import type { RideSummarySnapshot } from "@/lib/ride-summary-snapshot";
import { getLapPresentationMetrics } from "@/lib/lap-presentation";
import { useTranslation } from "react-i18next";

interface RideSummaryModalProps {
  visible: boolean;
  recordId?: string | null;
  /** 結束騎乘時凍結的統計，避免完成流程重設即時 state 後顯示全零。 */
  snapshot?: RideSummarySnapshot | null;
  /** 關閉時傳入使用者輸入的路線名稱（空字串代表使用預設名稱） */
  onClose: (routeName?: string, mediaItems?: string[]) => void | Promise<void>;
}

// ─── 圓餅圖（純 SVG）────────────────────────────────────────────────────────────
function PieChart({
  data,
  colors: zoneColors,
}: {
  data: number[];
  colors: string[];
}) {
  const total = data.reduce((a, b) => a + b, 0);
  if (total === 0) return null;
  const size = 140;
  const cx = size / 2;
  const cy = size / 2;
  const r = 55;
  let startAngle = -Math.PI / 2;
  const slices: { path: string; color: string }[] = [];
  data.forEach((val, i) => {
    if (val === 0) return;
    const pct = val / total;
    const angle = pct * 2 * Math.PI;
    const endAngle = startAngle + angle;
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const largeArc = angle > Math.PI ? 1 : 0;
    slices.push({
      path: `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`,
      color: zoneColors[i],
    });
    startAngle = endAngle;
  });
  return (
    <Svg width={size} height={size}>
      <G>
        {slices.map((s, i) => (
          <Path key={i} d={s.path} fill={s.color} />
        ))}
        <Circle cx={cx} cy={cy} r={28} fill="transparent" />
      </G>
    </Svg>
  );
}

// ─── 生成預設路線名稱 ────────────────────────────────────────────────────────────
function generateDefaultName(
  t: (key: string, options?: Record<string, number | string>) => string,
): string {
  const d = new Date();
  const month = d.getMonth() + 1;
  const day = d.getDate();
  return t("summaryDetail.defaultRide", { month, day });
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function RideSummaryModal({
  visible,
  recordId,
  snapshot,
  onClose,
}: RideSummaryModalProps) {
  const colors = useColors();
  const { t } = useTranslation();
  const { state } = useRide();

  const [routeName, setRouteName] = useState("");
  const [mediaItems, setMediaItems] = useState<string[]>([]);
  const [isPickingMedia, setIsPickingMedia] = useState(false);

  // 每次 Modal 開啟時重設為預設名稱
  useEffect(() => {
    if (visible) {
      setRouteName(generateDefaultName(t));
      setMediaItems([]);
    }
  }, [t, visible]);

  const summary = snapshot ?? state;
  const laps = summary.laps ?? [];
  const lapSportType = summary.sportType ?? state.sportType;
  const totalPowerSamples = summary.powerZones.reduce((a, b) => a + b, 0);
  const zonePcts = summary.powerZones.map((v) =>
    totalPowerSamples > 0 ? Math.round((v / totalPowerSamples) * 100) : 0,
  );

  const activityStats = buildActivityStatistics({
    distanceM: summary.distance,
    movingTimeSec: summary.elapsed,
    pausedTimeSec: summary.totalPausedSec,
    totalAscentM: summary.totalAscent,
    totalDescentM: summary.totalDescent,
    minElevationM: summary.minElevation ?? undefined,
    maxElevationM: summary.maxElevation ?? undefined,
    maxSpeedKmh: summary.maxSpeed,
    maxPowerW: summary.maxPower,
    powerWorkJ: summary.powerWorkJ,
    powerSampleDurationSec: summary.powerSampleDurationSec,
    caloriesKcal: summary.totalCalories,
    powerSource: summary.powerSource,
    caloriesSource: summary.caloriesSource,
  });
  const distKm = (activityStats.distanceM / 1000).toFixed(2);
  const avgSpd = activityStats.averageSpeedKmh.toFixed(1);
  const powerSourceLabel =
    activityStats.powerSource === "estimated"
      ? t("summaryDetail.estimated")
      : t("summaryDetail.noData");

  const handleShare = async () => {
    const msg = [
      t("summaryDetail.shareTitle", {
        name: routeName || t("summary.rideSummary"),
      }),
      t("summaryDetail.shareDistance", { distance: distKm }),
      t("summaryDetail.shareElapsed", {
        time: formatDuration(activityStats.elapsedTimeSec),
      }),
      t("summaryDetail.shareMoving", {
        time: formatDuration(activityStats.movingTimeSec),
      }),
      t("summaryDetail.shareAverageSpeed", { speed: avgSpd }),
      t("summaryDetail.shareMaxSpeed", {
        speed: summary.maxSpeed.toFixed(1),
      }),
      t("summaryDetail.shareElevation", {
        ascent: Math.round(activityStats.totalAscentM),
        descent: Math.round(activityStats.totalDescentM),
      }),
      t("summaryDetail.shareCalories", {
        calories: Math.round(activityStats.caloriesKcal),
      }),
      t("summaryDetail.sharePaused", {
        time: formatDuration(activityStats.pausedTimeSec),
      }),
      t("summaryDetail.shareAveragePower", {
        power:
          activityStats.averagePowerW === undefined
            ? "--"
            : `${Math.round(activityStats.averagePowerW)} W`,
        source: powerSourceLabel,
      }),
      t("summaryDetail.shareMaxPower", {
        power:
          activityStats.maxPowerW === undefined
            ? "--"
            : `${Math.round(activityStats.maxPowerW)} W`,
      }),
    ].join("\n");
    try {
      await Share.share({ message: msg });
    } catch {}
  };

  const handlePickMedia = async () => {
    if (!recordId) {
      Alert.alert(
        t("summaryDetail.mediaWaitTitle"),
        t("summaryDetail.mediaWaitBody"),
      );
      return;
    }
    try {
      setIsPickingMedia(true);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsMultipleSelection: true,
        selectionLimit: 10,
        quality: 0.9,
      });
      if (!result.canceled) {
        const saved = await persistRideMedia(recordId, result.assets);
        setMediaItems((previous) => [...previous, ...saved].slice(0, 10));
      }
    } catch {
      Alert.alert(
        t("summaryDetail.mediaErrorTitle"),
        t("summaryDetail.mediaErrorBody"),
      );
    } finally {
      setIsPickingMedia(false);
    }
  };

  const handleSave = async () => {
    await onClose(routeName.trim() || generateDefaultName(t), mediaItems);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => onClose()}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <SafeAreaView
          edges={["top", "left", "right"]}
          style={[styles.container, { backgroundColor: colors.background }]}
        >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Text style={[styles.headerTitle, { color: colors.foreground }]}>
              {t("summary.rideSummary")}
            </Text>
            <Pressable
              style={({ pressed }) => [
                styles.headerCloseButton,
                { opacity: pressed ? 0.6 : 1 },
              ]}
              onPress={() => onClose()}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={t("summaryDetail.close")}
            >
              <IconSymbol
                name="xmark.circle.fill"
                size={28}
                color={colors.muted}
              />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* ── 路線命名區塊 ── */}
            <View
              style={[
                styles.nameSection,
                { borderColor: colors.border, backgroundColor: colors.surface },
              ]}
            >
              <View style={styles.nameLabelRow}>
                <IconSymbol name="pencil" size={15} color={colors.accent} />
                <Text style={[styles.nameLabel, { color: colors.foreground }]}>
                  {t("summaryDetail.routeName")}
                </Text>
              </View>
              <TextInput
                style={[
                  styles.nameInput,
                  { color: colors.foreground, borderColor: colors.border },
                ]}
                value={routeName}
                onChangeText={setRouteName}
                placeholder={t("summaryDetail.routeNamePlaceholder")}
                placeholderTextColor={colors.muted}
                returnKeyType="done"
                maxLength={40}
                selectTextOnFocus
              />
              <Text style={[styles.nameHint, { color: colors.muted }]}>
                {t("summaryDetail.routeNameHint")}
              </Text>
            </View>

            <View
              style={[
                styles.mediaSection,
                { borderColor: colors.border, backgroundColor: colors.surface },
              ]}
            >
              <View style={styles.mediaHeader}>
                <View>
                  <Text
                    style={[
                      styles.panelTitle,
                      { color: colors.foreground, marginBottom: 2 },
                    ]}
                  >
                    {t("summaryDetail.media")}
                  </Text>
                  <Text style={[styles.nameHint, { color: colors.muted }]}>
                    {t("summaryDetail.mediaLocal")}
                  </Text>
                </View>
                <Pressable
                  style={({ pressed }) => [
                    styles.addMediaButton,
                    {
                      backgroundColor: colors.accent,
                      opacity: pressed || isPickingMedia ? 0.72 : 1,
                    },
                  ]}
                  onPress={handlePickMedia}
                  disabled={isPickingMedia}
                >
                  <IconSymbol name="plus" size={17} color={colors.onAccent} />
                  <Text style={styles.addMediaButtonText}>
                    {isPickingMedia
                      ? t("summaryDetail.processing")
                      : t("summaryDetail.add")}
                  </Text>
                </Pressable>
              </View>
              {mediaItems.length > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.mediaPreviewRow}
                >
                  {mediaItems.map((uri, index) => (
                    <View
                      key={`${uri}-${index}`}
                      style={styles.mediaPreviewItem}
                    >
                      {/(\.mp4|\.mov|\.m4v|\.webm)(\?|$)/i.test(uri) ? (
                        <View
                          style={[
                            styles.videoPreview,
                            { backgroundColor: colors.background },
                          ]}
                        >
                          <Text style={styles.videoPlayGlyph}>▶</Text>
                          <Text
                            style={[
                              styles.videoPreviewLabel,
                              { color: colors.muted },
                            ]}
                          >
                            {t("summaryDetail.video")}
                          </Text>
                        </View>
                      ) : (
                        <Image
                          source={{ uri }}
                          style={styles.mediaPreviewImage}
                        />
                      )}
                      <Pressable
                        style={styles.removeMediaButton}
                        onPress={() =>
                          setMediaItems((previous) =>
                            previous.filter(
                              (_, itemIndex) => itemIndex !== index,
                            ),
                          )
                        }
                      >
                        <Text style={styles.removeMediaButtonText}>×</Text>
                      </Pressable>
                    </View>
                  ))}
                </ScrollView>
              ) : (
                <Pressable
                  style={[
                    styles.mediaEmptyState,
                    { borderColor: colors.border },
                  ]}
                  onPress={handlePickMedia}
                >
                  <Text
                    style={[styles.mediaEmptyIcon, { color: colors.accent }]}
                  >
                    ＋
                  </Text>
                  <Text
                    style={[styles.mediaEmptyText, { color: colors.muted }]}
                  >
                    {t("summaryDetail.addMediaEmpty")}
                  </Text>
                </Pressable>
              )}
            </View>

            {/* 核心數據面板 */}
            <View style={[styles.statsPanel, { borderColor: colors.border }]}>
              <Text style={[styles.panelTitle, { color: colors.foreground }]}>
                {t("summaryDetail.coreMetrics")}
              </Text>
              <View style={styles.statsGrid}>
                <StatCell
                  label={t("dashboard.distance")}
                  value={distKm}
                  unit="km"
                  colors={colors}
                />
                <StatCell
                  label={t("summary.elapsedTime")}
                  value={formatDuration(activityStats.elapsedTimeSec)}
                  unit=""
                  colors={colors}
                />
                <StatCell
                  label={t("summary.movingTime")}
                  value={formatDuration(activityStats.movingTimeSec)}
                  unit=""
                  colors={colors}
                />
                <StatCell
                  label={t("summary.avgSpeed")}
                  value={activityStats.averageSpeedKmh.toFixed(1)}
                  unit="km/h"
                  colors={colors}
                />
                <StatCell
                  label={t("summary.maxSpeed")}
                  value={activityStats.maxSpeedKmh.toFixed(1)}
                  unit="km/h"
                  colors={colors}
                />
                <StatCell
                  label={t("summaryDetail.calories")}
                  value={`${Math.round(activityStats.caloriesKcal)}`}
                  unit={`kcal (${t("summaryDetail.estimated")})`}
                  colors={colors}
                />
              </View>
            </View>

            {/* 爬升與地形數據面板 */}
            <View style={[styles.statsPanel, { borderColor: colors.border }]}>
              <Text style={[styles.panelTitle, { color: colors.foreground }]}>
                {t("summaryDetail.terrain")}
              </Text>
              <View style={styles.statsGrid}>
                <StatCell
                  label={t("summary.elevationGain")}
                  value={`${Math.round(activityStats.totalAscentM)}`}
                  unit="m"
                  colors={colors}
                />
                <StatCell
                  label={t("summaryDetail.totalDescent")}
                  value={`${Math.round(activityStats.totalDescentM)}`}
                  unit="m"
                  colors={colors}
                />
                <StatCell
                  label={t("summaryDetail.maxElevation")}
                  value={
                    activityStats.maxElevationM === undefined
                      ? "--"
                      : `${Math.round(activityStats.maxElevationM)}`
                  }
                  unit="m"
                  colors={colors}
                />
                <StatCell
                  label={t("summaryDetail.minElevation")}
                  value={
                    activityStats.minElevationM === undefined
                      ? "--"
                      : `${Math.round(activityStats.minElevationM)}`
                  }
                  unit="m"
                  colors={colors}
                />
              </View>
            </View>

            {/* 進階訓練數據面板 */}
            <View style={[styles.statsPanel, { borderColor: colors.border }]}>
              <Text style={[styles.panelTitle, { color: colors.foreground }]}>
                {t("summaryDetail.advanced")}
              </Text>
              <View style={styles.statsGrid}>
                <StatCell
                  label={t("summaryDetail.averagePower")}
                  value={
                    activityStats.averagePowerW === undefined
                      ? "--"
                      : `${Math.round(activityStats.averagePowerW)}`
                  }
                  unit="W"
                  colors={colors}
                  accent
                />
                <StatCell
                  label={t("summaryDetail.maxPower")}
                  value={
                    activityStats.maxPowerW === undefined
                      ? "--"
                      : `${Math.round(activityStats.maxPowerW)}`
                  }
                  unit={
                    activityStats.maxPowerW === undefined
                      ? t("summaryDetail.noData")
                      : "W"
                  }
                  colors={colors}
                  accent
                />
                <StatCell
                  label={t("summaryDetail.mechanicalWork")}
                  value={
                    activityStats.totalWorkKj === undefined
                      ? "--"
                      : `${Math.round(activityStats.totalWorkKj)}`
                  }
                  unit="kJ"
                  colors={colors}
                />
                <StatCell
                  label={t("summaryDetail.pausedTime")}
                  value={formatDuration(activityStats.pausedTimeSec)}
                  unit=""
                  colors={colors}
                />
              </View>
              <Text style={[styles.nameHint, { color: colors.muted }]}>
                {t("summaryDetail.powerNote", { source: powerSourceLabel })}
              </Text>
            </View>

            {laps.length > 0 && (
              <View
                style={[
                  styles.lapsPanel,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.surface,
                  },
                ]}
              >
                <View style={styles.lapsHeader}>
                  <View style={styles.lapsHeadingCopy}>
                    <Text
                      style={[styles.panelTitle, { color: colors.foreground }]}
                    >
                      {t("summaryDetail.laps")}
                    </Text>
                    <Text style={[styles.nameHint, { color: colors.muted }]}>
                      {t("summaryDetail.lapsHint")}
                    </Text>
                  </View>
                  <Text style={[styles.lapsCount, { color: colors.accent }]}>
                    {t("summaryDetail.lapCount", { count: laps.length })}
                  </Text>
                </View>
                {laps.map((lap) => (
                  <View
                    key={`${lap.index}-${lap.endedAtElapsedSec}`}
                    style={[styles.lapRow, { borderTopColor: colors.border }]}
                  >
                    <View style={styles.lapRowHeader}>
                      <Text
                        style={[
                          styles.lapRowTitle,
                          { color: colors.foreground },
                        ]}
                      >
                        {t("summaryDetail.lap", { index: lap.index })}
                      </Text>
                      <Text
                        style={[
                          styles.lapRowTime,
                          { color: colors.foreground },
                        ]}
                      >
                        {formatDuration(lap.movingTimeSec)}
                      </Text>
                    </View>
                    <View style={styles.lapMetricsGrid}>
                      {getLapPresentationMetrics(lapSportType, lap).map(
                        (metric) => (
                          <LapMetric
                            key={metric.id}
                            label={metric.label}
                            value={metric.value}
                            colors={colors}
                          />
                        ),
                      )}
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Power Zone Chart */}
            {totalPowerSamples > 0 && (
              <View
                style={[styles.chartSection, { borderColor: colors.border }]}
              >
                <Text
                  style={[styles.sectionTitle, { color: colors.foreground }]}
                >
                  {t("summaryDetail.powerDistribution")}
                </Text>
                <View style={styles.chartRow}>
                  <PieChart
                    data={summary.powerZones}
                    colors={POWER_ZONE_COLORS}
                  />
                  <View style={styles.legend}>
                    {POWER_ZONE_NAMES.map((name, i) => (
                      <View key={i} style={styles.legendItem}>
                        <View
                          style={[
                            styles.legendDot,
                            { backgroundColor: POWER_ZONE_COLORS[i] },
                          ]}
                        />
                        <Text
                          style={[styles.legendText, { color: colors.muted }]}
                        >
                          {name}
                        </Text>
                        <Text
                          style={[
                            styles.legendPct,
                            { color: colors.foreground },
                          ]}
                        >
                          {zonePcts[i]}%
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            )}

            {/* Share Button */}
            <Pressable
              style={({ pressed }) => [
                styles.shareBtn,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
              onPress={handleShare}
            >
              <IconSymbol
                name="square.and.arrow.up"
                size={18}
                color={colors.foreground}
              />
              <Text style={[styles.shareBtnText, { color: colors.foreground }]}>
                {t("summary.share")}
              </Text>
            </Pressable>

            {/* Save & Close Button */}
            <Pressable
              style={({ pressed }) => [
                styles.saveBtn,
                { backgroundColor: colors.accent, opacity: pressed ? 0.85 : 1 },
              ]}
              onPress={handleSave}
            >
              <IconSymbol
                name="checkmark.circle.fill"
                size={20}
                color={colors.onAccent}
              />
              <Text style={[styles.saveBtnText, { color: colors.onAccent }]}>
                {t("summary.saveAndFinish")}
              </Text>
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function StatCell({
  label,
  value,
  unit,
  colors,
  large,
  accent,
}: {
  label: string;
  value: string;
  unit: string;
  colors: any;
  large?: boolean;
  accent?: boolean;
}) {
  return (
    <View
      style={[
        styles.statCell,
        {
          backgroundColor: accent
            ? `${colors.accent}15`
            : `${colors.foreground}08`,
        },
      ]}
    >
      <Text
        style={[
          styles.statValue,
          { color: accent ? colors.accent : colors.foreground },
        ]}
      >
        {value}
      </Text>
      <Text style={[styles.statUnit, { color: colors.muted }]}>{unit}</Text>
      <Text style={[styles.statLabel, { color: colors.muted }]}>{label}</Text>
    </View>
  );
}

function LapMetric({
  label,
  value,
  colors,
}: {
  label: string;
  value: string;
  colors: any;
}) {
  return (
    <View style={styles.lapMetric}>
      <Text style={[styles.lapMetricLabel, { color: colors.muted }]}>
        {label}
      </Text>
      <Text
        style={[styles.lapMetricValue, { color: colors.foreground }]}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 20, fontWeight: "800" },
  headerCloseButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    marginRight: -8,
  },
  content: { padding: 20, paddingBottom: 40 },
  lapsPanel: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 14,
    marginBottom: 16,
    overflow: "hidden",
  },
  lapsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 14,
    alignItems: "flex-start",
  },
  lapsHeadingCopy: { flex: 1 },
  lapsCount: { fontSize: 13, fontWeight: "900", paddingTop: 3 },
  lapRow: { borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 12 },
  lapRowHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  lapRowTitle: { fontSize: 16, fontWeight: "900" },
  lapRowTime: { fontSize: 16, fontWeight: "900" },
  lapMetricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 9,
    rowGap: 8,
  },
  lapMetric: { width: "50%", paddingRight: 8 },
  lapMetricLabel: { fontSize: 11, fontWeight: "700" },
  lapMetricValue: { fontSize: 13, fontWeight: "800", marginTop: 2 },

  // 路線命名
  nameSection: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    gap: 8,
  },
  nameLabelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  nameLabel: { fontSize: 15, fontWeight: "700" },
  nameInput: {
    fontSize: 17,
    fontWeight: "600",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    letterSpacing: -0.3,
  },
  nameHint: { fontSize: 13, lineHeight: 18, marginTop: 3 },

  mediaSection: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  mediaHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  addMediaButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  addMediaButtonText: { color: "#fff", fontSize: 13, fontWeight: "800" },
  mediaPreviewRow: { gap: 10, paddingRight: 4 },
  mediaPreviewItem: {
    width: 114,
    height: 88,
    borderRadius: 11,
    overflow: "visible",
  },
  mediaPreviewImage: {
    width: "100%",
    height: "100%",
    borderRadius: 11,
    backgroundColor: "#111",
  },
  videoPreview: {
    width: "100%",
    height: "100%",
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  videoPlayGlyph: { color: "#fff", fontSize: 24, marginBottom: 3 },
  videoPreviewLabel: { fontSize: 12, fontWeight: "800" },
  removeMediaButton: {
    position: "absolute",
    top: -7,
    right: -7,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F04438",
  },
  removeMediaButtonText: {
    color: "#fff",
    fontSize: 17,
    lineHeight: 19,
    fontWeight: "700",
  },
  mediaEmptyState: {
    height: 76,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: "dashed",
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  mediaEmptyIcon: { fontSize: 22, lineHeight: 24, fontWeight: "300" },
  mediaEmptyText: { fontSize: 13, fontWeight: "600" },

  // Stats
  statsPanel: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  panelTitle: { fontSize: 17, fontWeight: "800", marginBottom: 12 },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  statCell: {
    width: "48%",
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: "center",
    borderRadius: 10,
  },
  statValue: { fontWeight: "800", letterSpacing: -0.5, fontSize: 20 },
  statUnit: { fontSize: 12, fontWeight: "700", marginTop: 2 },
  statLabel: { fontSize: 13, fontWeight: "600", marginTop: 4 },

  // Chart
  chartSection: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 17, fontWeight: "800", marginBottom: 16 },
  chartRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  legend: { flex: 1, gap: 8 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 8 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { flex: 1, fontSize: 13, fontWeight: "600" },
  legendPct: { fontSize: 13, fontWeight: "800" },

  // Buttons
  shareBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 10,
  },
  shareBtnText: { fontSize: 15, fontWeight: "600" },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
  },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
