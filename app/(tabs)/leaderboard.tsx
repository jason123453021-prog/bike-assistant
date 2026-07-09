import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';

interface LeaderboardEntry {
  rank: number;
  userId: string;
  userName: string;
  totalDistance: number;
  totalRides: number;
  averageSpeed: number;
  totalCalories: number;
  avatar?: string;
  isCurrentUser?: boolean;
}

export default function LeaderboardScreen() {
  const colors = useColors();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState<'distance' | 'rides' | 'speed'>('distance');
  const [userRank, setUserRank] = useState<number | null>(null);

  useEffect(() => {
    loadLeaderboard();
  }, [selectedTab]);

  const loadLeaderboard = async () => {
    setLoading(true);
    try {
      // 模擬排行榜數據
      const mockData: LeaderboardEntry[] = [
        {
          rank: 1,
          userId: 'user1',
          userName: '騎乘王',
          totalDistance: 5420,
          totalRides: 128,
          averageSpeed: 28.5,
          totalCalories: 125000,
          avatar: '👑',
          isCurrentUser: false,
        },
        {
          rank: 2,
          userId: 'user2',
          userName: '速度獵人',
          totalDistance: 4890,
          totalRides: 115,
          averageSpeed: 32.1,
          totalCalories: 118000,
          avatar: '⚡',
          isCurrentUser: false,
        },
        {
          rank: 3,
          userId: 'user3',
          userName: '耐力戰士',
          totalDistance: 4520,
          totalRides: 142,
          averageSpeed: 26.3,
          totalCalories: 112000,
          avatar: '💪',
          isCurrentUser: true,
        },
        {
          rank: 4,
          userId: 'user4',
          userName: '山地騎手',
          totalDistance: 3980,
          totalRides: 98,
          averageSpeed: 24.7,
          totalCalories: 98000,
          avatar: '🏔️',
          isCurrentUser: false,
        },
        {
          rank: 5,
          userId: 'user5',
          userName: '新手上路',
          totalDistance: 3420,
          totalRides: 76,
          averageSpeed: 22.1,
          totalCalories: 85000,
          avatar: '🚴',
          isCurrentUser: false,
        },
      ];

      // 根據選定的標籤排序
      let sorted = [...mockData];
      if (selectedTab === 'distance') {
        sorted.sort((a, b) => b.totalDistance - a.totalDistance);
      } else if (selectedTab === 'rides') {
        sorted.sort((a, b) => b.totalRides - a.totalRides);
      } else if (selectedTab === 'speed') {
        sorted.sort((a, b) => b.averageSpeed - a.averageSpeed);
      }

      // 更新排名
      sorted = sorted.map((entry, index) => ({
        ...entry,
        rank: index + 1,
      }));

      setLeaderboard(sorted);

      // 找到當前用戶排名
      const currentUserRank = sorted.find((e) => e.isCurrentUser)?.rank;
      setUserRank(currentUserRank || null);
    } catch (error) {
      console.error('Failed to load leaderboard:', error);
      Alert.alert('錯誤', '無法載入排行榜');
    } finally {
      setLoading(false);
    }
  };

  const handleAddFriend = (userName: string) => {
    Alert.alert('添加好友', `確定要添加 ${userName} 為好友嗎？`, [
      { text: '取消', onPress: () => {} },
      {
        text: '添加',
        onPress: () => {
          Alert.alert('成功', `已添加 ${userName} 為好友`);
        },
      },
    ]);
  };

  const formatDistance = (meters: number) => {
    return `${(meters / 1000).toFixed(0)} km`;
  };

  const renderLeaderboardItem = ({ item }: { item: LeaderboardEntry }) => {
    const getMedalEmoji = (rank: number) => {
      if (rank === 1) return '🥇';
      if (rank === 2) return '🥈';
      if (rank === 3) return '🥉';
      return `#${rank}`;
    };

    const getValue = () => {
      if (selectedTab === 'distance') return formatDistance(item.totalDistance);
      if (selectedTab === 'rides') return `${item.totalRides} 次`;
      if (selectedTab === 'speed') return `${item.averageSpeed.toFixed(1)} km/h`;
      return '';
    };

    return (
      <View
        style={[
          styles.leaderboardItem,
          {
            backgroundColor: item.isCurrentUser ? colors.primary + '15' : colors.surface,
            borderColor: item.isCurrentUser ? colors.primary : colors.border,
          },
        ]}
      >
        <View style={styles.rankSection}>
          <Text style={[styles.medal, { color: colors.primary }]}>{getMedalEmoji(item.rank)}</Text>
        </View>

        <View style={styles.userSection}>
          <View style={[styles.avatar, { backgroundColor: colors.primary + '30' }]}>
            <Text style={styles.avatarEmoji}>{item.avatar}</Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={[styles.userName, { color: colors.foreground }]} numberOfLines={1}>
              {item.userName}
              {item.isCurrentUser && <Text style={styles.badge}> (你)</Text>}
            </Text>
            <Text style={[styles.userStats, { color: colors.muted }]}>
              {item.totalRides} 次騎乘 • {formatDistance(item.totalDistance)}
            </Text>
          </View>
        </View>

        <View style={styles.valueSection}>
          <Text style={[styles.value, { color: colors.foreground }]}>{getValue()}</Text>
        </View>

        {!item.isCurrentUser && (
          <TouchableOpacity
            onPress={() => handleAddFriend(item.userName)}
            style={[styles.addButton, { backgroundColor: colors.primary + '20' }]}
          >
            <Text style={[styles.addButtonText, { color: colors.primary }]}>+</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <ScreenContainer className="flex items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="bg-background">
      {/* 標題 */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.foreground }]}>排行榜</Text>
        {userRank && (
          <Text style={[styles.subtitle, { color: colors.muted }]}>
            你的排名：第 {userRank} 名
          </Text>
        )}
      </View>

      {/* 標籤切換 */}
      <View style={[styles.tabContainer, { backgroundColor: colors.surface }]}>
        {(['distance', 'rides', 'speed'] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            onPress={() => setSelectedTab(tab)}
            style={[
              styles.tab,
              selectedTab === tab && {
                borderBottomColor: colors.primary,
                borderBottomWidth: 2,
              },
            ]}
          >
            <Text
              style={[
                styles.tabText,
                {
                  color: selectedTab === tab ? colors.primary : colors.muted,
                  fontWeight: selectedTab === tab ? '600' : '400',
                },
              ]}
            >
              {tab === 'distance' && '距離'}
              {tab === 'rides' && '騎乘次數'}
              {tab === 'speed' && '平均速度'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 排行榜列表 */}
      <FlatList
        data={leaderboard}
        keyExtractor={(item) => item.userId}
        renderItem={renderLeaderboardItem}
        contentContainerStyle={styles.listContent}
        scrollEnabled={true}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: {
    fontSize: 14,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  leaderboardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  rankSection: {
    width: 40,
    alignItems: 'center',
  },
  medal: {
    fontSize: 24,
  },
  userSection: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEmoji: {
    fontSize: 20,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  badge: {
    fontSize: 12,
    fontWeight: '500',
    color: '#0a7ea4',
  },
  userStats: {
    fontSize: 12,
  },
  valueSection: {
    alignItems: 'flex-end',
    minWidth: 80,
  },
  value: {
    fontSize: 16,
    fontWeight: '600',
  },
  addButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    fontSize: 18,
    fontWeight: '600',
  },
});
