import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, Pressable, Image, Alert, ActivityIndicator } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { getFriendSystemManager } from '@/lib/friend-system-manager';
import { type UserAccount } from '@/lib/user-account-manager';

export interface FriendsListScreenProps {
  onFriendSelect?: (friend: UserAccount) => void;
}

/**
 * 好友列表屏幕
 */
export function FriendsListScreen({ onFriendSelect }: FriendsListScreenProps) {
  const [friends, setFriends] = useState<UserAccount[]>([]);
  const [pendingRequests, setPendingRequests] = useState<UserAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'friends' | 'pending'>('friends');

  useEffect(() => {
    loadFriends();
  }, []);

  const loadFriends = async () => {
    try {
      setIsLoading(true);
      const friendManager = getFriendSystemManager();

      const [friendsList, requests] = await Promise.all([
        friendManager.getFriendsList(),
        friendManager.getPendingRequests(),
      ]);

      setFriends(friendsList);
      setPendingRequests(requests);
    } catch (error) {
      Alert.alert('錯誤', '無法加載好友列表');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAcceptRequest = async (friendId: string) => {
    try {
      const friendManager = getFriendSystemManager();
      await friendManager.acceptFriendRequest(friendId);
      Alert.alert('成功', '已接受好友請求');
      await loadFriends();
    } catch (error) {
      Alert.alert('錯誤', '接受請求失敗');
    }
  };

  const handleRejectRequest = async (friendId: string) => {
    try {
      const friendManager = getFriendSystemManager();
      await friendManager.rejectFriendRequest(friendId);
      Alert.alert('成功', '已拒絕好友請求');
      await loadFriends();
    } catch (error) {
      Alert.alert('錯誤', '拒絕請求失敗');
    }
  };

  const handleRemoveFriend = async (friendId: string) => {
    Alert.alert('確認', '確定要移除此好友嗎？', [
      { text: '取消', style: 'cancel' },
      {
        text: '移除',
        style: 'destructive',
        onPress: async () => {
          try {
            const friendManager = getFriendSystemManager();
            await friendManager.removeFriend(friendId);
            Alert.alert('成功', '已移除好友');
            await loadFriends();
          } catch (error) {
            Alert.alert('錯誤', '移除好友失敗');
          }
        },
      },
    ]);
  };

  const renderFriendItem = ({ item }: { item: UserAccount }) => (
    <Pressable
      onPress={() => onFriendSelect?.(item)}
      className="flex-row items-center bg-surface rounded-lg p-4 mb-3 border border-border active:opacity-70"
    >
      {/* 頭像 */}
      <View className="w-12 h-12 rounded-full bg-primary/20 items-center justify-center mr-3">
        <Text className="text-lg">👤</Text>
      </View>

      {/* 用戶信息 */}
      <View className="flex-1">
        <Text className="text-foreground font-bold text-base">{item.username}</Text>
        <Text className="text-muted text-xs">
          騎乘 {item.totalRides} 次 • {(item.totalDistance / 1000).toFixed(1)} km
        </Text>
      </View>

      {/* 移除按鈕 */}
      <Pressable
        onPress={() => handleRemoveFriend(item.id)}
        className="bg-error/20 px-3 py-2 rounded active:opacity-70"
      >
        <Text className="text-error text-xs font-bold">移除</Text>
      </Pressable>
    </Pressable>
  );

  const renderPendingItem = ({ item }: { item: UserAccount }) => (
    <Pressable className="flex-row items-center bg-surface rounded-lg p-4 mb-3 border border-border">
      {/* 頭像 */}
      <View className="w-12 h-12 rounded-full bg-warning/20 items-center justify-center mr-3">
        <Text className="text-lg">👤</Text>
      </View>

      {/* 用戶信息 */}
      <View className="flex-1">
        <Text className="text-foreground font-bold text-base">{item.username}</Text>
        <Text className="text-muted text-xs">待處理的好友請求</Text>
      </View>

      {/* 操作按鈕 */}
      <View className="flex-row gap-2">
        <Pressable
          onPress={() => handleAcceptRequest(item.id)}
          className="bg-success/20 px-3 py-2 rounded active:opacity-70"
        >
          <Text className="text-success text-xs font-bold">接受</Text>
        </Pressable>
        <Pressable
          onPress={() => handleRejectRequest(item.id)}
          className="bg-error/20 px-3 py-2 rounded active:opacity-70"
        >
          <Text className="text-error text-xs font-bold">拒絕</Text>
        </Pressable>
      </View>
    </Pressable>
  );

  if (isLoading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color="#0a7ea4" />
        <Text className="text-muted mt-4">加載中...</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="p-4">
      {/* 標籤欄 */}
      <View className="flex-row gap-2 mb-4">
        <Pressable
          onPress={() => setActiveTab('friends')}
          className={`flex-1 py-3 rounded-lg ${
            activeTab === 'friends'
              ? 'bg-primary'
              : 'bg-surface border border-border'
          }`}
        >
          <Text
            className={`text-center font-bold ${
              activeTab === 'friends' ? 'text-white' : 'text-foreground'
            }`}
          >
            好友 ({friends.length})
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setActiveTab('pending')}
          className={`flex-1 py-3 rounded-lg ${
            activeTab === 'pending'
              ? 'bg-primary'
              : 'bg-surface border border-border'
          }`}
        >
          <Text
            className={`text-center font-bold ${
              activeTab === 'pending' ? 'text-white' : 'text-foreground'
            }`}
          >
            待處理 ({pendingRequests.length})
          </Text>
        </Pressable>
      </View>

      {/* 列表 */}
      {activeTab === 'friends' ? (
        friends.length > 0 ? (
          <FlatList
            data={friends}
            renderItem={renderFriendItem}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
          />
        ) : (
          <View className="items-center justify-center py-8">
            <Text className="text-muted text-lg">還沒有好友</Text>
            <Text className="text-muted text-sm mt-2">
              搜尋並添加好友開始對比騎乘數據
            </Text>
          </View>
        )
      ) : pendingRequests.length > 0 ? (
        <FlatList
          data={pendingRequests}
          renderItem={renderPendingItem}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
        />
      ) : (
        <View className="items-center justify-center py-8">
          <Text className="text-muted text-lg">沒有待處理的請求</Text>
        </View>
      )}
    </ScreenContainer>
  );
}
