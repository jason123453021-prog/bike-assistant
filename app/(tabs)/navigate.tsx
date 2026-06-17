import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import Svg, { Polyline, Line, Text as SvgText, Rect } from "react-native-svg";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useSettings } from "@/lib/settings-context";
import { parseGpx, estimateRouteCalories, type GpxRoute } from "@/lib/gpx-parser";
import { formatDuration, formatDistance } from "@/lib/power-calc";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CHART_WIDTH = SCREEN_WIDTH - 48;
const CHART_HEIGHT = 120;

export default function NavigateScreen() {
  const colors = useColors();
  const { settings } = useSettings();

  const [route, setRoute] = useState<GpxRoute | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 重量輸入（從設定預載，可在此頁面臨時覆蓋）
  const [riderWeightStr, setRiderWeightStr] = useState(String(settings.weight));
  const [bikeWeightStr, setBikeWeightStr] = useState(String(settings.bikeWeight ?? 10));
  const [avgSpeedStr, setAvgSpeedStr] = useState("20");

  // 解析後的數值
  const riderKg = parseFloat(riderWeightStr) || 70;
  const bikeKg = parseFloat(bikeWeightStr) || 10;
  const totalMassKg = riderKg + bikeKg;
  const avgSpeedKmh = parseFloat(avgSpeedStr) || 20;

  // 即時重算卡路里
  const calorieResult = useMemo(() => {
    if (!route) return null;
    return estimateRouteCalories(route, totalMassKg, avgSpeedKmh, 25);
  }, [route, totalMassKg, avgSpeedKmh]);

  const handleImportGpx = async () => {
    setError(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/gpx+xml", "text/xml", "application/xml", "*/*"],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      setLoading(true);
      const file = result.assets[0];
      const content = await FileSystem.readAsStringAsync(file.uri);
      const parsed = parseGpx(content);
      if (!parsed) {
        setError("無法解析 GPX 檔案，請確認格式正確");
      } else {
        setRoute(parsed);
      }
    } catch {
      setError("匯入失敗，請重試");
    } finally {
      setLoading(false);
    }
  };

  // ─── 高度剖面圖 ──────────────────────────────────────────────────────────────
  const renderElevationChart = () => {
    if (!route || route.elevationProfile.length < 2) return null;

    const elevations = route.elevationProfile.map((p) => p.elevation);
    const distances = route.elevationProfile.map((p) => p.distance);
    const minEle = Math.min(...elevations);
    const maxEle = Math.max(...elevations);
    const maxDist = Math.max(...distances);
    const eleRange = maxEle - minEle || 1;

    const PAD = { top: 10, bottom: 24, left: 36, right: 8 };
    const chartW = CHART_WIDTH - PAD.left - PAD.right;
    const chartH = CHART_HEIGHT - PAD.top - PAD.bottom;

    const points = route.elevationProfile
      .map((p) => {
        const x = PAD.left + (p.distance / maxDist) * chartW;
        const y = PAD.top + chartH - ((p.elevation - minEle) / eleRange) * chartH;
        return `${x},${y}`;
      })
      .join(" ");

    const yLabels = [minEle, (minEle + maxEle) / 2, maxEle].map((v) => Math.round(v));
    const xLabels = [0, 0.25, 0.5, 0.75, 1].map((pct) => ({
      x: PAD.left + pct * chartW,
      label: `${((maxDist / 1000) * pct).toFixed(1)}`,
    }));

    return (
      <View style={[styles.chartContainer, { borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>高度剖面</Text>
        <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
          {[0, 0.5, 1].map((pct, i) => {
            const y = PAD.top + chartH - pct * chartH;
            return (
              <Line key={i} x1={PAD.left} y1={y} x2={PAD.left + chartW} y2={y}
                stroke={colors.border} strokeWidth={0.5} />
            );
          })}
          <Polyline points={points} fill="none" stroke={colors.accent} strokeWidth={2} />
          {yLabels.map((label, i) => {
            const y = PAD.top + chartH - (i / 2) * chartH;
            return (
              <SvgText key={i} x={PAD.left - 4} y={y + 4} fontSize={9}
                fill={colors.muted} textAnchor="end">{label}</SvgText>
            );
          })}
          {xLabels.map((item, i) => (
            <SvgText key={i} x={item.x} y={CHART_HEIGHT - 4} fontSize={9}
              fill={colors.muted} textAnchor="middle">{item.label}</SvgText>
          ))}
        </Svg>
        <Text style={[styles.chartAxisLabel, { color: colors.muted }]}>距離 (km)</Text>
      </View>
    );
  };

  return (
    <ScreenContainer containerClassName="bg-background">
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">

          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.foreground }]}>路線導航</Text>
            <Text style={[styles.subtitle, { color: colors.muted }]}>匯入 GPX 檔案規劃路線</Text>
          </View>

          {/* ── 重量設定卡片 ─────────────────────────────────────────────────── */}
          <View style={[styles.weightCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.weightCardTitle, { color: colors.foreground }]}>騎乘參數</Text>
            <Text style={[styles.weightCardSub, { color: colors.muted }]}>
              用於科學公式預估卡路里消耗
            </Text>

            <View style={styles.weightRow}>
              <WeightInput
                label="騎手體重"
                unit="kg"
                value={riderWeightStr}
                onChangeText={setRiderWeightStr}
                colors={colors}
              />
              <WeightInput
                label="單車+裝備"
                unit="kg"
                value={bikeWeightStr}
                onChangeText={setBikeWeightStr}
                colors={colors}
              />
              <WeightInput
                label="預估均速"
                unit="km/h"
                value={avgSpeedStr}
                onChangeText={setAvgSpeedStr}
                colors={colors}
              />
            </View>

            {/* 總重顯示 */}
            <View style={[styles.totalMassRow, { borderTopColor: colors.border }]}>
              <Text style={[styles.totalMassLabel, { color: colors.muted }]}>
                預估總重（騎手 + 單車裝備）
              </Text>
              <Text style={[styles.totalMassValue, { color: colors.accent }]}>
                {totalMassKg.toFixed(1)} kg
              </Text>
            </View>
          </View>

          {/* Import Button */}
          <Pressable
            style={({ pressed }) => [
              styles.importBtn,
              { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
            ]}
            onPress={handleImportGpx}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.accent} />
            ) : (
              <>
                <View style={[styles.importIconWrap, { backgroundColor: colors.accent + "15" }]}>
                  <IconSymbol name="doc.fill" size={24} color={colors.accent} />
                </View>
                <View style={styles.importTextWrap}>
                  <Text style={[styles.importTitle, { color: colors.foreground }]}>
                    {route ? "重新匯入 GPX" : "匯入 GPX 檔案"}
                  </Text>
                  <Text style={[styles.importSubtitle, { color: colors.muted }]}>
                    支援標準 GPX 格式
                  </Text>
                </View>
                <IconSymbol name="chevron.right" size={18} color={colors.muted} />
              </>
            )}
          </Pressable>

          {/* Error */}
          {error && (
            <View style={[styles.errorBox, { backgroundColor: colors.error + "15", borderColor: colors.error + "40" }]}>
              <IconSymbol name="exclamationmark.triangle.fill" size={16} color={colors.error} />
              <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
            </View>
          )}

          {/* Route Info */}
          {route && calorieResult && (
            <>
              {/* Route Name */}
              <View style={[styles.routeNameCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <IconSymbol name="location.fill" size={18} color={colors.accent} />
                <Text style={[styles.routeName, { color: colors.foreground }]} numberOfLines={1}>
                  {route.name}
                </Text>
              </View>

              {/* Basic Stats Grid */}
              <View style={[styles.statsGrid, { borderColor: colors.border }]}>
                <RouteStatCell label="總距離" value={formatDistance(route.totalDistance)} colors={colors} />
                <RouteStatCell label="預估時間" value={formatDuration(route.estimatedDuration)} colors={colors} />
                <RouteStatCell label="總爬升" value={`${Math.round(route.totalAscent)} m`} colors={colors} />
                <RouteStatCell label="總下降" value={`${Math.round(route.totalDescent)} m`} colors={colors} />
                <RouteStatCell label="路線點數" value={`${route.points.length}`} colors={colors} />
                <RouteStatCell label="預估均速" value={`${avgSpeedKmh} km/h`} colors={colors} />
              </View>

              {/* ── 卡路里分析卡片 ──────────────────────────────────────────── */}
              <View style={[styles.calorieCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>卡路里預估分析</Text>
                <Text style={[styles.calorieFormula, { color: colors.muted }]}>
                  科學公式：重力位能 + 滾動阻力 + 空氣阻力，25% 肌肉代謝效率
                </Text>

                {/* 總卡路里大字 */}
                <View style={styles.calorieTotalRow}>
                  <Text style={[styles.calorieTotalValue, { color: colors.accent }]}>
                    {calorieResult.totalKcal.toLocaleString()}
                  </Text>
                  <Text style={[styles.calorieTotalUnit, { color: colors.muted }]}>kcal</Text>
                </View>

                {/* 分項明細 */}
                <View style={[styles.breakdownGrid, { borderTopColor: colors.border }]}>
                  <BreakdownItem
                    label="爬坡消耗"
                    sublabel="重力位能 ÷ 25%"
                    value={calorieResult.climbKcal}
                    pct={calorieResult.totalKcal > 0
                      ? Math.round((calorieResult.climbKcal / calorieResult.totalKcal) * 100)
                      : 0}
                    color="#F97316"
                    colors={colors}
                  />
                  <BreakdownItem
                    label="滾動阻力"
                    sublabel={`Crr=0.004 × ${totalMassKg.toFixed(0)}kg`}
                    value={calorieResult.breakdown.rollingKcal}
                    pct={calorieResult.totalKcal > 0
                      ? Math.round((calorieResult.breakdown.rollingKcal / calorieResult.totalKcal) * 100)
                      : 0}
                    color="#3B82F6"
                    colors={colors}
                  />
                  <BreakdownItem
                    label="空氣阻力"
                    sublabel={`CdA=0.35 @ ${avgSpeedKmh}km/h`}
                    value={calorieResult.breakdown.aeroKcal}
                    pct={calorieResult.totalKcal > 0
                      ? Math.round((calorieResult.breakdown.aeroKcal / calorieResult.totalKcal) * 100)
                      : 0}
                    color="#8B5CF6"
                    colors={colors}
                  />
                </View>

                {/* 爬坡 vs 平路 對比 */}
                <View style={[styles.compareRow, { borderTopColor: colors.border }]}>
                  <View style={styles.compareItem}>
                    <Text style={[styles.compareValue, { color: "#F97316" }]}>
                      {calorieResult.climbKcal} kcal
                    </Text>
                    <Text style={[styles.compareLabel, { color: colors.muted }]}>爬坡消耗</Text>
                  </View>
                  <View style={[styles.compareDivider, { backgroundColor: colors.border }]} />
                  <View style={styles.compareItem}>
                    <Text style={[styles.compareValue, { color: "#3B82F6" }]}>
                      {calorieResult.flatKcal} kcal
                    </Text>
                    <Text style={[styles.compareLabel, { color: colors.muted }]}>平路消耗</Text>
                  </View>
                </View>

                {/* 說明文字 */}
                <Text style={[styles.calorieNote, { color: colors.muted }]}>
                  * 以總重 {totalMassKg.toFixed(1)} kg 計算，下坡視為制動耗散不計入能量消耗
                </Text>
              </View>

              {/* Elevation Chart */}
              {renderElevationChart()}

              {/* Tips */}
              <View style={[styles.tipsBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.tipsTitle, { color: colors.foreground }]}>騎乘建議</Text>
                <Text style={[styles.tipsText, { color: colors.muted }]}>
                  {route.totalAscent > 500
                    ? `本路線爬升 ${Math.round(route.totalAscent)}m，預估消耗 ${calorieResult.totalKcal} kcal，建議攜帶充足補給（約 ${Math.ceil(calorieResult.totalKcal / 200)} 份能量棒）及充足水分。`
                    : route.totalAscent > 200
                    ? `本路線有適度爬升，預估消耗 ${calorieResult.totalKcal} kcal，建議攜帶 1-2 瓶水及能量補給。`
                    : `本路線地形平緩，預估消耗 ${calorieResult.totalKcal} kcal，攜帶基本補給即可。`}
                </Text>
              </View>
            </>
          )}

          {/* Empty State */}
          {!route && !loading && !error && (
            <View style={styles.emptyState}>
              <IconSymbol name="map.fill" size={56} color={colors.border} />
              <Text style={[styles.emptyTitle, { color: colors.muted }]}>尚未匯入路線</Text>
              <Text style={[styles.emptySubtitle, { color: colors.muted }]}>
                設定騎乘參數後匯入 GPX 檔案{"\n"}即可查看科學卡路里預估
              </Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

// ─── 子元件 ───────────────────────────────────────────────────────────────────

function WeightInput({
  label, unit, value, onChangeText, colors,
}: {
  label: string; unit: string; value: string;
  onChangeText: (v: string) => void; colors: any;
}) {
  return (
    <View style={styles.weightInputWrap}>
      <Text style={[styles.weightInputLabel, { color: colors.muted }]}>{label}</Text>
      <View style={[styles.weightInputBox, { borderColor: colors.border, backgroundColor: colors.background }]}>
        <TextInput
          style={[styles.weightInputText, { color: colors.foreground }]}
          value={value}
          onChangeText={onChangeText}
          keyboardType="decimal-pad"
          returnKeyType="done"
          selectTextOnFocus
          maxLength={6}
        />
        <Text style={[styles.weightInputUnit, { color: colors.muted }]}>{unit}</Text>
      </View>
    </View>
  );
}

function RouteStatCell({ label, value, colors, accent }: {
  label: string; value: string; colors: any; accent?: boolean;
}) {
  return (
    <View style={[styles.statCell, { borderColor: colors.border }]}>
      <Text style={[styles.statValue, { color: accent ? colors.accent : colors.foreground }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.muted }]}>{label}</Text>
    </View>
  );
}

function BreakdownItem({
  label, sublabel, value, pct, color, colors,
}: {
  label: string; sublabel: string; value: number; pct: number; color: string; colors: any;
}) {
  return (
    <View style={styles.breakdownItem}>
      <View style={styles.breakdownLeft}>
        <View style={[styles.breakdownDot, { backgroundColor: color }]} />
        <View>
          <Text style={[styles.breakdownLabel, { color: colors.foreground }]}>{label}</Text>
          <Text style={[styles.breakdownSublabel, { color: colors.muted }]}>{sublabel}</Text>
        </View>
      </View>
      <View style={styles.breakdownRight}>
        <Text style={[styles.breakdownValue, { color }]}>{value} kcal</Text>
        <Text style={[styles.breakdownPct, { color: colors.muted }]}>{pct}%</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 40 },
  header: { marginBottom: 20 },
  title: { fontSize: 28, fontWeight: "700", letterSpacing: -0.5 },
  subtitle: { fontSize: 14, marginTop: 4 },

  // Weight Card
  weightCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  weightCardTitle: { fontSize: 15, fontWeight: "600", marginBottom: 2 },
  weightCardSub: { fontSize: 12, marginBottom: 14 },
  weightRow: { flexDirection: "row", gap: 10 },
  weightInputWrap: { flex: 1 },
  weightInputLabel: { fontSize: 11, marginBottom: 6 },
  weightInputBox: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 4,
  },
  weightInputText: { flex: 1, fontSize: 16, fontWeight: "600", padding: 0 },
  weightInputUnit: { fontSize: 11 },
  totalMassRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  totalMassLabel: { fontSize: 12 },
  totalMassValue: { fontSize: 16, fontWeight: "700" },

  // Import
  importBtn: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 12,
    marginBottom: 16,
  },
  importIconWrap: { width: 44, height: 44, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  importTextWrap: { flex: 1 },
  importTitle: { fontSize: 15, fontWeight: "600" },
  importSubtitle: { fontSize: 12, marginTop: 2 },

  // Error
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 16,
  },
  errorText: { fontSize: 13, flex: 1 },

  // Route
  routeNameCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 16,
  },
  routeName: { fontSize: 15, fontWeight: "600", flex: 1 },

  // Stats Grid
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 16,
  },
  statCell: {
    width: "50%",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  statValue: { fontSize: 18, fontWeight: "600" },
  statLabel: { fontSize: 12, marginTop: 4 },

  // Calorie Card
  calorieCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  calorieFormula: { fontSize: 11, marginTop: 2, marginBottom: 14, lineHeight: 16 },
  calorieTotalRow: { flexDirection: "row", alignItems: "baseline", gap: 6, marginBottom: 16 },
  calorieTotalValue: { fontSize: 48, fontWeight: "700", letterSpacing: -1 },
  calorieTotalUnit: { fontSize: 16, fontWeight: "500" },

  // Breakdown
  breakdownGrid: { paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, gap: 12 },
  breakdownItem: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  breakdownLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  breakdownDot: { width: 10, height: 10, borderRadius: 5 },
  breakdownLabel: { fontSize: 14, fontWeight: "500" },
  breakdownSublabel: { fontSize: 11, marginTop: 1 },
  breakdownRight: { alignItems: "flex-end" },
  breakdownValue: { fontSize: 15, fontWeight: "600" },
  breakdownPct: { fontSize: 11, marginTop: 1 },

  // Compare
  compareRow: {
    flexDirection: "row",
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  compareItem: { flex: 1, alignItems: "center" },
  compareDivider: { width: StyleSheet.hairlineWidth, marginHorizontal: 8 },
  compareValue: { fontSize: 18, fontWeight: "700" },
  compareLabel: { fontSize: 12, marginTop: 4 },

  calorieNote: { fontSize: 11, marginTop: 12, lineHeight: 16 },

  // Chart
  chartContainer: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 14, fontWeight: "600", marginBottom: 8 },
  chartAxisLabel: { fontSize: 10, textAlign: "center", marginTop: 2 },

  // Tips
  tipsBox: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, padding: 16 },
  tipsTitle: { fontSize: 14, fontWeight: "600", marginBottom: 8 },
  tipsText: { fontSize: 13, lineHeight: 20 },

  // Empty
  emptyState: { alignItems: "center", paddingVertical: 60, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "600" },
  emptySubtitle: { fontSize: 14, textAlign: "center", lineHeight: 22 },
});
