import { useEffect, useMemo, useRef, useState } from "react";
import { router } from "expo-router";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import Svg, { Polyline, Line, Text as SvgText, Rect } from "react-native-svg";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useSettings } from "@/lib/settings-context";
import * as Location from "expo-location";
import { parseGpx, estimateRouteCalories, type GpxRoute } from "@/lib/gpx-parser";
import { useGpx } from "@/lib/gpx-context";
import { formatDuration, formatDistance, calcAirDensity } from "@/lib/power-calc";
import { fetchWeather, type WeatherData } from "@/lib/weather-service";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CHART_WIDTH = SCREEN_WIDTH - 48;
const CHART_HEIGHT = 120;

export default function NavigateScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { settings } = useSettings();
  const { setSharedRoute } = useGpx();

  const [route, setRoute] = useState<GpxRoute | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 即時天氣（進入頁面即自動取得）
  const [routeWeather, setRouteWeather] = useState<WeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  // 是否已將天氣連結到路線起點（GPX 匯入後更新）
  const [weatherLinkedToRoute, setWeatherLinkedToRoute] = useState(false);

  // 重量輸入（從設定預載，可在此頁面臨時覆蓋）
  const [riderWeightStr, setRiderWeightStr] = useState(String(settings.weight));
  const [bikeWeightStr, setBikeWeightStr] = useState(String(settings.bikeWeight ?? 10));
  const [avgSpeedStr, setAvgSpeedStr] = useState("20");

  // 解析後的數値
  const riderKg = parseFloat(riderWeightStr) || 70;
  const bikeKg = parseFloat(bikeWeightStr) || 10;
  const totalMassKg = riderKg + bikeKg;
  const avgSpeedKmh = parseFloat(avgSpeedStr) || 20;

  // 天氣連動溫度：如果已取得路線天氣則使用即時溫度，否則預設 25°C
  const routeTempC = routeWeather?.temperature ?? 25;
  // 空氣密度（依溫度計算）
  const routeAirDensity = calcAirDensity(routeTempC);

  // 即時重算卡路里（天氣連動空氣密度）
  const calorieResult = useMemo(() => {
    if (!route) return null;
    return estimateRouteCalories(route, totalMassKg, avgSpeedKmh, routeTempC);
  }, [route, totalMassKg, avgSpeedKmh, routeTempC]);

  const handleImportGpx = async () => {
    setError(null);
    setRouteWeather(null);
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
        setSharedRoute(parsed);  // 同步至導航頁共享 Context
        // 自動取得路線起點天氣（優先用 GPX 第一點座標）
        fetchRouteWeather(parsed.points[0].lat, parsed.points[0].lon);
      }
    } catch {
      setError("匯入失敗，請重試");
    } finally {
      setLoading(false);
    }
  };

  // 離線天氣備用：保留上次成功取得的天氣資料
  const lastWeatherRef = useRef<WeatherData | null>(null);
  // 是否為離線備用天氣
  const [weatherOffline, setWeatherOffline] = useState(false);

  // 取得路線起點天氣
  // 進入頁面自動取得即時位置天氣
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") return;
        setWeatherLoading(true);
        setWeatherOffline(false);
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const w = await fetchWeather(loc.coords.latitude, loc.coords.longitude);
        if (w) {
          setRouteWeather(w);
          lastWeatherRef.current = w;
        } else if (lastWeatherRef.current) {
          // 離線時保留上次資料
          setRouteWeather(lastWeatherRef.current);
          setWeatherOffline(true);
        }
      } catch {
        if (lastWeatherRef.current) {
          setRouteWeather(lastWeatherRef.current);
          setWeatherOffline(true);
        }
      } finally { setWeatherLoading(false); }
    })();
  }, []);

  const fetchRouteWeather = async (lat: number, lon: number) => {
    setWeatherLoading(true);
    setWeatherLinkedToRoute(true);
    setWeatherOffline(false);
    try {
      const w = await fetchWeather(lat, lon);
      if (w) {
        setRouteWeather(w);
        lastWeatherRef.current = w;
      } else if (lastWeatherRef.current) {
        setRouteWeather(lastWeatherRef.current);
        setWeatherOffline(true);
      }
    } catch {
      if (lastWeatherRef.current) {
        setRouteWeather(lastWeatherRef.current);
        setWeatherOffline(true);
      }
    } finally { setWeatherLoading(false); }
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
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 40) }]} showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">

          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.foreground }]}>路線分析</Text>
            <Text style={[styles.subtitle, { color: colors.muted }]}>匯入 GPX 檔案分析路線與預估消耗</Text>
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

          {/* 最愛路線按鈕 */}
          <Pressable
            style={({ pressed }) => [
              styles.importBtn,
              { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
            ]}
            onPress={() => router.push("/favorites-list")}
          >
            <>
              <View style={[styles.importIconWrap, { backgroundColor: colors.primary + "15" }]}>
                <IconSymbol name="heart.fill" size={24} color={colors.primary} />
              </View>
              <View style={styles.importTextWrap}>
                <Text style={[styles.importTitle, { color: colors.foreground }]}>
                  最愛路線
                </Text>
                <Text style={[styles.importSubtitle, { color: colors.muted }]}>
                  快速套用常用路線
                </Text>
              </View>
              <IconSymbol name="star.fill" size={18} color={colors.muted} />
            </>
          </Pressable>

          {/* GPX 匹入按鈕 */}
          {/* 匹入 GPX 按鈕已移除 */}

          {/* Error */}
          {error && (
            <View style={[styles.errorBox, { backgroundColor: colors.error + "15", borderColor: colors.error + "40" }]}>
              <IconSymbol name="exclamationmark.triangle.fill" size={16} color={colors.error} />
              <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
            </View>
          )}

          {/* ── 天氣資訊卡片（常驐顯示，不需要路線） ────────────────────────────────────────── */}
          <View style={[styles.weatherCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.weatherHeader}>
              <Text style={[styles.weatherTitle, { color: colors.foreground }]}>
                {weatherLinkedToRoute ? "路線起點天氣" : "當前位置天氣"}
              </Text>
              {weatherLoading && (
                <ActivityIndicator size="small" color={colors.accent} />
              )}
              {!weatherLoading && !routeWeather && (
                <Text style={[styles.weatherFetching, { color: colors.muted }]}>取得中...</Text>
              )}
              {weatherOffline && routeWeather && (
                <Text style={[styles.weatherFetching, { color: colors.warning }]}>離線備用</Text>
              )}
            </View>
            {routeWeather ? (
              <>
                <View style={styles.weatherGrid}>
                  <WeatherCell icon="thermometer" label="溫度"
                    value={`${routeWeather.temperature}°C`} colors={colors} />
                  <WeatherCell icon="drop.fill" label="濕度"
                    value={`${routeWeather.humidity}%`} colors={colors} />
                  <WeatherCell icon="wind" label="風速"
                    value={`${routeWeather.windSpeed} km/h`} colors={colors} />
                  <WeatherCell icon="arrow.up" label="風向"
                    value={`${routeWeather.windDirection}°`} colors={colors} />
                </View>
                <View style={[styles.airDensityRow, { borderTopColor: colors.border }]}>
                  <Text style={[styles.airDensityLabel, { color: colors.muted }]}>
                    天氣連動空氣密度（{routeWeather.temperature}°C）
                  </Text>
                  <Text style={[styles.airDensityValue, { color: colors.accent }]}>
                    {routeAirDensity.toFixed(4)} kg/m³
                  </Text>
                </View>
                <Text style={[styles.weatherDesc, { color: colors.muted }]}>
                  {routeWeather.description}，降雨機率 {routeWeather.precipitationProb}%
                </Text>
              </>
            ) : (
              !weatherLoading && (
                <Text style={[styles.weatherNoData, { color: colors.muted }]}>
                  無法取得天氣，使用預設 25°C 計算
                </Text>
              )
            )}
          </View>

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

              {/* ── 坡度分析卡片 ───────────────────────────────────────── */}
              <View style={[styles.gradientCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>坡度區間分布</Text>
                <Text style={[styles.gradDistTitle, { color: colors.muted }]}>各區間佔路線距離百分比</Text>

                {[
                  { bucket: 0, label: "平路", range: "< 1%",    color: "#94A3B8" },
                  { bucket: 1, label: "緩坡", range: "1% – 5%",   color: "#22C55E" },
                  { bucket: 2, label: "中坡", range: "6% – 10%",  color: "#84CC16" },
                  { bucket: 3, label: "陡坡", range: "11% – 15%", color: "#F59E0B" },
                  { bucket: 4, label: "急坡", range: "16% – 20%", color: "#F97316" },
                  { bucket: 5, label: "極陡", range: "21% – 25%", color: "#EF4444" },
                  { bucket: 6, label: "極限", range: "≥ 26%",    color: "#9333EA" },
                ].map(({ bucket, label, range, color }) => {
                  const pct = route.gradientDistribution[bucket] ?? 0;
                  return (
                    <View key={bucket} style={styles.gradRow}>
                      <View style={styles.gradLabelWrap}>
                        <Text style={[styles.gradLabelMain, { color: colors.foreground }]}>{label}</Text>
                        <Text style={[styles.gradLabelRange, { color: colors.muted }]}>{range}</Text>
                      </View>
                      <View style={[styles.gradBarBg, { backgroundColor: colors.border }]}>
                        <View style={[styles.gradBarFill, { width: `${pct}%`, backgroundColor: pct > 0 ? color : "transparent" }]} />
                      </View>
                      <Text style={[styles.gradPct, { color: pct > 0 ? colors.foreground : colors.muted }]}>
                        {pct > 0 ? `${pct}%` : "–"}
                      </Text>
                    </View>
                  );
                })}
              </View>

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

function WeatherCell({ icon, label, value, colors }: {
  icon: string; label: string; value: string; colors: any;
}) {
  return (
    <View style={styles.weatherCellWrap}>
      <IconSymbol name={icon as any} size={14} color={colors.accent} />
      <View>
        <Text style={[styles.weatherCellLabel, { color: colors.muted }]}>{label}</Text>
        <Text style={[styles.weatherCellValue, { color: colors.foreground }]}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 40 /* internal spacing */ },
  header: { marginBottom: 20 /* internal spacing */ },
  title: { fontSize: 28, fontWeight: "700", letterSpacing: -0.5 },
  subtitle: { fontSize: 14, marginTop: 4 },

  // Weight Card
  weightCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16 /* internal spacing */,
  },
  weightCardTitle: { fontSize: 15, fontWeight: "600", marginBottom: 2 /* internal spacing */ },
  weightCardSub: { fontSize: 12, marginBottom: 14 /* internal spacing */ },
  weightRow: { flexDirection: "row", gap: 10 },
  weightInputWrap: { flex: 1 },
  weightInputLabel: { fontSize: 11, marginBottom: 6 /* internal spacing */ },
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
    marginBottom: 16 /* internal spacing */,
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
    marginBottom: 16 /* internal spacing */,
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
    marginBottom: 16 /* internal spacing */,
  },
  routeName: { fontSize: 15, fontWeight: "600", flex: 1 },

  // Stats Grid
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 16 /* internal spacing */,
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
    marginBottom: 16 /* internal spacing */,
  },
  calorieFormula: { fontSize: 11, marginTop: 2, marginBottom: 14 /* internal spacing */, lineHeight: 16 },
  calorieTotalRow: { flexDirection: "row", alignItems: "baseline", gap: 6, marginBottom: 16 /* internal spacing */ },
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
    marginBottom: 16 /* internal spacing */,
  },
  sectionTitle: { fontSize: 14, fontWeight: "600", marginBottom: 8 /* internal spacing */ },
  chartAxisLabel: { fontSize: 10, textAlign: "center", marginTop: 2 },

  // Tips
  tipsBox: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, padding: 16 },
  tipsTitle: { fontSize: 14, fontWeight: "600", marginBottom: 8 /* internal spacing */ },
  tipsText: { fontSize: 13, lineHeight: 20 },

  // Empty
  emptyState: { alignItems: "center", paddingVertical: 60, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "600" },
  emptySubtitle: { fontSize: 14, textAlign: "center", lineHeight: 22 },

  // Weather Card
  weatherCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16 /* internal spacing */,
  },
  weatherHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 /* internal spacing */ },
  weatherTitle: { fontSize: 14, fontWeight: "600" },
  weatherFetching: { fontSize: 12 },
  weatherGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 /* internal spacing */ },
  weatherCellWrap: { width: "48%", flexDirection: "row", alignItems: "center", gap: 6 },
  weatherCellLabel: { fontSize: 11 },
  weatherCellValue: { fontSize: 14, fontWeight: "600" },
  airDensityRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 10,
    marginTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginBottom: 6 /* internal spacing */,
  },
  airDensityLabel: { fontSize: 12 },
  airDensityValue: { fontSize: 13, fontWeight: "700" },
  weatherDesc: { fontSize: 12, marginTop: 4 },
  weatherNoData: { fontSize: 12, marginTop: 4 },
  // ── 坡度分析卡片 ──────────────────────────────────────────────────────────────
  gradientCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12 /* internal spacing */,
  },
  gradSummaryRow: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: 12 /* internal spacing */,
    marginBottom: 12 /* internal spacing */,
  },
  gradSummaryItem: { flex: 1, alignItems: "center" },
  gradSummaryDivider: { width: StyleSheet.hairlineWidth, height: 36, marginHorizontal: 8 },
  gradSummaryValue: { fontSize: 26, fontWeight: "700", letterSpacing: -0.5 },
  gradSummaryLabel: { fontSize: 11, marginTop: 2, textAlign: "center" },
  gradDistTitle: { fontSize: 11, marginBottom: 8 /* internal spacing */ },
  gradRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6 /* internal spacing */,
  },
  gradLabel: { fontSize: 12, width: 80 },
  gradLabelWrap: { width: 80, gap: 1 },
  gradLabelMain: { fontSize: 13, fontWeight: "600" },
  gradLabelRange: { fontSize: 10 },
  gradBarBg: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
    marginHorizontal: 8,
  },
  gradBarFill: { height: 8, borderRadius: 4 },
  gradPct: { fontSize: 12, width: 32, textAlign: "right", fontWeight: "500" },
});
