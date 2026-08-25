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
import { calculateMonthlySportStats, calculateWeeklySportStats, filterRecordsBySport } from "@/lib/activity-stats";
import { buildLocalTrainingLog, shiftTrainingLogMonth } from "@/lib/local-training-log";
import { formatPaceFromKmh, SPORT_META, type SportType } from "@/lib/sport-metrics";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/lib/i18n/language-provider";

const STORAGE_KEY = "@bike_records";
const SPORT_FILTERS: ("all" | SportType)[] = ["all", "cycling", "running", "hiking", "trail_running"];

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { t } = useTranslation();
  const { activeLanguage, isRTL } = useLanguage();
  const { state, dispatch, loadRecords } = useRide();
  const [searchQuery, setSearchQuery] = useState("");
  const [sportFilter, setSportFilter] = useState<"all" | SportType>("all");
  const [showStats, setShowStats] = useState(false);
  const [trainingLogMonth, setTrainingLogMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));

  const selectedSportType = sportFilter === "all" ? undefined : sportFilter;
  const sportLabel = (sportType: SportType) => t(`sports.${sportType === "trail_running" ? "trailRunning" : sportType}`);
  const selectedSportLabel = selectedSportType ? sportLabel(selectedSportType) : t("history.allSports");
  const selectedSportRecords = useMemo(() => filterRecordsBySport(state.records, selectedSportType), [state.records, selectedSportType]);
  const weeklyStats = useMemo(() => calculateWeeklySportStats(state.records, selectedSportType), [state.records, selectedSportType]);
  const monthlyStats = useMemo(() => calculateMonthlySportStats(state.records, selectedSportType), [state.records, selectedSportType]);
  const selectedMonthStats = useMemo(
    () => calculateMonthlySportStats(state.records, selectedSportType, trainingLogMonth.getMonth(), trainingLogMonth.getFullYear()),
    [state.records, selectedSportType, trainingLogMonth],
  );
  const trainingLog = useMemo(
    () => buildLocalTrainingLog(selectedSportRecords, trainingLogMonth.getFullYear(), trainingLogMonth.getMonth()),
    [selectedSportRecords, trainingLogMonth],
  );
  const usePace = selectedSportType === "running" || selectedSportType === "trail_running";
  const formatPeriodMetric = (stats: typeof weeklyStats) => usePace
    ? `${formatPaceFromKmh(stats.averageSpeed)} /km`
    : `${stats.averageSpeed.toFixed(1)} km/h`;

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  // 依關鍵字過濾記錄（搜尋路線名稱、日期、距離、時間）
  const filteredRecords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return state.records.filter((r) => {
      if (sportFilter !== "all" && (r.sportType ?? "cycling") !== sportFilter) return false;
      if (!q) return true;
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
  }, [state.records, searchQuery, sportFilter]);

  const handleDelete = (id: string) => {
    Alert.alert(t("history.deleteTitle"), t("history.deleteMessage"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("history.deleteTitle"),
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
    const dateStr = date.toLocaleDateString(activeLanguage, { year: "numeric", month: "2-digit", day: "2-digit" });
    const timeStr = date.toLocaleTimeString(activeLanguage, { hour: "2-digit", minute: "2-digit" });
    const distKm = (item.distance / 1000).toFixed(2);
    const sportType = item.sportType ?? "cycling";
    const sportMeta = SPORT_META[sportType];
    const footerMetric = sportType === "running"
      ? { value: formatPaceFromKmh(item.avgSpeed), unit: `${t("history.avgPaceUnit")} /km` }
      : sportType === "hiking" || sportType === "trail_running"
        ? { value: `${Math.round(item.totalAscent)} m`, unit: t("history.elevationGain") }
        : { value: item.avgSpeed.toFixed(1), unit: `km/h ${t("history.avgSpeedUnit")}` };

    return (
      <Pressable
        style={({ pressed }) => [
          styles.recordCard,
          { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.9 : 1 },
        ]}
        onPress={() => handleViewDetail(item.id)}
      >
        {/* 路線名稱 */}
        <Text style={[styles.routeName, { color: colors.foreground, textAlign: isRTL ? "right" : "left" }]}>
          {item.name || dateStr}
        </Text>
        <View style={[styles.sportBadge, { backgroundColor: `${sportMeta.accent}22` }]}>
          <Text style={[styles.sportBadgeText, { color: sportMeta.accent }]}>{sportMeta.icon} {sportLabel(sportType)}</Text>
        </View>

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
              {footerMetric.value}
            </Text>
            <Text style={[styles.avgSpeedUnit, { color: colors.muted }]}>{footerMetric.unit}</Text>
          </View>

          <View style={styles.footerActions}>
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
          <Text style={[styles.title, { color: colors.foreground }]}>{t("history.title")}</Text>
          {state.records.length > 0 && (
            <Text style={[styles.subtitle, { color: colors.muted }]}>
              {searchQuery.trim()
                ? t("history.filteredCount", { filtered: filteredRecords.length, total: state.records.length })
                : t("history.recordsCount", { count: state.records.length })}
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
              <Text style={[styles.statsToggleLabel, { color: colors.foreground }]}>{t("history.weekStats", { sport: selectedSportLabel })}</Text>
              <Text style={[styles.statsToggleValue, { color: colors.primary }]}>{weeklyStats.totalDistance.toFixed(1)} km</Text>
            </View>
            <IconSymbol name={showStats ? "chevron.up" : "chevron.down"} size={16} color={colors.muted} />
          </Pressable>
        )}

        {/* 展開的訓練統計詳情 */}
        {showStats && state.records.length > 0 && (
          <View style={[styles.statsDetail, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.statsPeriod}>
              <Text style={[styles.statsPeriodTitle, { color: colors.foreground }]}>{t("history.weekStats", { sport: selectedSportLabel })}</Text>
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={[styles.statLabel, { color: colors.muted }]}>{t("history.totalDistance")}</Text>
                  <Text style={[styles.statValue, { color: colors.primary }]}>{weeklyStats.totalDistance.toFixed(1)} km</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={[styles.statLabel, { color: colors.muted }]}>{t("history.activityCount")}</Text>
                  <Text style={[styles.statValue, { color: colors.foreground }]}>{weeklyStats.rideCount}</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={[styles.statLabel, { color: colors.muted }]}>{usePace ? t("history.averagePace") : t("history.averageSpeed")}</Text>
                  <Text style={[styles.statValue, { color: colors.foreground }]}>{formatPeriodMetric(weeklyStats)}</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={[styles.statLabel, { color: colors.muted }]}>{t("history.elevationGain")}</Text>
                  <Text style={[styles.statValue, { color: colors.foreground }]}>{weeklyStats.totalElevation} m</Text>
                </View>
              </View>
            </View>
            <View style={[styles.statsDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statsPeriod}>
              <Text style={[styles.statsPeriodTitle, { color: colors.foreground }]}>{t("history.monthStats", { sport: selectedSportLabel })}</Text>
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={[styles.statLabel, { color: colors.muted }]}>{t("history.totalDistance")}</Text>
                  <Text style={[styles.statValue, { color: colors.primary }]}>{monthlyStats.totalDistance.toFixed(1)} km</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={[styles.statLabel, { color: colors.muted }]}>{t("history.activityCount")}</Text>
                  <Text style={[styles.statValue, { color: colors.foreground }]}>{monthlyStats.rideCount}</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={[styles.statLabel, { color: colors.muted }]}>{usePace ? t("history.averagePace") : t("history.averageSpeed")}</Text>
                  <Text style={[styles.statValue, { color: colors.foreground }]}>{formatPeriodMetric(monthlyStats)}</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={[styles.statLabel, { color: colors.muted }]}>{t("history.elevationGain")}</Text>
                  <Text style={[styles.statValue, { color: colors.foreground }]}>{monthlyStats.totalElevation} m</Text>
                </View>
              </View>
            </View>
            <View style={[styles.statsDivider, { backgroundColor: colors.border }]} />
            <View style={styles.trainingLogSection}>
              <View style={styles.trainingLogHeader}>
                <Text style={[styles.statsPeriodTitle, { color: colors.foreground }]}>{t("history.trainingLog")}</Text>
                <View style={styles.monthControls}>
                  <Pressable
                    accessibilityLabel={t("history.previousMonth")}
                    onPress={() => setTrainingLogMonth((date) => shiftTrainingLogMonth(date, -1))}
                    style={({ pressed }) => [styles.monthControl, { borderColor: colors.border, opacity: pressed ? 0.6 : 1 }]}
                  >
                    <Text style={[styles.monthArrow, { color: colors.muted }]}>‹</Text>
                  </Pressable>
                  <Text style={[styles.trainingMonthText, { color: colors.foreground }]}>
                    {trainingLogMonth.toLocaleDateString(activeLanguage, { year: "numeric", month: "long" })}
                  </Text>
                  <Pressable
                    accessibilityLabel={t("history.nextMonth")}
                    onPress={() => setTrainingLogMonth((date) => shiftTrainingLogMonth(date, 1))}
                    style={({ pressed }) => [styles.monthControl, { borderColor: colors.border, opacity: pressed ? 0.6 : 1 }]}
                  >
                    <Text style={[styles.monthArrow, { color: colors.muted }]}>›</Text>
                  </Pressable>
                </View>
              </View>
              <Text style={[styles.trainingLogSummaryText, { color: colors.muted }]}>
                {t("history.trainingSummary", { count: selectedMonthStats.rideCount, sport: selectedSportLabel, hours: (selectedMonthStats.totalTime / 3600).toFixed(1), elevation: selectedMonthStats.totalElevation })}
              </Text>
              <View style={styles.weekdayRow}>
                {["一", "二", "三", "四", "五", "六", "日"].map((day) => (
                  <Text key={day} style={[styles.weekdayText, { color: colors.muted }]}>{day}</Text>
                ))}
              </View>
              <View style={styles.calendarGrid}>
                {trainingLog.days.map((day, index) => {
                  const isToday = day && day.date.toDateString() === new Date().toDateString();
                  const isActive = (day?.rideCount ?? 0) > 0;
                  return (
                    <View
                      key={`${trainingLog.year}-${trainingLog.month}-${index}`}
                      style={[
                        styles.calendarDay,
                        { backgroundColor: isActive ? colors.primary + (day!.totalTss > 80 ? "52" : "2D") : colors.background, borderColor: isToday ? colors.primary : colors.border },
                      ]}
                    >
                      {day && <>
                        <Text style={[styles.calendarDayNumber, { color: isActive ? colors.primary : colors.muted }]}>{day.dayNumber}</Text>
                        {isActive && <Text style={[styles.calendarDayData, { color: colors.foreground }]}>{day.totalDistanceKm.toFixed(0)} km</Text>}
                      </>}
                    </View>
                  );
                })}
              </View>
              <Text style={[styles.trainingLogNote, { color: colors.muted }]}>{t("history.trainingNote")}</Text>
            </View>
          </View>
        )}

        {/* 搜索欄 */}
        <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
          <IconSymbol name="magnifyingglass" size={16} color={colors.muted} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground }]}
            placeholder={t("history.searchPlaceholder")}
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
        <View style={styles.sportFilters}>
          {SPORT_FILTERS.map((type) => {
            const selected = sportFilter === type;
            const meta = type === "all" ? null : SPORT_META[type];
            const tint = meta?.accent ?? colors.primary;
            return (
              <Pressable
                key={type}
                style={[styles.sportFilter, { borderColor: selected ? tint : colors.border, backgroundColor: selected ? `${tint}22` : colors.surface }]}
                onPress={() => setSportFilter(type)}
              >
                <Text style={[styles.sportFilterText, { color: selected ? tint : colors.muted }]}>
                  {type === "all" ? t("history.allSports") : `${meta!.icon} ${sportLabel(type)}`}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {state.records.length === 0 ? (
        <View style={styles.emptyState}>
          <IconSymbol name="clock.fill" size={56} color={colors.border} />
          <Text style={[styles.emptyTitle, { color: colors.muted }]}>{t("history.emptyTitle")}</Text>
          <Text style={[styles.emptySubtitle, { color: colors.muted }]}>
            {t("history.emptyDescription")}
          </Text>
        </View>
      ) : filteredRecords.length === 0 ? (
        <View style={styles.emptyState}>
          <IconSymbol name="magnifyingglass" size={48} color={colors.border} />
          <Text style={[styles.emptyTitle, { color: colors.muted }]}>{t("history.noResultsTitle")}</Text>
          <Text style={[styles.emptySubtitle, { color: colors.muted }]}>
            {t("history.noResultsDescription")}
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
  titleRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 6, marginBottom: 12 },
  title: { fontSize: 28, fontWeight: "700", letterSpacing: -0.5 },
  subtitle: { fontSize: 14, fontWeight: "500", flexShrink: 1 },

  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
  },
  sportFilters: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
  sportFilter: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7 },
  sportFilterText: { fontSize: 12, fontWeight: "800" },

  listContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24 },

  recordCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
  },
  routeName: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: -0.2,
    flexShrink: 1,
  },
  dateRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  dateText: { fontSize: 13, fontWeight: "500" },
  timeText: { fontSize: 13, fontWeight: "500" },
  statsRow: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  sportBadge: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  sportBadgeText: { fontSize: 12, fontWeight: "800" },
  statChip: { flexDirection: "row", alignItems: "center", gap: 4 },
  statChipText: { fontSize: 13, fontWeight: "600" },

  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    paddingTop: 8,
    marginTop: 2,
  },
  avgSpeedBox: { flexDirection: "row", alignItems: "baseline", gap: 4 },
  avgSpeed: { fontSize: 22, fontWeight: "800" },
  avgSpeedUnit: { fontSize: 13, fontWeight: "700" },

  footerActions: { flexDirection: "row", alignItems: "center", gap: 10 },
  deleteBtn: { padding: 4 },

  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyTitle: { fontSize: 19, fontWeight: "700" },
  emptySubtitle: { fontSize: 15, textAlign: "center", lineHeight: 23, fontWeight: "500" },

  statsToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  statsToggleContent: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8, flex: 1 },
  statsToggleLabel: { fontSize: 15, fontWeight: "700", flexShrink: 1 },
  statsToggleValue: { fontSize: 15, fontWeight: "800" },

  statsDetail: {
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  statsPeriod: { gap: 8 },
  statsPeriodTitle: { fontSize: 14, fontWeight: "700", flexShrink: 1 },
  statItem: { alignItems: "center", gap: 4, flexGrow: 1, minWidth: 68 },
  statLabel: { fontSize: 13, fontWeight: "600", textAlign: "center" },
  statValue: { fontSize: 15, fontWeight: "800" },
  statsDivider: { height: StyleSheet.hairlineWidth, marginVertical: 8 },
  trainingLogSection: { gap: 8 },
  trainingLogHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 },
  monthControls: { flexDirection: "row", alignItems: "center", gap: 6 },
  monthControl: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
  },
  monthArrow: { fontSize: 20, lineHeight: 22 },
  trainingMonthText: { minWidth: 104, flexShrink: 1, textAlign: "center", fontSize: 13, fontWeight: "700" },
  trainingLogSummaryText: { fontSize: 14, lineHeight: 20, fontWeight: "600" },
  weekdayRow: { flexDirection: "row" },
  weekdayText: { width: "14.2857%", textAlign: "center", fontSize: 13, fontWeight: "800" },
  calendarGrid: { flexDirection: "row", flexWrap: "wrap", gap: 3 },
  calendarDay: {
    width: "13.8%",
    minHeight: 48,
    paddingTop: 6,
    alignItems: "center",
    borderRadius: 7,
    borderWidth: StyleSheet.hairlineWidth,
  },
  calendarDayNumber: { fontSize: 12, fontWeight: "700" },
  calendarDayData: { fontSize: 11, fontWeight: "700", marginTop: 3 },
  trainingLogNote: { fontSize: 13, lineHeight: 19, fontWeight: "500" },
});
