import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { RideAnalyticsDashboard, AnalyticsSummary, ProgressComparison } from '@/lib/ride-analytics-dashboard';

const { width } = Dimensions.get('window');

export default function AnalyticsScreen() {
  const colors = useColors();
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [comparison, setComparison] = useState<ProgressComparison | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'week' | 'month' | 'year'>('month');

  useEffect(() => {
    loadAnalytics();
  }, [period]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const summaryData = await RideAnalyticsDashboard.getAnalyticsSummary(
        period === 'week' ? 7 : period === 'month' ? 30 : 365
      );
      setSummary(summaryData);

      const comparisonData = await RideAnalyticsDashboard.getProgressComparison(period);
      setComparison(comparisonData);
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num: number, decimals: number = 1) => {
    return num.toFixed(decimals);
  };

  const getChangeColor = (change: number) => {
    if (change > 0) return colors.success;
    if (change < 0) return colors.error;
    return colors.muted;
  };

  const getChangeIcon = (change: number) => {
    if (change > 0) return '↑';
    if (change < 0) return '↓';
    return '→';
  };

  if (loading) {
    return (
      <ScreenContainer className="flex items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="bg-background">
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* 標題 */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.foreground }]}>騎乘分析</Text>
        </View>

        {/* 時期選擇 */}
        <View style={styles.periodSelector}>
          {(['week', 'month', 'year'] as const).map((p) => (
            <TouchableOpacity
              key={p}
              onPress={() => setPeriod(p)}
              style={[
                styles.periodButton,
                {
                  backgroundColor: period === p ? colors.primary : colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.periodButtonText,
                  {
                    color: period === p ? '#fff' : colors.foreground,
                    fontWeight: period === p ? '600' : '400',
                  },
                ]}
              >
                {p === 'week' ? '週' : p === 'month' ? '月' : '年'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 主要指標 */}
        {summary && (
          <>
            {/* 騎乘統計 */}
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.cardTitle, { color: colors.foreground }]}>騎乘統計</Text>

              <View style={styles.statsGrid}>
                <View style={styles.statBox}>
                  <Text style={[styles.statValue, { color: colors.primary }]}>
                    {summary.totalRides}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.muted }]}>騎乘次數</Text>
                </View>

                <View style={styles.statBox}>
                  <Text style={[styles.statValue, { color: colors.primary }]}>
                    {formatNumber(summary.totalDistance)} km
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.muted }]}>總距離</Text>
                </View>

                <View style={styles.statBox}>
                  <Text style={[styles.statValue, { color: colors.primary }]}>
                    {Math.round(summary.totalTime / 3600)}h
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.muted }]}>總時間</Text>
                </View>

                <View style={styles.statBox}>
                  <Text style={[styles.statValue, { color: colors.primary }]}>
                    {formatNumber(summary.totalElevation / 1000)} km
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.muted }]}>總爬升</Text>
                </View>
              </View>
            </View>

            {/* 平均數據 */}
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.cardTitle, { color: colors.foreground }]}>平均數據</Text>

              <View style={styles.dataRow}>
                <View style={styles.dataItem}>
                  <Text style={[styles.dataLabel, { color: colors.muted }]}>平均速度</Text>
                  <Text style={[styles.dataValue, { color: colors.foreground }]}>
                    {formatNumber(summary.averageSpeed)} km/h
                  </Text>
                </View>
                <View style={styles.dataItem}>
                  <Text style={[styles.dataLabel, { color: colors.muted }]}>平均功率</Text>
                  <Text style={[styles.dataValue, { color: colors.foreground }]}>
                    {formatNumber(summary.averagePower)} W
                  </Text>
                </View>
              </View>

              <View style={styles.dataRow}>
                <View style={styles.dataItem}>
                  <Text style={[styles.dataLabel, { color: colors.muted }]}>平均心率</Text>
                  <Text style={[styles.dataValue, { color: colors.foreground }]}>
                    {formatNumber(summary.averageHeartRate)} bpm
                  </Text>
                </View>
                <View style={styles.dataItem}>
                  <Text style={[styles.dataLabel, { color: colors.muted }]}>平均距離</Text>
                  <Text style={[styles.dataValue, { color: colors.foreground }]}>
                    {formatNumber(summary.averageDistance)} km
                  </Text>
                </View>
              </View>
            </View>

            {/* 進度對比 */}
            {comparison && (
              <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.cardTitle, { color: colors.foreground }]}>進度對比</Text>

                <View style={styles.comparisonRow}>
                  <View style={styles.comparisonItem}>
                    <Text style={[styles.comparisonLabel, { color: colors.muted }]}>距離</Text>
                    <View style={styles.comparisonValue}>
                      <Text style={[styles.comparisonNumber, { color: colors.foreground }]}>
                        {formatNumber(comparison.changePercentage.distance)}%
                      </Text>
                      <Text
                        style={[
                          styles.comparisonChange,
                          { color: getChangeColor(comparison.changePercentage.distance) },
                        ]}
                      >
                        {getChangeIcon(comparison.changePercentage.distance)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.comparisonItem}>
                    <Text style={[styles.comparisonLabel, { color: colors.muted }]}>速度</Text>
                    <View style={styles.comparisonValue}>
                      <Text style={[styles.comparisonNumber, { color: colors.foreground }]}>
                        {formatNumber(comparison.changePercentage.speed)}%
                      </Text>
                      <Text
                        style={[
                          styles.comparisonChange,
                          { color: getChangeColor(comparison.changePercentage.speed) },
                        ]}
                      >
                        {getChangeIcon(comparison.changePercentage.speed)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.comparisonItem}>
                    <Text style={[styles.comparisonLabel, { color: colors.muted }]}>功率</Text>
                    <View style={styles.comparisonValue}>
                      <Text style={[styles.comparisonNumber, { color: colors.foreground }]}>
                        {formatNumber(comparison.changePercentage.power)}%
                      </Text>
                      <Text
                        style={[
                          styles.comparisonChange,
                          { color: getChangeColor(comparison.changePercentage.power) },
                        ]}
                      >
                        {getChangeIcon(comparison.changePercentage.power)}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            )}

            {/* 最佳騎乘 */}
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.cardTitle, { color: colors.foreground }]}>最佳騎乘</Text>

              {summary.longestRide && (
                <View style={styles.bestRideItem}>
                  <Text style={[styles.bestRideLabel, { color: colors.muted }]}>最長騎乘</Text>
                  <Text style={[styles.bestRideValue, { color: colors.foreground }]}>
                    {formatNumber(summary.longestRide.distance)} km
                  </Text>
                </View>
              )}

              {summary.fastestRide && (
                <View style={styles.bestRideItem}>
                  <Text style={[styles.bestRideLabel, { color: colors.muted }]}>最快騎乘</Text>
                  <Text style={[styles.bestRideValue, { color: colors.foreground }]}>
                    {formatNumber(summary.fastestRide.maxSpeed)} km/h
                  </Text>
                </View>
              )}

              {summary.hardestRide && (
                <View style={styles.bestRideItem}>
                  <Text style={[styles.bestRideLabel, { color: colors.muted }]}>最難騎乘</Text>
                  <Text style={[styles.bestRideValue, { color: colors.foreground }]}>
                    {formatNumber(summary.hardestRide.tss)} TSS
                  </Text>
                </View>
              )}
            </View>

            {/* 能量消耗 */}
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.cardTitle, { color: colors.foreground }]}>能量消耗</Text>

              <View style={styles.energyRow}>
                <View style={styles.energyItem}>
                  <Text style={[styles.energyValue, { color: colors.primary }]}>
                    {summary.totalCalories}
                  </Text>
                  <Text style={[styles.energyLabel, { color: colors.muted }]}>卡路里</Text>
                </View>

                <View style={styles.energyItem}>
                  <Text style={[styles.energyValue, { color: colors.primary }]}>
                    {formatNumber(summary.totalTSS)}
                  </Text>
                  <Text style={[styles.energyLabel, { color: colors.muted }]}>TSS</Text>
                </View>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  periodSelector: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 8,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  periodButtonText: {
    fontSize: 13,
  },
  card: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statBox: {
    width: '48%',
    paddingVertical: 12,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: 8,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
  },
  dataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  dataItem: {
    flex: 1,
    paddingVertical: 8,
  },
  dataLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  dataValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  comparisonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  comparisonItem: {
    alignItems: 'center',
  },
  comparisonLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  comparisonValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  comparisonNumber: {
    fontSize: 14,
    fontWeight: '600',
  },
  comparisonChange: {
    fontSize: 16,
    fontWeight: '600',
  },
  bestRideItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  bestRideLabel: {
    fontSize: 13,
  },
  bestRideValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  energyRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  energyItem: {
    alignItems: 'center',
  },
  energyValue: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  energyLabel: {
    fontSize: 12,
  },
});
