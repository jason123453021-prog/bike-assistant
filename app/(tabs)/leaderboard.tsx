import React from 'react';
import { View, Text } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';

export default function LeaderboardScreen() {
  return (
    <ScreenContainer className="p-4">
      <Text className="text-2xl font-bold text-foreground mb-4">排行榜</Text>
      <View className="bg-surface rounded-lg p-4">
        <Text className="text-foreground">🥇 Alice - 1250 km</Text>
        <Text className="text-foreground mt-2">🥈 Bob - 980 km</Text>
        <Text className="text-foreground mt-2">🥉 Charlie - 850 km</Text>
        <Text className="text-primary mt-2">4️⃣ You - 650 km</Text>
      </View>
    </ScreenContainer>
  );
}
