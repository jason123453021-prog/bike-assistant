import React from 'react';
import { View, Text } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';

export default function NotificationsScreen() {
  return (
    <ScreenContainer className="p-4">
      <Text className="text-2xl font-bold text-foreground mb-4">通知中心</Text>
      <View className="bg-surface rounded-lg p-4">
        <Text className="text-foreground font-semibold">成就解鎖</Text>
        <Text className="text-muted text-sm">完成 100km 騎乘 - 2 小時前</Text>
        <Text className="text-foreground font-semibold mt-3">隊友上線</Text>
        <Text className="text-muted text-sm">Alice 開始騎乘 - 30 分鐘前</Text>
      </View>
    </ScreenContainer>
  );
}
