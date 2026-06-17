import React from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Share,
  Platform,
} from "react-native";
import Svg, { G, Path, Circle, Text as SvgText } from "react-native-svg";
import { useColors } from "@/hooks/use-colors";
import { useRide } from "@/lib/ride-context";
import { formatDuration, POWER_ZONE_NAMES, POWER_ZONE_COLORS } from "@/lib/power-calc";
import { IconSymbol } from "@/components/ui/icon-symbol";

interface RideSummaryModalProps {
  visible: boolean;
  onClose: () => void;
}

// ─── 簡單圓餅圖（純 SVG，不依賴外部圖表庫）────────────────────────────────────

function PieChart({ data, colors: zoneColors }: { data: number[]; colors: string[] }) {
  const total = data.reduce((a, b) => a + b, 0);
  if (total === 0) return null;

  const size = 140;
  const cx = size / 2;
  const cy = size / 2;
  const r = 55;

  let startAngle = -Math.PI / 2;
  const slices: { path: string; color: string; pct: number }[] = [];

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

    const path = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
    slices.push({ path, color: zoneColors[i], pct });
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

// ─── Main Component ───────────────────────────────────────────────────────────

export function RideSummaryModal({ visible, onClose }: RideSummaryModalProps) {
  const colors = useColors();
  const { state } = useRide();

  const totalPowerSamples = state.powerZones.reduce((a, b) => a + b, 0);
  const zonePcts = state.powerZones.map((v) =>
    totalPowerSamples > 0 ? Math.round((v / totalPowerSamples) * 100) : 0
  );

  const handleShare = async () => {
    const distKm = (state.distance / 1000).toFixed(2);
    const duration = formatDuration(state.elapsed);
    const avgSpd = state.elapsed > 0
      ? ((state.distance / 1000) / (state.elapsed / 3600)).toFixed(1)
      : "0.0";
    const msg = [
      "🚴 智慧單車騎乘記錄",
      `距離：${distKm} km`,
      `時間：${duration}`,
      `均速：${avgSpd} km/h`,
      `最高速：${state.maxSpeed.toFixed(1)} km/h`,
      `爬升：${Math.round(state.totalAscent)} m`,
      `卡路里：${Math.round(state.calories)} kcal`,
      `均功率：${state.avgPower} W`,
      `最大功率：${state.maxPower} W`,
    ].join("\n");

    try {
      await Share.share({ message: msg });
    } catch {}
  };

  const distKm = (state.distance / 1000).toFixed(2);
  const avgSpd = state.elapsed > 0
    ? ((state.distance / 1000) / (state.elapsed / 3600)).toFixed(1)
    : "0.0";

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>騎乘摘要</Text>
          <Pressable
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
            onPress={onClose}
          >
            <IconSymbol name="xmark.circle.fill" size={28} color={colors.muted} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Stats Grid */}
          <View style={[styles.statsGrid, { borderColor: colors.border }]}>
            <StatCell label="距離" value={distKm} unit="km" colors={colors} large />
            <StatCell label="時間" value={formatDuration(state.elapsed)} unit="" colors={colors} large />
            <StatCell label="均速" value={avgSpd} unit="km/h" colors={colors} />
            <StatCell label="最高速" value={state.maxSpeed.toFixed(1)} unit="km/h" colors={colors} />
            <StatCell label="爬升" value={`${Math.round(state.totalAscent)}`} unit="m" colors={colors} />
            <StatCell label="卡路里" value={`${Math.round(state.calories)}`} unit="kcal" colors={colors} />
            <StatCell label="均功率" value={`${state.avgPower}`} unit="W" colors={colors} accent />
            <StatCell label="最大功率" value={`${state.maxPower}`} unit="W" colors={colors} accent />
          </View>

          {/* Power Zone Chart */}
          {totalPowerSamples > 0 && (
            <View style={[styles.chartSection, { borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>功率分布</Text>
              <View style={styles.chartRow}>
                <PieChart data={state.powerZones} colors={POWER_ZONE_COLORS} />
                <View style={styles.legend}>
                  {POWER_ZONE_NAMES.map((name, i) => (
                    <View key={i} style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: POWER_ZONE_COLORS[i] }]} />
                      <Text style={[styles.legendText, { color: colors.muted }]}>
                        {name}
                      </Text>
                      <Text style={[styles.legendPct, { color: colors.foreground }]}>
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
              { backgroundColor: colors.accent, opacity: pressed ? 0.85 : 1 },
            ]}
            onPress={handleShare}
          >
            <IconSymbol name="square.and.arrow.up" size={20} color="#FFFFFF" />
            <Text style={styles.shareBtnText}>分享騎乘記錄</Text>
          </Pressable>

          {/* Close Button */}
          <Pressable
            style={({ pressed }) => [
              styles.closeBtn,
              { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
            ]}
            onPress={onClose}
          >
            <Text style={[styles.closeBtnText, { color: colors.foreground }]}>完成</Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

function StatCell({
  label, value, unit, colors, large, accent,
}: {
  label: string; value: string; unit: string; colors: any; large?: boolean; accent?: boolean;
}) {
  return (
    <View style={[styles.statCell, { borderColor: colors.border }]}>
      <Text style={[styles.statValue, { color: accent ? colors.accent : colors.foreground, fontSize: large ? 28 : 22 }]}>
        {value}
      </Text>
      <Text style={[styles.statUnit, { color: colors.muted }]}>{unit}</Text>
      <Text style={[styles.statLabel, { color: colors.muted }]}>{label}</Text>
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
  headerTitle: { fontSize: 18, fontWeight: "700" },
  content: { padding: 20, paddingBottom: 40 },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 20,
  },
  statCell: {
    width: "50%",
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: "center",
    borderRightWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  statValue: { fontWeight: "600", letterSpacing: -0.5 },
  statUnit: { fontSize: 11, marginTop: 2 },
  statLabel: { fontSize: 12, marginTop: 4 },
  chartSection: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  sectionTitle: { fontSize: 15, fontWeight: "600", marginBottom: 16 },
  chartRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  legend: { flex: 1, gap: 8 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 8 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { flex: 1, fontSize: 12 },
  legendPct: { fontSize: 12, fontWeight: "600" },
  shareBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    borderRadius: 14,
    marginBottom: 12,
  },
  shareBtnText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  closeBtn: {
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
  },
  closeBtnText: { fontSize: 16, fontWeight: "600" },
});
