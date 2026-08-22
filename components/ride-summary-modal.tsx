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
import { useColors } from "@/hooks/use-colors";
import { useRide } from "@/lib/ride-context";
import { persistRideMedia } from "@/lib/local-ride-media";
import { formatDuration, POWER_ZONE_NAMES, POWER_ZONE_COLORS } from "@/lib/power-calc";
import { buildActivityStatistics } from "@/lib/activity-statistics";
import { IconSymbol } from "@/components/ui/icon-symbol";
import type { RideSummarySnapshot } from "@/lib/ride-summary-snapshot";

interface RideSummaryModalProps {
  visible: boolean;
  recordId?: string | null;
  /** 結束騎乘時凍結的統計，避免完成流程重設即時 state 後顯示全零。 */
  snapshot?: RideSummarySnapshot | null;
  /** 關閉時傳入使用者輸入的路線名稱（空字串代表使用預設名稱） */
  onClose: (routeName?: string, mediaItems?: string[]) => void | Promise<void>;
}

// ─── 圓餅圖（純 SVG）────────────────────────────────────────────────────────────
function PieChart({ data, colors: zoneColors }: { data: number[]; colors: string[] }) {
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
    slices.push({ path: `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`, color: zoneColors[i] });
    startAngle = endAngle;
  });
  return (
    <Svg width={size} height={size}>
      <G>
        {slices.map((s, i) => <Path key={i} d={s.path} fill={s.color} />)}
        <Circle cx={cx} cy={cy} r={28} fill="transparent" />
      </G>
    </Svg>
  );
}

