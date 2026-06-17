import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  Modal,
  ScrollView,
  Share,
  Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Svg, { G, Path } from "react-native-svg";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useRide, type RideRecord } from "@/lib/ride-context";
import { formatDuration, POWER_ZONE_NAMES, POWER_ZONE_COLORS } from "@/lib/power-calc";

const STORAGE_KEY = "@bike_records";

export default function HistoryScreen() {
  const colors = useColors();
  const { state, dispatch, loadRecords } = useRide();
  const [selectedRecord, setSelectedRecord] = useState<RideRecord | null>(null);

  useEffect(() => {
    loadRecords();
  }, []);

  const handleDelete = (id: string) => {
    Alert.alert("刪除記錄", "確定要刪除這筆騎乘記錄嗎？", [
      { text: "取消", style: "cancel" },
      {
        text: "刪除",
        style: "destructive",
        onPress: async () => {
          const updated = state.records.filter((r) => r.id !== id);
          dispatch({ type: "LOAD_RECORDS", records: updated });
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
          if (selectedRecord?.id === id) setSelectedRecord(null);
        },
      },
    ]);
  };

  const renderItem = ({ item }: { item: RideRecord }) => {
    const date = new Date(item.date);
    const dateStr = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;
    const timeStr = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
    const distKm = (item.distance / 1000).toFixed(2);

    return (
      <Pressable
        style={({ pressed }) => [
          styles.recordCard,
          { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.8 : 1 },
        ]}
        onPress={() => setSelectedRecord(item)}
      >
        <View style={styles.cardLeft}>
          <View style={styles.dateRow}>
            <Text style={[styles.dateText, { color: colors.foreground }]}>{dateStr}</Text>
            <Text style={[styles.timeText, { color: colors.muted }]}>{timeStr}</Text>
          </View>
          <View style={styles.statsRow}>
            <StatChip icon="location.fill" value={`${distKm} km`} color={colors.accent} />
            <StatChip icon="clock.fill" value={formatDuration(item.duration)} color={colors.muted} />
            <StatChip icon="flame.fill" value={`${item.calories} kcal`} color={colors.warning} />
          </View>
        </View>
        <View style={styles.cardRight}>
          <Text style={[styles.avgSpeed, { color: colors.foreground }]}>
            {item.avgSpeed.toFixed(1)}
          </Text>
          <Text style={[styles.avgSpeedUnit, { color: colors.muted }]}>km/h</Text>
        </View>
      </Pressable>
    );
  };

  return (
    <ScreenContainer containerClassName="bg-background">
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.foreground }]}>騎乘記錄</Text>
        {state.records.length > 0 && (
          <Text style={[styles.subtitle, { color: colors.muted }]}>
            共 {state.records.length} 筆記錄
          </Text>
        )}
      </View>

      {state.records.length === 0 ? (
        <View style={styles.emptyState}>
          <IconSymbol name="clock.fill" size={56} color={colors.border} />
          <Text style={[styles.emptyTitle, { color: colors.muted }]}>尚無騎乘記錄</Text>
          <Text style={[styles.emptySubtitle, { color: colors.muted }]}>
            完成一次騎乘後{"\n"}記錄將顯示在這裡
          </Text>
        </View>
      ) : (
        <FlatList
          data={state.records}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        />
      )}

      {/* Detail Modal */}
      {selectedRecord && (
        <RecordDetailModal
          record={selectedRecord}
          onClose={() => setSelectedRecord(null)}
          onDelete={() => handleDelete(selectedRecord.id)}
        />
      )}
    </ScreenContainer>
  );
}

// ─── Record Detail Modal ──────────────────────────────────────────────────────

