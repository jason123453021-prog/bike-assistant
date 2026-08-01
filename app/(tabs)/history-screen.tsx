/**
 * 歷史紀錄頁面
 * 顯示所有騎乘紀錄、軌跡回放、詳細統計
 */

import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, FlatList, Alert } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { getOfflineManager } from '@/lib/offline/offline-manager';

interface RideRecord {
  id: string;
  name: string;
  distance: number;
  duration: number;
  calories: number;
  startTime: number;
}

export default function HistoryScreen() {
  const colors = useColors();
  const [records, setRecords] = useState<RideRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRecords();
  }, []);

  const loadRecords = async () => {
    try {
      const offlineManager = getOfflineManager();
      const allRecords = offlineManager.getRecords();
      setRecords(
        allRecords.map(r => ({
          id: r.id,
          name: r.name,
          distance: r.distance,
          duration: r.duration,
          calories: r.calories,
          startTime: r.startTime,
        }))
      );
    } catch (error) {
      console.error('Error loading records:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleDateString('zh-TW');
  };

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const handleExportGPX = (recordId: string) => {
    Alert.alert('匯出 GPX', `正在匯出紀錄 ${recordId}...`);
  };

  const handleDeleteRecord = (recordId: string) => {
    Alert.alert('刪除紀錄', '確認刪除此紀錄？', [
      { text: '取消', onPress: () => {} },
      {
        text: '刪除',
        onPress: async () => {
          const offlineManager = getOfflineManager();
          await offlineManager.deleteRecord(recordId);
          loadRecords();
        },
      },
    ]);
  };

  const renderRecord = ({ item }: { item: RideRecord }) => (
    <View className="bg-surface rounded-lg p-4 mb-3 flex-row items-center justify-between">
      <View className="flex-1">
        <Text className="text-foreground font-bold mb-1">{item.name}</Text>
        <Text className="text-muted text-sm mb-2">{formatDate(item.startTime)}</Text>
        <View className="flex-row gap-4">
          <Text className="text-foreground text-sm">
            {item.distance.toFixed(1)} km
          </Text>
          <Text className="text-foreground text-sm">
            {formatTime(item.duration)}
          </Text>
          <Text className="text-foreground text-sm">
            {Math.round(item.calories)} kcal
          </Text>
        </View>
      </View>
      <View className="gap-2">
        <TouchableOpacity
          onPress={() => handleExportGPX(item.id)}
          className="bg-primary px-3 py-2 rounded"
        >
          <Text className="text-background text-xs font-bold">匯出</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => handleDeleteRecord(item.id)}
          className="bg-error px-3 py-2 rounded"
        >
          <Text className="text-background text-xs font-bold">刪除</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <ScreenContainer className="bg-background justify-center items-center">
        <Text className="text-foreground">載入中...</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="bg-background">
      <View className="flex-1">
        <Text className="text-2xl font-bold text-foreground p-4 mb-2">
          騎乘歷史
        </Text>
        {records.length === 0 ? (
          <View className="flex-1 justify-center items-center">
            <Text className="text-muted">還沒有騎乘紀錄</Text>
          </View>
        ) : (
          <FlatList
            data={records}
            renderItem={renderRecord}
            keyExtractor={item => item.id}
            contentContainerStyle={{ padding: 16 }}
            scrollEnabled={true}
          />
        )}
      </View>
    </ScreenContainer>
  );
}
