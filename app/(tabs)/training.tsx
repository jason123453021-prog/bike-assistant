import React from 'react';
import { View, Text } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';

export default function TrainingScreen() {
  return (
    <ScreenContainer className="p-4">
      <Text className="text-2xl font-bold text-foreground mb-4">訓練計劃</Text>
      <View className="bg-surface rounded-lg p-4">
        <Text className="text-foreground">週一: 耐力訓練 60 分鐘</Text>
        <Text className="text-foreground mt-2">週三: 間歇訓練 45 分鐘</Text>
        <Text className="text-foreground mt-2">週五: 爬升訓練 90 分鐘</Text>
      </View>
    </ScreenContainer>
  );
}
