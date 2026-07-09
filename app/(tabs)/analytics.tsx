import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { LocalStorageManager } from '@/lib/local-storage-manager';

export default function AnalyticsScreen() {
  const colors = useColors();
  const [stats, setStats] = useState({ rides: 0, distance: 0, time: 0 });

  useEffect(() => {
    LocalStorageManager.getAllRideRecords().then(records => {
      setStats({
        rides: records.length,
        distance: records.reduce((s, r) => s + (r.distance || 0), 0),
        time: records.reduce((s, r) => s + (r.duration || 0), 0) / 3600,
      });
    });
  }, []);

  return (
    <ScreenContainer className="p-4">
      <Text className="text-2xl font-bold text-foreground mb-4">騎乘分析</Text>
      <View className="bg-surface rounded-lg p-4">
        <Text className="text-lg font-semibold text-foreground mb-2">總體統計</Text>
        <Text className="text-muted mb-1">騎乘次數: {stats.rides}</Text>
        <Text className="text-muted mb-1">總距離: {stats.distance.toFixed(1)} km</Text>
        <Text className="text-muted">總時間: {stats.time.toFixed(1)} h</Text>
      </View>
    </ScreenContainer>
  );
}
