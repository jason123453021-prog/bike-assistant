import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, FlatList, ActivityIndicator } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { getRideStatisticsManager, type RideStatistics, type RideHistory } from '@/lib/ride-statistics-manager';
import { getSocialShareManager } from '@/lib/social-share-manager';

/**
 * 騎乘歷史屏幕
 * 顯示所有騎乘記錄和統計
 */
export function RideHistoryScreen() {
  const [history, setHistory] = useState<RideHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedRide, setSelectedRide] = useState<RideStatistics | null>(null);

  useEffect(() => {
    loadRideHistory();
  }, []);

  const loadRideHistory = async () => {
    try {
      setLoading(true);
      const manager = getRideStatisticsManager();
      const data = await manager.getRideHistory();
      setHistory(data);
    } catch (error) {
      console.error('[RideHistoryScreen] Error loading history:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async (ride: RideStatistics) => {
    try {
      const shareManager = getSocialShareManager();
      await shareManager.shareToSocial(ride, { platform: 'generic' });
    } catch (error) {
      console.error('[RideHistoryScreen] Error sharing:', error);
    }
  };

  const handleDelete = async (rideId: string) => {
    try {
      const manager = getRideStatisticsManager();
      await manager.deleteRideStatistics(rideId);
      await loadRideHistory();
    } catch (error) {
      console.error('[RideHistoryScreen] Error deleting ride:', error);
    }
  };

  const formatDistance = (meters: number): string => {
    return `${(meters / 1000).toFixed(2)} km`;
  };

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const formatSpeed = (kmh: number): string => {
    return `${kmh.toFixed(1)} km/h`;
  };

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('zh-TW', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color="#0a7ea4" />
      </ScreenContainer>
    );
  }

  if (!history || history.rides.length === 0) {
    return (
      <ScreenContainer className="items-center justify-center p-4">
        <Text className="text-foreground text-lg font-semibold mb-2">還沒有騎乘記錄</Text>
        <Text className="text-muted text-center">開始一次騎乘冒險吧！</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="p-4">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        {/* 標題 */}
        <Text className="text-2xl font-bold text-foreground mb-2">騎乘歷史</Text>

        {/* 總統計卡片 */}
        <View className="bg-surface rounded-2xl p-4 mb-6 border border-border">
          <Text className="text-lg font-semibold text-foreground mb-4">總統計</Text>

          <View className="gap-3">
            <View className="flex-row justify-between">
              <Text className="text-muted">總騎乘次數</Text>
              <Text className="text-foreground font-semibold">{history.totalRides}</Text>
            </View>

            <View className="flex-row justify-between">
              <Text className="text-muted">總距離</Text>
              <Text className="text-foreground font-semibold">
                {formatDistance(history.totalDistance)}
              </Text>
            </View>

            <View className="flex-row justify-between">
              <Text className="text-muted">總時間</Text>
              <Text className="text-foreground font-semibold">
                {formatTime(history.totalTime)}
              </Text>
            </View>

            <View className="flex-row justify-between">
              <Text className="text-muted">平均速度</Text>
              <Text className="text-foreground font-semibold">
                {formatSpeed(history.averageSpeed)}
              </Text>
            </View>
          </View>
        </View>

        {/* 騎乘記錄列表 */}
        <Text className="text-lg font-semibold text-foreground mb-3">最近騎乘</Text>

        <FlatList
          data={history.rides.sort((a, b) => b.timestamp - a.timestamp)}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          renderItem={({ item: ride }) => (
            <Pressable
              onPress={() => setSelectedRide(ride)}
              className="bg-surface rounded-xl p-4 mb-3 border border-border active:opacity-70"
            >
              {/* 標題和日期 */}
              <View className="flex-row justify-between items-start mb-3">
                <View className="flex-1">
                  <Text className="text-foreground font-semibold text-base">
                    {ride.routeName || '騎乘'}
                  </Text>
                  <Text className="text-muted text-xs mt-1">
                    {formatDate(ride.timestamp)}
                  </Text>
                </View>
                <Text className="text-primary font-bold text-lg">
                  {formatDistance(ride.totalDistance)}
                </Text>
              </View>

              {/* 統計信息 */}
              <View className="flex-row gap-4 mb-3">
                <View className="flex-1">
                  <Text className="text-muted text-xs mb-1">時間</Text>
                  <Text className="text-foreground font-semibold">
                    {formatTime(ride.totalTime)}
                  </Text>
                </View>

                <View className="flex-1">
                  <Text className="text-muted text-xs mb-1">平均速度</Text>
                  <Text className="text-foreground font-semibold">
                    {formatSpeed(ride.averageSpeed)}
                  </Text>
                </View>

                <View className="flex-1">
                  <Text className="text-muted text-xs mb-1">爬升</Text>
                  <Text className="text-foreground font-semibold">
                    {Math.round(ride.totalElevationGain)} m
                  </Text>
                </View>
              </View>

              {/* 操作按鈕 */}
              <View className="flex-row gap-2">
                <Pressable
                  onPress={() => handleShare(ride)}
                  className="flex-1 bg-primary/10 px-3 py-2 rounded active:opacity-70"
                >
                  <Text className="text-primary text-center text-xs font-semibold">分享</Text>
                </Pressable>

                <Pressable
                  onPress={() => handleDelete(ride.id)}
                  className="flex-1 bg-error/10 px-3 py-2 rounded active:opacity-70"
                >
                  <Text className="text-error text-center text-xs font-semibold">刪除</Text>
                </Pressable>
              </View>
            </Pressable>
          )}
        />

        {/* 詳細視圖 */}
        {selectedRide && (
          <View className="bg-surface rounded-2xl p-4 mt-6 border border-border">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-lg font-semibold text-foreground">詳細信息</Text>
              <Pressable onPress={() => setSelectedRide(null)}>
                <Text className="text-foreground text-xl">✕</Text>
              </Pressable>
            </View>

            <View className="gap-3">
              <View className="flex-row justify-between">
                <Text className="text-muted">距離</Text>
                <Text className="text-foreground font-semibold">
                  {formatDistance(selectedRide.totalDistance)}
                </Text>
              </View>

              <View className="flex-row justify-between">
                <Text className="text-muted">時間</Text>
                <Text className="text-foreground font-semibold">
                  {formatTime(selectedRide.totalTime)}
                </Text>
              </View>

              <View className="flex-row justify-between">
                <Text className="text-muted">平均速度</Text>
                <Text className="text-foreground font-semibold">
                  {formatSpeed(selectedRide.averageSpeed)}
                </Text>
              </View>

              <View className="flex-row justify-between">
                <Text className="text-muted">最高速度</Text>
                <Text className="text-foreground font-semibold">
                  {formatSpeed(selectedRide.maxSpeed)}
                </Text>
              </View>

              <View className="flex-row justify-between">
                <Text className="text-muted">爬升</Text>
                <Text className="text-foreground font-semibold">
                  {Math.round(selectedRide.totalElevationGain)} m
                </Text>
              </View>

              <View className="flex-row justify-between">
                <Text className="text-muted">下降</Text>
                <Text className="text-foreground font-semibold">
                  {Math.round(selectedRide.totalElevationLoss)} m
                </Text>
              </View>
            </View>

            <Pressable
              onPress={() => handleShare(selectedRide)}
              className="bg-primary px-4 py-3 rounded-lg mt-4 active:opacity-70"
            >
              <Text className="text-white text-center font-semibold">分享此騎乘</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
