import React from 'react';
import { View, Text } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';

export default function BuddiesScreen() {
  return (
    <ScreenContainer className="p-4">
      <Text className="text-2xl font-bold text-foreground mb-4">隊友追蹤</Text>
      <View className="bg-surface rounded-lg p-4">
        <Text className="text-foreground">Alice - 正在騎乘 12.5 km</Text>
        <Text className="text-foreground mt-2">Bob - 離線</Text>
        <Text className="text-foreground mt-2">Charlie - 暫停中 8.3 km</Text>
      </View>
    </ScreenContainer>
  );
}