// ─── 生成預設路線名稱 ────────────────────────────────────────────────────────────
function generateDefaultName(): string {
  const d = new Date();
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const hour = d.getHours();
  const period = hour < 6 ? "深夜" : hour < 12 ? "早晨" : hour < 18 ? "下午" : "夜間";
  return `${month}月${day}日 ${period}騎乘`;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function RideSummaryModal({ visible, recordId, snapshot, onClose }: RideSummaryModalProps) {
  const colors = useColors();
  const { state } = useRide();

  const [routeName, setRouteName] = useState("");
  const [mediaItems, setMediaItems] = useState<string[]>([]);
  const [isPickingMedia, setIsPickingMedia] = useState(false);

  // 每次 Modal 開啟時重設為預設名稱
  useEffect(() => {
    if (visible) {
      setRouteName(generateDefaultName());
      setMediaItems([]);
    }
  }, [visible]);

  const summary = snapshot ?? state;
  const totalPowerSamples = summary.powerZones.reduce((a, b) => a + b, 0);
  const zonePcts = summary.powerZones.map((v) =>
    totalPowerSamples > 0 ? Math.round((v / totalPowerSamples) * 100) : 0
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
  const powerSourceLabel = activityStats.powerSource === "measured"
    ? "功率計量測"
    : activityStats.powerSource === "estimated"
      ? "本機物理估算"
      : "功率資料不足";

  const handleShare = async () => {
    const msg = [
      `🚴 ${routeName || "智慧單車騎乘記錄"}`,
      `距離：${distKm} km`,
      `活動時間：${formatDuration(activityStats.elapsedTimeSec)}`,
      `移動時間：${formatDuration(activityStats.movingTimeSec)}`,
      `均速：${avgSpd} km/h`,
      `最高速：${summary.maxSpeed.toFixed(1)} km/h`,
      `爬升／下降：${Math.round(activityStats.totalAscentM)}／${Math.round(activityStats.totalDescentM)} m`,
      `卡路里：${Math.round(activityStats.caloriesKcal)} kcal（估算）`,
      `暫停時間：${formatDuration(activityStats.pausedTimeSec)}`,
      `均功率：${activityStats.averagePowerW === undefined ? "--" : `${Math.round(activityStats.averagePowerW)} W`}（${powerSourceLabel}）`,
      `最大功率：${activityStats.maxPowerW === undefined ? "--" : `${Math.round(activityStats.maxPowerW)} W`}`,
    ].join("\n");
    try { await Share.share({ message: msg }); } catch {}
  };

  const handlePickMedia = async () => {
    if (!recordId) {
      Alert.alert("請稍候", "騎乘紀錄尚在準備中，請稍後再加入媒體。");
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
      Alert.alert("無法加入媒體", "請確認已允許選取相片或影片。");
    } finally {
      setIsPickingMedia(false);
    }
  };

  const handleSave = async () => {
    await onClose(routeName.trim() || generateDefaultName(), mediaItems);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => onClose()}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={[styles.container, { backgroundColor: colors.background }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Text style={[styles.headerTitle, { color: colors.foreground }]}>騎乘摘要</Text>
            <Pressable
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
              onPress={() => onClose()}
            >
              <IconSymbol name="xmark.circle.fill" size={28} color={colors.muted} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* ── 路線命名區塊 ── */}
            <View style={[styles.nameSection, { borderColor: colors.border, backgroundColor: colors.surface }]}>
              <View style={styles.nameLabelRow}>
                <IconSymbol name="pencil" size={15} color={colors.accent} />
                <Text style={[styles.nameLabel, { color: colors.foreground }]}>路線名稱</Text>
              </View>
              <TextInput
                style={[styles.nameInput, { color: colors.foreground, borderColor: colors.border }]}
                value={routeName}
                onChangeText={setRouteName}
                placeholder="輸入路線名稱..."
                placeholderTextColor={colors.muted}
                returnKeyType="done"
                maxLength={40}
                selectTextOnFocus
              />
              <Text style={[styles.nameHint, { color: colors.muted }]}> 
                儲存後可在歷史記錄中查看、修改與分享
              </Text>
            </View>

            <View style={[styles.mediaSection, { borderColor: colors.border, backgroundColor: colors.surface }]}> 
              <View style={styles.mediaHeader}>
                <View>
                  <Text style={[styles.panelTitle, { color: colors.foreground, marginBottom: 2 }]}>活動媒體</Text>
                  <Text style={[styles.nameHint, { color: colors.muted }]}>相片或影片只會保存於此裝置</Text>
                </View>
                <Pressable
                  style={({ pressed }) => [styles.addMediaButton, { backgroundColor: colors.accent, opacity: pressed || isPickingMedia ? 0.72 : 1 }]}
                  onPress={handlePickMedia}
                  disabled={isPickingMedia}
                >
                  <IconSymbol name="plus" size={17} color={colors.onAccent} />
                  <Text style={styles.addMediaButtonText}>{isPickingMedia ? "處理中" : "加入"}</Text>
                </Pressable>
              </View>
              {mediaItems.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mediaPreviewRow}>
                  {mediaItems.map((uri, index) => (
                    <View key={`${uri}-${index}`} style={styles.mediaPreviewItem}>
                      {/(\.mp4|\.mov|\.m4v|\.webm)(\?|$)/i.test(uri) ? (
                        <View style={[styles.videoPreview, { backgroundColor: colors.background }]}>
                          <Text style={styles.videoPlayGlyph}>▶</Text>
                          <Text style={[styles.videoPreviewLabel, { color: colors.muted }]}>影片</Text>
                        </View>
                      ) : <Image source={{ uri }} style={styles.mediaPreviewImage} />}
                      <Pressable
                        style={styles.removeMediaButton}
                        onPress={() => setMediaItems((previous) => previous.filter((_, itemIndex) => itemIndex !== index))}
                      >
                        <Text style={styles.removeMediaButtonText}>×</Text>
                      </Pressable>
                    </View>
                  ))}
                </ScrollView>
              ) : (
                <Pressable style={[styles.mediaEmptyState, { borderColor: colors.border }]} onPress={handlePickMedia}>
                  <Text style={[styles.mediaEmptyIcon, { color: colors.accent }]}>＋</Text>
                  <Text style={[styles.mediaEmptyText, { color: colors.muted }]}>為這次騎乘加入照片或影片</Text>
                </Pressable>
              )}
            </View>

            {/* 核心數據面板 */}
            <View style={[styles.statsPanel, { borderColor: colors.border }]}>
              <Text style={[styles.panelTitle, { color: colors.foreground }]}>核心數據</Text>
              <View style={styles.statsGrid}>
                <StatCell label="距離" value={distKm} unit="km" colors={colors} />
                <StatCell label="活動時間" value={formatDuration(activityStats.elapsedTimeSec)} unit="" colors={colors} />
                <StatCell label="移動時間" value={formatDuration(activityStats.movingTimeSec)} unit="" colors={colors} />
                <StatCell label="平均速度" value={activityStats.averageSpeedKmh.toFixed(1)} unit="km/h" colors={colors} />
                <StatCell label="最高速度" value={activityStats.maxSpeedKmh.toFixed(1)} unit="km/h" colors={colors} />
                <StatCell label="消耗熱量" value={`${Math.round(activityStats.caloriesKcal)}`} unit="kcal（估算）" colors={colors} />
              </View>
            </View>

            {/* 爬升與地形數據面板 */}
            <View style={[styles.statsPanel, { borderColor: colors.border }]}>
              <Text style={[styles.panelTitle, { color: colors.foreground }]}>爬升與地形</Text>
              <View style={styles.statsGrid}>
                <StatCell label="總爬升高度" value={`${Math.round(activityStats.totalAscentM)}`} unit="m" colors={colors} />
                <StatCell label="總下降高度" value={`${Math.round(activityStats.totalDescentM)}`} unit="m" colors={colors} />
                <StatCell label="最高海拔" value={activityStats.maxElevationM === undefined ? "--" : `${Math.round(activityStats.maxElevationM)}`} unit="m" colors={colors} />
                <StatCell label="最低海拔" value={activityStats.minElevationM === undefined ? "--" : `${Math.round(activityStats.minElevationM)}`} unit="m" colors={colors} />
              </View>
            </View>

            {/* 進階訓練數據面板 */}
            <View style={[styles.statsPanel, { borderColor: colors.border }]}>
              <Text style={[styles.panelTitle, { color: colors.foreground }]}>進階訓練數據</Text>
              <View style={styles.statsGrid}>
                <StatCell label="平均功率" value={activityStats.averagePowerW === undefined ? "--" : `${Math.round(activityStats.averagePowerW)}`} unit="W" colors={colors} accent />
                <StatCell label="最大功率" value={activityStats.maxPowerW === undefined ? "--" : `${Math.round(activityStats.maxPowerW)}`} unit={activityStats.maxPowerW === undefined ? "資料不足" : "W"} colors={colors} accent />
                <StatCell label="機械工作量" value={activityStats.totalWorkKj === undefined ? "--" : `${Math.round(activityStats.totalWorkKj)}`} unit="kJ" colors={colors} />
                <StatCell label="暫停時間" value={formatDuration(activityStats.pausedTimeSec)} unit="" colors={colors} />
              </View>
              <Text style={[styles.nameHint, { color: colors.muted }]}>{powerSourceLabel}；卡路里為本機估算，非功率計或代謝量測值。</Text>
            </View>

            {/* Power Zone Chart */}
            {totalPowerSamples > 0 && (
              <View style={[styles.chartSection, { borderColor: colors.border }]}>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>功率分布</Text>
                <View style={styles.chartRow}>
                  <PieChart data={summary.powerZones} colors={POWER_ZONE_COLORS} />
                  <View style={styles.legend}>
                    {POWER_ZONE_NAMES.map((name, i) => (
                      <View key={i} style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: POWER_ZONE_COLORS[i] }]} />
                        <Text style={[styles.legendText, { color: colors.muted }]}>{name}</Text>
                        <Text style={[styles.legendPct, { color: colors.foreground }]}>{zonePcts[i]}%</Text>
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
                { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
              ]}
              onPress={handleShare}
            >
              <IconSymbol name="square.and.arrow.up" size={18} color={colors.foreground} />
              <Text style={[styles.shareBtnText, { color: colors.foreground }]}>分享騎乘記錄</Text>
            </Pressable>

            {/* Save & Close Button */}
            <Pressable
              style={({ pressed }) => [
                styles.saveBtn,
                { backgroundColor: colors.accent, opacity: pressed ? 0.85 : 1 },
              ]}
              onPress={handleSave}
            >
              <IconSymbol name="checkmark.circle.fill" size={20} color={colors.onAccent} />
              <Text style={[styles.saveBtnText, { color: colors.onAccent }]}>儲存並完成</Text>
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function StatCell({
  label, value, unit, colors, large, accent,
}: {
  label: string; value: string; unit: string; colors: any; large?: boolean; accent?: boolean;
}) {
  return (
    <View style={[styles.statCell, { backgroundColor: accent ? `${colors.accent}15` : `${colors.foreground}08` }]}>
      <Text style={[styles.statValue, { color: accent ? colors.accent : colors.foreground }]}>
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
  headerTitle: { fontSize: 20, fontWeight: "800" },
  content: { padding: 20, paddingBottom: 40 },

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

  mediaSection: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 14, marginBottom: 16 },
  mediaHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  addMediaButton: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  addMediaButtonText: { color: "#fff", fontSize: 13, fontWeight: "800" },
  mediaPreviewRow: { gap: 10, paddingRight: 4 },
  mediaPreviewItem: { width: 114, height: 88, borderRadius: 11, overflow: "visible" },
  mediaPreviewImage: { width: "100%", height: "100%", borderRadius: 11, backgroundColor: "#111" },
  videoPreview: { width: "100%", height: "100%", borderRadius: 11, alignItems: "center", justifyContent: "center" },
  videoPlayGlyph: { color: "#fff", fontSize: 24, marginBottom: 3 },
  videoPreviewLabel: { fontSize: 12, fontWeight: "800" },
  removeMediaButton: { position: "absolute", top: -7, right: -7, width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: "#F04438" },
  removeMediaButtonText: { color: "#fff", fontSize: 17, lineHeight: 19, fontWeight: "700" },
  mediaEmptyState: { height: 76, borderWidth: StyleSheet.hairlineWidth, borderStyle: "dashed", borderRadius: 11, alignItems: "center", justifyContent: "center", gap: 3 },
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
