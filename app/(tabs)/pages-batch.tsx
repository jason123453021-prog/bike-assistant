// 這個文件包含所有新頁面的精簡實現
// 將分別複製到各個頁面文件中

// ============ ANALYTICS PAGE ============
export const AnalyticsPageCode = `
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { LocalStorageManager } from '@/lib/local-storage-manager';

export default function AnalyticsScreen() {
  const colors = useColors();
  const [stats, setStats] = useState({ rides: 0, distance: 0, time: 0 });

  useEffect(() => {
    LocalStorageManager.getAllRideRecords().then(records => {
      setStats({
        rides: records.length,
        distance: records.reduce((s, r) => s + (r.distance || 0), 0),
        time: records.reduce((s, r) => s + (r.duration || 0), 0) / 3600,
      });
    });
  }, []);

  return (
    <ScreenContainer className="p-4">
      <Text className="text-2xl font-bold text-foreground mb-4">騎乘分析</Text>
      <View className="bg-surface rounded-lg p-4 mb-4">
        <Text className="text-lg font-semibold text-foreground mb-2">總體統計</Text>
        <Text className="text-muted mb-1">騎乘次數: {stats.rides}</Text>
        <Text className="text-muted mb-1">總距離: {stats.distance.toFixed(1)} km</Text>
        <Text className="text-muted">總時間: {stats.time.toFixed(1)} h</Text>
      </View>
    </ScreenContainer>
  );
}
`;

// ============ CHALLENGES PAGE ============
export const ChallengesPageCode = `
import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';

export default function ChallengesScreen() {
  const colors = useColors();
  const challenges = [
    { id: 1, name: '本月 100km 挑戰', progress: 65 },
    { id: 2, name: '爬升 2000m 挑戰', progress: 45 },
    { id: 3, name: '連續 7 天騎乘', progress: 3 },
  ];

  return (
    <ScreenContainer className="p-4">
      <Text className="text-2xl font-bold text-foreground mb-4">社群挑戰</Text>
      {challenges.map(c => (
        <View key={c.id} className="bg-surface rounded-lg p-4 mb-3">
          <Text className="text-foreground font-semibold mb-2">{c.name}</Text>
          <View className="bg-border h-2 rounded-full overflow-hidden">
            <View style={{width: \`\${c.progress}%\`, height: '100%', backgroundColor: colors.primary}} />
          </View>
          <Text className="text-muted text-sm mt-2">{c.progress}% 完成</Text>
        </View>
      ))}
    </ScreenContainer>
  );
}
`;

// ============ TRAINING PAGE ============
export const TrainingPageCode = `
import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';

export default function TrainingScreen() {
  const colors = useColors();
  const plans = [
    { day: '週一', type: '耐力訓練', duration: '60 分鐘' },
    { day: '週三', type: '間歇訓練', duration: '45 分鐘' },
    { day: '週五', type: '爬升訓練', duration: '90 分鐘' },
  ];

  return (
    <ScreenContainer className="p-4">
      <Text className="text-2xl font-bold text-foreground mb-4">訓練計劃</Text>
      {plans.map((p, i) => (
        <View key={i} className="bg-surface rounded-lg p-4 mb-3">
          <Text className="text-foreground font-semibold">{p.day}</Text>
          <Text className="text-primary">{p.type}</Text>
          <Text className="text-muted text-sm">{p.duration}</Text>
        </View>
      ))}
    </ScreenContainer>
  );
}
`;

// ============ RECOMMENDATIONS PAGE ============
export const RecommendationsPageCode = `
import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';

export default function RecommendationsScreen() {
  const recommendations = [
    { title: '最佳騎乘時間', desc: '明天 08:00-10:00，溫度舒適' },
    { title: '推薦路線', desc: '郊外環線，距離 45km，難度中等' },
    { title: '體能建議', desc: '今天適合恢復訓練，強度 60-70%' },
  ];

  return (
    <ScreenContainer className="p-4">
      <Text className="text-2xl font-bold text-foreground mb-4">AI 推薦</Text>
      {recommendations.map((r, i) => (
        <View key={i} className="bg-surface rounded-lg p-4 mb-3">
          <Text className="text-foreground font-semibold">{r.title}</Text>
          <Text className="text-muted text-sm mt-1">{r.desc}</Text>
        </View>
      ))}
    </ScreenContainer>
  );
}
`;

// ============ BUDDIES PAGE ============
export const BuddiesPageCode = `
import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';

export default function BuddiesScreen() {
  const colors = useColors();
  const buddies = [
    { id: 1, name: 'Alice', status: '正在騎乘', distance: '12.5 km' },
    { id: 2, name: 'Bob', status: '離線', distance: '離線' },
    { id: 3, name: 'Charlie', status: '暫停中', distance: '8.3 km' },
  ];

  return (
    <ScreenContainer className="p-4">
      <Text className="text-2xl font-bold text-foreground mb-4">隊友追蹤</Text>
      {buddies.map(b => (
        <View key={b.id} className="bg-surface rounded-lg p-4 mb-3 flex-row justify-between items-center">
          <View>
            <Text className="text-foreground font-semibold">{b.name}</Text>
            <Text className="text-muted text-sm">{b.status}</Text>
          </View>
          <Text className="text-primary font-semibold">{b.distance}</Text>
        </View>
      ))}
    </ScreenContainer>
  );
}
`;

// ============ LEADERBOARD PAGE ============
export const LeaderboardPageCode = `
import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';

export default function LeaderboardScreen() {
  const colors = useColors();
  const rankings = [
    { rank: 1, name: 'Alice', distance: 1250, medal: '🥇' },
    { rank: 2, name: 'Bob', distance: 980, medal: '🥈' },
    { rank: 3, name: 'Charlie', distance: 850, medal: '🥉' },
    { rank: 4, name: 'You', distance: 650, medal: '' },
  ];

  return (
    <ScreenContainer className="p-4">
      <Text className="text-2xl font-bold text-foreground mb-4">排行榜</Text>
      {rankings.map(r => (
        <View key={r.rank} className="bg-surface rounded-lg p-4 mb-2 flex-row justify-between items-center">
          <View className="flex-row items-center gap-2">
            <Text className="text-2xl">{r.medal || r.rank}</Text>
            <View>
              <Text className="text-foreground font-semibold">{r.name}</Text>
              <Text className="text-muted text-sm">{r.distance} km</Text>
            </View>
          </View>
        </View>
      ))}
    </ScreenContainer>
  );
}
`;

// ============ NOTIFICATIONS PAGE ============
export const NotificationsPageCode = `
import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';

export default function NotificationsScreen() {
  const colors = useColors();
  const notifications = [
    { id: 1, title: '成就解鎖', desc: '完成 100km 騎乘', time: '2 小時前' },
    { id: 2, title: '隊友上線', desc: 'Alice 開始騎乘', time: '30 分鐘前' },
    { id: 3, title: '天氣警告', desc: '明天有雨，請備好雨具', time: '1 小時前' },
  ];

  return (
    <ScreenContainer className="p-4">
      <Text className="text-2xl font-bold text-foreground mb-4">通知中心</Text>
      {notifications.map(n => (
        <View key={n.id} className="bg-surface rounded-lg p-4 mb-3">
          <View className="flex-row justify-between items-start">
            <View className="flex-1">
              <Text className="text-foreground font-semibold">{n.title}</Text>
              <Text className="text-muted text-sm mt-1">{n.desc}</Text>
            </View>
            <Text className="text-muted text-xs">{n.time}</Text>
          </View>
        </View>
      ))}
    </ScreenContainer>
  );
}
`;
