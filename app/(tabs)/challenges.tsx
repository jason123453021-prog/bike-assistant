import React from 'react';
import { View, Text } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';

export default function ChallengesScreen() {
  return (
    <ScreenContainer className="p-4">
      <Text className="text-2xl font-bold text-foreground mb-4">社群挑戰</Text>
      <View className="bg-surface rounded-lg p-4">
        <Text className="text-foreground">本月 100km 挑戰 - 65% 完成</Text>
        <Text className="text-foreground mt-2">爬升 2000m 挑戰 - 45% 完成</Text>
      </View>
    </ScreenContainer>
  );
}