function RecordDetailModal({
  record,
  onClose,
  onDelete,
}: {
  record: RideRecord;
  onClose: () => void;
  onDelete: () => void;
}) {
  const colors = useColors();
  const date = new Date(record.date);
  const dateStr = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;

  const totalZones = record.powerZones.reduce((a, b) => a + b, 0);
  const zonePcts = record.powerZones.map((v) =>
    totalZones > 0 ? Math.round((v / totalZones) * 100) : 0
  );

  const handleShare = async () => {
    const distKm = (record.distance / 1000).toFixed(2);
    const msg = [
      "🚴 智慧單車騎乘記錄",
      `日期：${dateStr}`,
      `距離：${distKm} km`,
      `時間：${formatDuration(record.duration)}`,
      `均速：${record.avgSpeed.toFixed(1)} km/h`,
      `最高速：${record.maxSpeed.toFixed(1)} km/h`,
      `爬升：${Math.round(record.totalAscent)} m`,
      `卡路里：${record.calories} kcal`,
      `均功率：${record.avgPower} W`,
    ].join("\n");
    await Share.share({ message: msg });
  };

  // Mini pie chart
  const renderPie = () => {
    if (totalZones === 0) return null;
    const size = 100;
    const cx = size / 2;
    const cy = size / 2;
    const r = 38;
    let startAngle = -Math.PI / 2;
    const slices: { path: string; color: string }[] = [];

    record.powerZones.forEach((val, i) => {
      if (val === 0) return;
      const pct = val / totalZones;
      const angle = pct * 2 * Math.PI;
      const endAngle = startAngle + angle;
      const x1 = cx + r * Math.cos(startAngle);
      const y1 = cy + r * Math.sin(startAngle);
      const x2 = cx + r * Math.cos(endAngle);
      const y2 = cy + r * Math.sin(endAngle);
      const largeArc = angle > Math.PI ? 1 : 0;
      slices.push({
        path: `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`,
        color: POWER_ZONE_COLORS[i],
      });
      startAngle = endAngle;
    });

    return (
      <Svg width={size} height={size}>
        <G>
          {slices.map((s, i) => <Path key={i} d={s.path} fill={s.color} />)}
        </G>
      </Svg>
    );
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
        <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
          <Pressable style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })} onPress={onClose}>
            <IconSymbol name="chevron.right" size={24} color={colors.muted} style={{ transform: [{ rotate: "180deg" }] }} />
          </Pressable>
          <Text style={[styles.modalTitle, { color: colors.foreground }]}>{dateStr}</Text>
          <Pressable style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })} onPress={onDelete}>
            <IconSymbol name="xmark.circle.fill" size={24} color={colors.error} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
          {/* Stats */}
          <View style={[styles.statsGrid, { borderColor: colors.border }]}>
            <DetailCell label="距離" value={`${(record.distance / 1000).toFixed(2)} km`} colors={colors} large />
            <DetailCell label="時間" value={formatDuration(record.duration)} colors={colors} large />
            <DetailCell label="均速" value={`${record.avgSpeed.toFixed(1)} km/h`} colors={colors} />
            <DetailCell label="最高速" value={`${record.maxSpeed.toFixed(1)} km/h`} colors={colors} />
            <DetailCell label="爬升" value={`${Math.round(record.totalAscent)} m`} colors={colors} />
            <DetailCell label="卡路里" value={`${record.calories} kcal`} colors={colors} />
            <DetailCell label="均功率" value={`${record.avgPower} W`} colors={colors} accent />
            <DetailCell label="最大功率" value={`${record.maxPower} W`} colors={colors} accent />
          </View>

          {/* Power Zones */}
          {totalZones > 0 && (
            <View style={[styles.zoneSection, { borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>功率分布</Text>
              <View style={styles.zoneRow}>
                {renderPie()}
                <View style={styles.zoneLegend}>
                  {POWER_ZONE_NAMES.map((name, i) => (
                    <View key={i} style={styles.zoneLegendItem}>
                      <View style={[styles.zoneDot, { backgroundColor: POWER_ZONE_COLORS[i] }]} />
                      <Text style={[styles.zoneName, { color: colors.muted }]}>{name}</Text>
                      <Text style={[styles.zonePct, { color: colors.foreground }]}>{zonePcts[i]}%</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          )}

          {/* Actions */}
          <Pressable
            style={({ pressed }) => [styles.shareBtn, { backgroundColor: colors.accent, opacity: pressed ? 0.85 : 1 }]}
            onPress={handleShare}
          >
            <IconSymbol name="square.and.arrow.up" size={18} color="#FFFFFF" />
            <Text style={styles.shareBtnText}>分享</Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

function StatChip({ icon, value, color }: { icon: string; value: string; color: string }) {
  return (
    <View style={styles.statChip}>
      <IconSymbol name={icon as any} size={12} color={color} />
      <Text style={[styles.statChipText, { color }]}>{value}</Text>
    </View>
  );
}

function DetailCell({ label, value, colors, large, accent }: {
  label: string; value: string; colors: any; large?: boolean; accent?: boolean;
}) {
  return (
    <View style={[styles.detailCell, { borderColor: colors.border }]}>
      <Text style={[styles.detailValue, { color: accent ? colors.accent : colors.foreground, fontSize: large ? 22 : 18 }]}>
        {value}
      </Text>
      <Text style={[styles.detailLabel, { color: colors.muted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 },
  title: { fontSize: 28, fontWeight: "700", letterSpacing: -0.5 },
  subtitle: { fontSize: 13, marginTop: 4 },
  listContent: { paddingHorizontal: 16, paddingBottom: 24 },
  recordCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  cardLeft: { flex: 1 },
  dateRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  dateText: { fontSize: 15, fontWeight: "600" },
  timeText: { fontSize: 13 },
  statsRow: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  statChip: { flexDirection: "row", alignItems: "center", gap: 4 },
  statChipText: { fontSize: 12, fontWeight: "500" },
  cardRight: { alignItems: "center", minWidth: 60 },
  avgSpeed: { fontSize: 24, fontWeight: "600" },
  avgSpeedUnit: { fontSize: 11 },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "600" },
  emptySubtitle: { fontSize: 14, textAlign: "center", lineHeight: 22 },
  // Modal
  modalContainer: { flex: 1 },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: { fontSize: 14, fontWeight: "600" },
  modalContent: { padding: 20, paddingBottom: 40 },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 16,
  },
  detailCell: {
    width: "50%",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  detailValue: { fontWeight: "600" },
  detailLabel: { fontSize: 12, marginTop: 4 },
  zoneSection: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 14, fontWeight: "600", marginBottom: 12 },
  zoneRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  zoneLegend: { flex: 1, gap: 6 },
  zoneLegendItem: { flexDirection: "row", alignItems: "center", gap: 8 },
  zoneDot: { width: 8, height: 8, borderRadius: 4 },
  zoneName: { flex: 1, fontSize: 11 },
  zonePct: { fontSize: 12, fontWeight: "600" },
  shareBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  shareBtnText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
});
