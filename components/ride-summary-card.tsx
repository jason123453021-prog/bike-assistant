import React, { useState } from 'react';
import { View, Text, Pressable, Share, Platform, ScrollView } from 'react-native';
import { type RideStatistics } from '@/lib/ride-statistics-manager';
import { CustomElevationChart } from '@/components/custom-elevation-chart';

export interface RideSummaryCardProps {
  statistics: RideStatistics;
  onShare?: (statistics: RideStatistics) => void;
  onClose?: () => void;
  className?: string;
}

/**
 * 騎乘統計摘要卡片
 * 顯示騎乘距離、時間、速度等統計信息
 * 包含互動式海拔高度變化圖表
 */
export function RideSummaryCard({
  statistics,
  onShare,
  onClose,
  className,
}: RideSummaryCardProps) {
  const [showChart, setShowChart] = useState(false);

  const formatDistance = (meters: number): string => {
    if (meters < 1000) {
      return `${Math.round(meters)} m`;
    }
    return `${(meters / 1000).toFixed(2)} km`;
  };

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    }
    return `${minutes}m ${secs}s`;
  };

  const formatSpeed = (kmh: number): string => {
    return `${kmh.toFixed(1)} km/h`;
  };

  const formatElevation = (meters: number): string => {
    return `${Math.round(meters)} m`;
  };

  const handleShare = async () => {
    if (onShare) {
      onShare(statistics);
      return;
    }

    try {
      const message = `🚴 騎乘統計\n\n距離: ${formatDistance(statistics.totalDistance)}\n時間: ${formatTime(statistics.totalTime)}\n平均速度: ${formatSpeed(statistics.averageSpeed)}\n最高速度: ${formatSpeed(statistics.maxSpeed)}\n爬升: ${formatElevation(statistics.totalElevationGain)}\n\n#自行車 #騎乘`;

      if (Platform.OS === 'web') {
        // 網頁版本 - 複製到剪貼板
        navigator.clipboard.writeText(message);
        alert('已複製到剪貼板');
      } else {
        // 移動設備 - 使用原生分享
        await Share.share({
          message,
          title: '騎乘統計',
        });
      }
    } catch (error) {
      console.error('[RideSummaryCard] Error sharing:', error);
    }
  };

  const startTime = new Date(statistics.startTime);
  const endTime = new Date(statistics.endTime);

  return (
    <ScrollView className={`${className || ''}`}>
      <View className="bg-gradient-to-br from-primary to-primary/80 rounded-3xl p-6 shadow-lg mb-4">
        {/* 標題 */}
        <View className="flex-row justify-between items-center mb-6">
          <Text className="text-2xl font-bold text-white">騎乘完成！</Text>
          {onClose && (
            <Pressable onPress={onClose} className="active:opacity-70">
              <Text className="text-white text-2xl">✕</Text>
            </Pressable>
          )}
        </View>

        {/* 路線名稱 */}
        {statistics.routeName && (
          <Text className="text-lg font-semibold text-white/90 mb-4">
            {statistics.routeName}
          </Text>
        )}

        {/* 主要統計 */}
        <View className="bg-white/10 rounded-2xl p-4 mb-4 backdrop-blur">
          {/* 距離和時間 */}
          <View className="flex-row gap-4 mb-4">
            <View className="flex-1">
              <Text className="text-white/70 text-sm mb-1">總距離</Text>
              <Text className="text-3xl font-bold text-white">
                {(statistics.totalDistance / 1000).toFixed(2)}
              </Text>
              <Text className="text-white/70 text-xs">km</Text>
            </View>

            <View className="flex-1">
              <Text className="text-white/70 text-sm mb-1">總時間</Text>
              <Text className="text-3xl font-bold text-white">
                {Math.floor(statistics.totalTime / 60)}
              </Text>
              <Text className="text-white/70 text-xs">分鐘</Text>
            </View>

            <View className="flex-1">
              <Text className="text-white/70 text-sm mb-1">平均速度</Text>
              <Text className="text-3xl font-bold text-white">
                {statistics.averageSpeed.toFixed(1)}
              </Text>
              <Text className="text-white/70 text-xs">km/h</Text>
            </View>
          </View>

          {/* 分隔線 */}
          <View className="h-px bg-white/20 mb-4" />

          {/* 詳細統計 */}
          <View className="gap-2">
            <View className="flex-row justify-between">
              <Text className="text-white/70 text-sm">最高速度</Text>
              <Text className="text-white font-semibold">
                {statistics.maxSpeed.toFixed(1)} km/h
              </Text>
            </View>

            <View className="flex-row justify-between">
              <Text className="text-white/70 text-sm">爬升</Text>
              <Text className="text-white font-semibold">
                {Math.round(statistics.totalElevationGain)} m
              </Text>
            </View>

            <View className="flex-row justify-between">
              <Text className="text-white/70 text-sm">下降</Text>
              <Text className="text-white font-semibold">
                {Math.round(statistics.totalElevationLoss)} m
              </Text>
            </View>

            {statistics.calories && (
              <View className="flex-row justify-between">
                <Text className="text-white/70 text-sm">卡路里</Text>
                <Text className="text-white font-semibold">
                  {Math.round(statistics.calories)} kcal
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* 時間信息 */}
        <View className="bg-white/5 rounded-lg p-3 mb-4">
          <Text className="text-white/60 text-xs">
            {startTime.toLocaleString('zh-TW')} - {endTime.toLocaleTimeString('zh-TW')}
          </Text>
        </View>

        {/* 海拔圖表按鈕 */}
        <Pressable
          onPress={() => setShowChart(!showChart)}
          className="bg-white/20 px-4 py-3 rounded-lg active:opacity-70 mb-4"
        >
          <Text className="text-white text-center font-semibold">
            {showChart ? '隱藏' : '查看'}海拔高度變化
          </Text>
        </Pressable>

        {/* 操作按鈕 */}
        <View className="flex-row gap-3">
          <Pressable
            onPress={handleShare}
            className="flex-1 bg-white px-4 py-3 rounded-lg active:opacity-70"
          >
            <Text className="text-primary text-center font-semibold">分享成績</Text>
          </Pressable>

          {onClose && (
            <Pressable
              onPress={onClose}
              className="flex-1 bg-white/20 px-4 py-3 rounded-lg active:opacity-70"
            >
              <Text className="text-white text-center font-semibold">完成</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* 海拔高度變化圖表 */}
      {showChart && (
        <View className="px-4 pb-4">
          <CustomElevationChart statistics={statistics} height={300} />
        </View>
      )}
    </ScrollView>
  );
}
