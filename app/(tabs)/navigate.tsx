import React, { useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import Svg, { Polyline, Line, Text as SvgText, Rect } from "react-native-svg";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { parseGpx, type GpxRoute } from "@/lib/gpx-parser";
import { formatDuration, formatDistance } from "@/lib/power-calc";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CHART_WIDTH = SCREEN_WIDTH - 48;
const CHART_HEIGHT = 120;

export default function NavigateScreen() {
  const colors = useColors();
  const [route, setRoute] = useState<GpxRoute | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    } catch (e) {
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

    // Y-axis labels
    const yLabels = [minEle, (minEle + maxEle) / 2, maxEle].map((v) => Math.round(v));
    // X-axis labels (every 25%)
    const xLabels = [0, 0.25, 0.5, 0.75, 1].map((pct) => ({
      x: PAD.left + pct * chartW,
      label: `${(maxDist / 1000 * pct).toFixed(1)}`,
    }));

    return (
      <View style={[styles.chartContainer, { borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>高度剖面</Text>
        <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
          {/* Grid lines */}
          {[0, 0.5, 1].map((pct, i) => {
            const y = PAD.top + chartH - pct * chartH;
            return (
              <Line
                key={i}
                x1={PAD.left}
                y1={y}
                x2={PAD.left + chartW}
                y2={y}
                stroke={colors.border}
                strokeWidth={0.5}
              />
            );
          })}
          {/* Elevation line */}
          <Polyline
            points={points}
            fill="none"
            stroke={colors.accent}
            strokeWidth={2}
          />
          {/* Y labels */}
          {yLabels.map((label, i) => {
            const y = PAD.top + chartH - (i / 2) * chartH;
            return (
              <SvgText
                key={i}
                x={PAD.left - 4}
                y={y + 4}
                fontSize={9}
                fill={colors.muted}
                textAnchor="end"
              >
                {label}
              </SvgText>
            );
          })}
          {/* X labels */}
          {xLabels.map((item, i) => (
            <SvgText
              key={i}
              x={item.x}
              y={CHART_HEIGHT - 4}
              fontSize={9}
              fill={colors.muted}
              textAnchor="middle"
            >
              {item.label}
            </SvgText>
          ))}
        </Svg>
        <Text style={[styles.chartAxisLabel, { color: colors.muted }]}>距離 (km)</Text>
      </View>
    );
  };

  return (
    <ScreenContainer containerClassName="bg-background">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.foreground }]}>路線導航</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>匯入 GPX 檔案規劃路線</Text>
        </View>

        {/* Import Button */}
        <Pressable
          style={({ pressed }) => [
            styles.importBtn,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              opacity: pressed ? 0.7 : 1,
            },
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
        {route && (
          <>
            {/* Route Name */}
            <View style={[styles.routeNameCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <IconSymbol name="location.fill" size={18} color={colors.accent} />
              <Text style={[styles.routeName, { color: colors.foreground }]} numberOfLines={1}>
                {route.name}
              </Text>
            </View>

            {/* Stats Grid */}
            <View style={[styles.statsGrid, { borderColor: colors.border }]}>
              <RouteStatCell
                label="總距離"
                value={formatDistance(route.totalDistance)}
                colors={colors}
              />
              <RouteStatCell
                label="預估時間"
                value={formatDuration(route.estimatedDuration)}
                colors={colors}
              />
              <RouteStatCell
                label="總爬升"
                value={`${Math.round(route.totalAscent)} m`}
                colors={colors}
              />
              <RouteStatCell
                label="總下降"
                value={`${Math.round(route.totalDescent)} m`}
                colors={colors}
              />
              <RouteStatCell
                label="預估卡路里"
                value={`${route.estimatedCalories} kcal`}
                colors={colors}
                accent
              />
              <RouteStatCell
                label="路線點數"
                value={`${route.points.length}`}
                colors={colors}
              />
            </View>

            {/* Elevation Chart */}
            {renderElevationChart()}

            {/* Tips */}
            <View style={[styles.tipsBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.tipsTitle, { color: colors.foreground }]}>騎乘建議</Text>
              <Text style={[styles.tipsText, { color: colors.muted }]}>
                {route.totalAscent > 500
                  ? `本路線爬升 ${Math.round(route.totalAscent)}m，建議攜帶充足水分與補給，並確認煞車系統正常。`
                  : route.totalAscent > 200
                  ? `本路線有適度爬升，建議攜帶 1-2 瓶水及能量補給。`
                  : `本路線地形平緩，適合輕鬆騎乘。建議攜帶基本補給即可。`}
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
              點擊上方按鈕匯入 GPX 檔案{"\n"}以查看路線資訊與預估數據
            </Text>
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

function RouteStatCell({
  label, value, colors, accent,
}: {
  label: string; value: string; colors: any; accent?: boolean;
}) {
  return (
    <View style={[styles.statCell, { borderColor: colors.border }]}>
      <Text style={[styles.statValue, { color: accent ? colors.accent : colors.foreground }]}>
        {value}
      </Text>
      <Text style={[styles.statLabel, { color: colors.muted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 40 },
  header: { marginBottom: 20 },
  title: { fontSize: 28, fontWeight: "700", letterSpacing: -0.5 },
  subtitle: { fontSize: 14, marginTop: 4 },
  importBtn: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 12,
    marginBottom: 16,
  },
  importIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  importTextWrap: { flex: 1 },
  importTitle: { fontSize: 15, fontWeight: "600" },
  importSubtitle: { fontSize: 12, marginTop: 2 },
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
  chartContainer: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 14, fontWeight: "600", marginBottom: 8 },
  chartAxisLabel: { fontSize: 10, textAlign: "center", marginTop: 2 },
  tipsBox: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 16,
  },
  tipsTitle: { fontSize: 14, fontWeight: "600", marginBottom: 8 },
  tipsText: { fontSize: 13, lineHeight: 20 },
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
    gap: 12,
  },
  emptyTitle: { fontSize: 18, fontWeight: "600" },
  emptySubtitle: { fontSize: 14, textAlign: "center", lineHeight: 22 },
});
