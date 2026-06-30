import React, { useEffect, useState } from 'react';
import { View, ScrollView, Pressable, Text } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { RideSummaryCard } from '@/components/ride-summary-card';
import { getRideStatisticsManager, type RideStatistics } from '@/lib/ride-statistics-manager';
import { getSocialShareManager } from '@/lib/social-share-manager';

export interface RideCompletionScreenProps {
  onClose?: () => void;
  onViewHistory?: () => void;
  className?: string;
}

/**
 * 騎乘完成屏幕
 * 顯示騎乘統計摘要和分享選項
 */
export function RideCompletionScreen({
  onClose,
  onViewHistory,
  className,
}: RideCompletionScreenProps) {
  const [statistics, setStatistics] = useState<RideStatistics | null>(null);
  const [shareLoading, setShareLoading] = useState(false);

  useEffect(() => {
    loadStatistics();
  }, []);

  const loadStatistics = async () => {
    try {
      // 在實際應用中，這應該從導航完成事件中獲取
      // 這裡只是示例
      const manager = getRideStatisticsManager();
      const history = await manager.getRideHistory();
      if (history.rides.length > 0) {
        setStatistics(history.rides[history.rides.length - 1]);
      }
    } catch (error) {
      console.error('[RideCompletionScreen] Error loading statistics:', error);
    }
  };

  const handleShare = async (platform: 'instagram' | 'facebook' | 'strava' | 'twitter' | 'generic') => {
    if (!statistics) return;

    try {
      setShareLoading(true);
      const shareManager = getSocialShareManager();
      await shareManager.shareToSocial(statistics, { platform });
    } catch (error) {
      console.error('[RideCompletionScreen] Error sharing:', error);
    } finally {
      setShareLoading(false);
    }
  };

  if (!statistics) {
    return (
      <ScreenContainer className="items-center justify-center">
        <Text className="text-foreground">加載中...</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className={`p-4 ${className || ''}`}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        {/* 騎乘統計卡片 */}
        <RideSummaryCard
          statistics={statistics}
          onShare={() => handleShare('generic')}
          onClose={onClose}
          className="mb-6"
        />

        {/* 社交分享選項 */}
        <View className="bg-surface rounded-2xl p-4 border border-border mb-6">
          <Text className="text-lg font-semibold text-foreground mb-4">分享到社交媒體</Text>

          <View className="gap-2">
            <Pressable
              onPress={() => handleShare('instagram')}
              disabled={shareLoading}
              className="flex-row items-center bg-gradient-to-r from-pink-500 to-rose-500 px-4 py-3 rounded-lg active:opacity-70"
            >
              <Text className="text-white font-semibold flex-1">📸 分享到 Instagram</Text>
              {shareLoading && <Text className="text-white">...</Text>}
            </Pressable>

            <Pressable
              onPress={() => handleShare('facebook')}
              disabled={shareLoading}
              className="flex-row items-center bg-blue-600 px-4 py-3 rounded-lg active:opacity-70"
            >
              <Text className="text-white font-semibold flex-1">👍 分享到 Facebook</Text>
              {shareLoading && <Text className="text-white">...</Text>}
            </Pressable>

            <Pressable
              onPress={() => handleShare('strava')}
              disabled={shareLoading}
              className="flex-row items-center bg-orange-500 px-4 py-3 rounded-lg active:opacity-70"
            >
              <Text className="text-white font-semibold flex-1">🏃 分享到 Strava</Text>
              {shareLoading && <Text className="text-white">...</Text>}
            </Pressable>

            <Pressable
              onPress={() => handleShare('twitter')}
              disabled={shareLoading}
              className="flex-row items-center bg-blue-400 px-4 py-3 rounded-lg active:opacity-70"
            >
              <Text className="text-white font-semibold flex-1">𝕏 分享到 Twitter</Text>
              {shareLoading && <Text className="text-white">...</Text>}
            </Pressable>
          </View>
        </View>

        {/* 其他選項 */}
        <View className="gap-3">
          {onViewHistory && (
            <Pressable
              onPress={onViewHistory}
              className="bg-primary/10 px-4 py-3 rounded-lg active:opacity-70"
            >
              <Text className="text-primary text-center font-semibold">查看騎乘歷史</Text>
            </Pressable>
          )}

          {onClose && (
            <Pressable
              onPress={onClose}
              className="bg-muted/10 px-4 py-3 rounded-lg active:opacity-70"
            >
              <Text className="text-muted text-center font-semibold">返回首頁</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
