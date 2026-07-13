import React, { useEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  Alert,
  TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useRide, type RideRecord } from "@/lib/ride-context";
import { formatDuration } from "@/lib/power-calc";
import { calculateWeeklyTrainingStats, calculateMonthlyTrainingStats } from "@/lib/activity-stats";

const STORAGE_KEY = "@bike_records";

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { state, dispatch, loadRecords } = useRide();
  const [searchQuery, setSearchQuery] = useState("");
  const [showStats, setShowStats] = useState(false);

  // 計算周期訓練統計
  const weeklyStats = useMemo(() => calculateWeeklyTrainingStats(state.records), [state.records]);
  const monthlyStats = useMemo(() => calculateMonthlyTrainingStats(state.records), [state.records]);

  useEffect(() => {
    loadRecords();
  }, []);

  // 依關鍵字過濾記錄（搜尋路線名稱、日期、距離、時間）
  const filteredRecords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return state.records;
    return state.records.filter((r) => {
      const date = new Date(r.date);
      const dateStr = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;
      const distKm = (r.distance / 1000).toFixed(2);
      const name = (r.name || dateStr).toLowerCase();
      const dur = formatDuration(r.duration).toLowerCase();
      const cal = `${r.calories}`;
      const speed = r.avgSpeed.toFixed(1);
      return (
        name.includes(q) ||
        dateStr.includes(q) ||
        distKm.includes(q) ||
        dur.includes(q) ||
        cal.includes(q) ||
        speed.includes(q)
      );
    });
  }, [state.records, searchQuery]);

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
        },
      },
    ]);
  };

  const handleViewDetail = (id: string) => {
    router.push({ pathname: "/ride-detail", params: { id } });
  };

  const renderItem = ({ item }: { item: RideRecord }) => {
    const date = new Date(item.date);
    const dateStr = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;
    const timeStr = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
    const distKm = (item.distance / 1000).toFixed(2);
    const hasRoute = item.route && item.route.length > 1;

    return (
      <Pressable
        style={({ pressed }) => [
          styles.recordCard,
          { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.9 : 1 },
        ]}
        onPress={() => handleViewDetail(item.id)}
      >
        {/* 路線名稱 */}
        <Text style={[styles.routeName, { color: colors.foreground }]} numberOfLines={1}>
          {item.name || dateStr}
        </Text>

        {/* 日期時間 */}
        <View style={styles.dateRow}>
          <Text style={[styles.dateText, { color: colors.muted }]}>{dateStr}</Text>
          <Text style={[styles.timeText, { color: colors.muted }]}>{timeStr}</Text>
        </View>

        {/* 主要數據 */}
        <View style={styles.statsRow}>
          <StatChip icon="location.fill" value={`${distKm} km`} color={colors.accent} />
          <StatChip icon="clock.fill" value={formatDuration(item.duration)} color={colors.muted} />
          <StatChip icon="flame.fill" value={`${item.calories} kcal`} color={colors.warning} />
        </View>

        {/* 底部操作列 */}
        <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
          {/* 均速 */}
          <View style={styles.avgSpeedBox}>
            <Text style={[styles.avgSpeed, { color: colors.foreground }]}>
              {item.avgSpeed.toFixed(1)}
            </Text>
            <Text style={[styles.avgSpeedUnit, { color: colors.muted }]}>km/h 均速</Text>
          </View>

          <View style={styles.footerActions}>
            {/* 查看軌跡按鈕 */}
            <Pressable
              style={({ pressed }) => [
                styles.trailBtn,
                { backgroundColor: hasRoute ? colors.accent + "18" : colors.border + "40",
                  borderColor: hasRoute ? colors.accent + "50" : colors.border,
                  opacity: pressed ? 0.7 : 1 },
              ]}
              onPress={() => handleViewDetail(item.id)}
            >
              <IconSymbol
                name="map.fill"
                size={13}
                color={hasRoute ? colors.accent : colors.muted}
              />
              <Text style={[styles.trailBtnText, { color: hasRoute ? colors.accent : colors.muted }]}>
                查看軌跡
              </Text>
            </Pressable>

            {/* 查看 Relive 按鈕 */}
            <Pressable
              style={({ pressed }) => [
                styles.trailBtn,
                { backgroundColor: hasRoute ? colors.primary + "18" : colors.border + "40",
                  borderColor: hasRoute ? colors.primary + "50" : colors.border,
                  opacity: pressed ? 0.7 : 1 },
              ]}
              onPress={() => hasRoute && router.push({ pathname: "/relive", params: { id: item.id } })}
            >
              <IconSymbol
                name="play.circle.fill"
                size={13}
                color={hasRoute ? colors.primary : colors.muted}
              />
              <Text style={[styles.trailBtnText, { color: hasRoute ? colors.primary : colors.muted }]}>
                查看軌跡
              </Text>
            </Pressable>

            {/* 刪除按鈕 */}
            <Pressable
              style={({ pressed }) => [styles.deleteBtn, { opacity: pressed ? 0.6 : 1 }]}
              onPress={() => handleDelete(item.id)}
            >
              <IconSymbol name="xmark.circle.fill" size={18} color={colors.error} />
            </Pressable>
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <ScreenContainer containerClassName="bg-background">
      {/* 標題列 */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: colors.foreground }]}>騎乘記錄</Text>
          {state.records.length > 0 && (
            <Text style={[styles.subtitle, { color: colors.muted }]}>
              {searchQuery.trim()
                ? `${filteredRecords.length} / ${state.records.length} 筆`
                : `共 ${state.records.length} 筆`}
            </Text>
          )}
        </View>

        {/* 周期訓練統計面板 */}
        {state.records.length > 0 && (
          <Pressable
            onPress={() => setShowStats(!showStats)}
            style={[styles.statsToggle, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <View style={styles.statsToggleContent}>
              <Text style={[styles.statsToggleLabel, { color: colors.foreground }]}>📊 本周訓練負荷</Text>
              <Text style={[styles.statsToggleValue, { color: colors.primary }]}>{weeklyStats.totalTSS.toFixed(0)} TSS</Text>
            </View>
            <IconSymbol name={showStats ? "chevron.up" : "chevron.down"} size={16} color={colors.muted} />
          </Pressable>
        )}

        {/* 展開的訓練統計詳情 */}
        {showStats && state.records.length > 0 && (
          <View style={[styles.statsDetail, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.statsPeriod}>
              <Text style={[styles.statsPeriodTitle, { color: colors.foreground }]}>本周訓練</Text>
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={[styles.statLabel, { color: colors.muted }]}>總 TSS</Text>
                  <Text style={[styles.statValue, { color: colors.primary }]}>{weeklyStats.totalTSS.toFixed(0)}</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={[styles.statLabel, { color: colors.muted }]}>騎乘次數</Text>
                  <Text style={[styles.statValue, { color: colors.foreground }]}>{weeklyStats.rideCount}</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={[styles.statLabel, { color: colors.muted }]}>負荷等級</Text>
                  <Text style={[styles.statValue, { color: colors.foreground }]}>{weeklyStats.trainingLoadLabel}</Text>
                </View>
              </View>
            </View>
            <View style={[styles.statsDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statsPeriod}>
              <Text style={[styles.statsPeriodTitle, { color: colors.foreground }]}>本月訓練</Text>
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={[styles.statLabel, { color: colors.muted }]}>總 TSS</Text>
                  <Text style={[styles.statValue, { color: colors.primary }]}>{monthlyStats.totalTSS.toFixed(0)}</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={[styles.statLabel, { color: colors.muted }]}>騎乘次數</Text>
                  <Text style={[styles.statValue, { color: colors.foreground }]}>{monthlyStats.rideCount}</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={[styles.statLabel, { color: colors.muted }]}>負荷等級</Text>
                  <Text style={[styles.statValue, { color: colors.foreground }]}>{monthlyStats.trainingLoadLabel}</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* 搜索欄 */}
        <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <IconSymbol name="magnifyingglass" size={16} color={colors.muted} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground }]}
            placeholder="搜尋路線名稱、日期、距離..."
            placeholderTextColor={colors.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <Pressable
              onPress={() => setSearchQuery("")}
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
            >
              <IconSymbol name="xmark.circle.fill" size={16} color={colors.muted} />
            </Pressable>
          )}
        </View>
      </View>

      {state.records.length === 0 ? (
        <View style={styles.emptyState}>
          <IconSymbol name="clock.fill" size={56} color={colors.border} />
          <Text style={[styles.emptyTitle, { color: colors.muted }]}>尚無騎乘記錄</Text>
          <Text style={[styles.emptySubtitle, { color: colors.muted }]}>
            完成一次騎乘後{"\n"}記錄將顯示在這裡
          </Text>
        </View>
      ) : filteredRecords.length === 0 ? (
        <View style={styles.emptyState}>
          <IconSymbol name="magnifyingglass" size={48} color={colors.border} />
          <Text style={[styles.emptyTitle, { color: colors.muted }]}>找不到符合的記錄</Text>
          <Text style={[styles.emptySubtitle, { color: colors.muted }]}>
            試試其他關鍵字{"\n"}例如日期、距離或路線名稱
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredRecords}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={[styles.listContent, { paddingBottom: Math.max(insets.bottom, 24) }]}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          keyboardShouldPersistTaps="handled"
        />
      )}
    </ScreenContainer>
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

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8 },
  titleRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 },
  title: { fontSize: 28, fontWeight: "700", letterSpacing: -0.5 },
  subtitle: { fontSize: 13 },

  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
  },

  listContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24 },

  recordCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  routeName: {
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  dateRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  dateText: { fontSize: 12 },
  timeText: { fontSize: 12 },
  statsRow: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  statChip: { flexDirection: "row", alignItems: "center", gap: 4 },
  statChipText: { fontSize: 12, fontWeight: "500" },

  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
    marginTop: 2,
  },
  avgSpeedBox: { flexDirection: "row", alignItems: "baseline", gap: 4 },
  avgSpeed: { fontSize: 20, fontWeight: "600" },
  avgSpeedUnit: { fontSize: 11 },

  footerActions: { flexDirection: "row", alignItems: "center", gap: 10 },
  trailBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  trailBtnText: { fontSize: 12, fontWeight: "600" },
  deleteBtn: { padding: 4 },

  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "600" },
  emptySubtitle: { fontSize: 14, textAlign: "center", lineHeight: 22 },

  statsToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  statsToggleContent: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  statsToggleLabel: { fontSize: 14, fontWeight: "600" },
  statsToggleValue: { fontSize: 14, fontWeight: "700" },

  statsDetail: {
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  statsPeriod: { gap: 8 },
  statsPeriodTitle: { fontSize: 13, fontWeight: "600" },
  statItem: { alignItems: "center", gap: 4 },
  statLabel: { fontSize: 11 },
  statValue: { fontSize: 14, fontWeight: "600" },
  statsDivider: { height: StyleSheet.hairlineWidth, marginVertical: 8 },
});
