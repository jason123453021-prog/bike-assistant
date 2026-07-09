import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { LocalStorageManager } from '@/lib/local-storage-manager';


export default function AnalyticsScreen() {
  const colors = useColors();
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const records = await LocalStorageManager.getAllRideRecords();
      const totalRides = records.length;
      const totalDistance = records.reduce((sum, r) => sum + (r.distance || 0), 0);
      const totalTime = records.reduce((sum, r) => sum + (r.duration || 0), 0) / 3600;
      const averageSpeed = totalDistance / (totalTime || 1);
      
      setAnalytics({
        totalRides,
        totalDistance,
        totalTime: totalTime.toFixed(1),
        averageSpeed,
        monthlyRides: records.filter(r => new Date(r.timestamp).getMonth() === new Date().getMonth()).length,
        weeklyRides: records.filter(r => new Date(r.timestamp).getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000).length,
        longestRide: Math.max(...records.map(r => r.distance || 0), 0),
      });
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <ScreenContainer>
        <View style={[styles.container, { backgroundColor: colors.background }]}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>騎乘分析</Text>

        {analytics && (
          <>
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.cardTitle, { color: colors.foreground }]}>總體統計</Text>
              <View style={styles.statsGrid}>
                <View style={styles.statItem}>
                  <Text style={[styles.statLabel, { color: colors.muted }]}>總騎乘次數</Text>
                  <Text style={[styles.statValue, { color: colors.primary }]}>{analytics.totalRides}</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={[styles.statLabel, { color: colors.muted }]}>總距離</Text>
                  <Text style={[styles.statValue, { color: colors.primary }]}>{analytics.totalDistance.toFixed(1)} km</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={[styles.statLabel, { color: colors.muted }]}>總時間</Text>
                  <Text style={[styles.statValue, { color: colors.primary }]}>{analytics.totalTime}h</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={[styles.statLabel, { color: colors.muted }]}>平均速度</Text>
                  <Text style={[styles.statValue, { color: colors.primary }]}>{analytics.averageSpeed.toFixed(1)} km/h</Text>
                </View>
              </View>
            </View>

            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.cardTitle, { color: colors.foreground }]}>進度趨勢</Text>
              <View style={styles.trendContainer}>
                <Text style={[styles.trendText, { color: colors.muted }]}>
                  本月騎乘: {analytics.monthlyRides} 次
                </Text>
                <Text style={[styles.trendText, { color: colors.muted }]}>
                  本週騎乘: {analytics.weeklyRides} 次
                </Text>
                <Text style={[styles.trendText, { color: colors.muted }]}>
                  最長騎乘: {analytics.longestRide.toFixed(1)} km
                </Text>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 16,
  },
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
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
    justifyContent: 'space-between',
  },
  statItem: {
    width: '48%',
    marginBottom: 12,
  },
  statLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  trendContainer: {
    gap: 8,
  },
  trendText: {
    fontSize: 14,
  },
});
