import React from 'react';
import { View, Text } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';

export default function RecommendationsScreen() {
  return (
    <ScreenContainer className="p-4">
      <Text className="text-2xl font-bold text-foreground mb-4">AI 推薦</Text>
      <View className="bg-surface rounded-lg p-4">
        <Text className="text-foreground font-semibold">最佳騎乘時間</Text>
        <Text className="text-muted text-sm">明天 08:00-10:00，溫度舒適</Text>
        <Text className="text-foreground font-semibold mt-3">推薦路線</Text>
        <Text className="text-muted text-sm">郊外環線，45km，難度中等</Text>
      </View>
    </ScreenContainer>
  );
}
