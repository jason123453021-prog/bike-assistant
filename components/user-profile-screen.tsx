import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { getUserAccountManager, type UserAccount } from '@/lib/user-account-manager';

export interface UserProfileScreenProps {
  onLogout?: () => void;
}

/**
 * 用戶資料屏幕
 */
export function UserProfileScreen({ onLogout }: UserProfileScreenProps) {
  const [user, setUser] = useState<UserAccount | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadUserProfile();
  }, []);

  const loadUserProfile = async () => {
    try {
      setIsLoading(true);
      const userManager = getUserAccountManager();
      const currentUser = userManager.getCurrentUser();

      if (currentUser) {
        setUser(currentUser);
      }
    } catch (error) {
      Alert.alert('錯誤', '無法加載用戶資料');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('確認', '確定要登出嗎？', [
      { text: '取消', style: 'cancel' },
      {
        text: '登出',
        style: 'destructive',
        onPress: async () => {
          try {
            const userManager = getUserAccountManager();
            await userManager.logout();
            onLogout?.();
          } catch (error) {
            Alert.alert('錯誤', '登出失敗');
          }
        },
      },
    ]);
  };

  if (isLoading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color="#0a7ea4" />
        <Text className="text-muted mt-4">加載中...</Text>
      </ScreenContainer>
    );
  }

  if (!user) {
    return (
      <ScreenContainer className="items-center justify-center">
        <Text className="text-muted text-lg">未登入</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="p-4">
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* 用戶頭像和基本信息 */}
        <View className="items-center mb-6">
          <View className="w-24 h-24 rounded-full bg-primary/20 items-center justify-center mb-4">
            <Text className="text-5xl">👤</Text>
          </View>

          <Text className="text-2xl font-bold text-foreground">{user.username}</Text>
          <Text className="text-muted text-sm mt-1">{user.email}</Text>

          {user.bio && (
            <Text className="text-muted text-sm mt-2 text-center">{user.bio}</Text>
          )}
        </View>

        {/* 統計信息 */}
        <View className="grid grid-cols-2 gap-3 mb-6">
          <View className="bg-surface rounded-lg p-4 border border-border items-center">
            <Text className="text-muted text-xs mb-2">總騎乘次數</Text>
            <Text className="text-foreground font-bold text-2xl">
              {user.totalRides}
            </Text>
          </View>

          <View className="bg-surface rounded-lg p-4 border border-border items-center">
            <Text className="text-muted text-xs mb-2">總距離</Text>
            <Text className="text-foreground font-bold text-2xl">
              {(user.totalDistance / 1000).toFixed(0)} km
            </Text>
          </View>

          <View className="bg-surface rounded-lg p-4 border border-border items-center">
            <Text className="text-muted text-xs mb-2">總爬升</Text>
            <Text className="text-foreground font-bold text-2xl">
              {(user.totalElevationGain / 1000).toFixed(1)} km
            </Text>
          </View>

          <View className="bg-surface rounded-lg p-4 border border-border items-center">
            <Text className="text-muted text-xs mb-2">總時間</Text>
            <Text className="text-foreground font-bold text-2xl">
              {(user.totalTime / 3600).toFixed(0)} h
            </Text>
          </View>
        </View>

        {/* 社交信息 */}
        <View className="flex-row gap-3 mb-6">
          <View className="flex-1 bg-surface rounded-lg p-4 border border-border items-center">
            <Text className="text-muted text-xs mb-2">粉絲</Text>
            <Text className="text-foreground font-bold text-xl">
              {user.followers}
            </Text>
          </View>

          <View className="flex-1 bg-surface rounded-lg p-4 border border-border items-center">
            <Text className="text-muted text-xs mb-2">正在追蹤</Text>
            <Text className="text-foreground font-bold text-xl">
              {user.following}
            </Text>
          </View>
        </View>

        {/* 操作按鈕 */}
        <View className="gap-3 mb-4">
          <Pressable className="bg-primary px-4 py-4 rounded-lg active:opacity-80">
            <Text className="text-white text-center font-bold">編輯資料</Text>
          </Pressable>

          <Pressable className="bg-surface border border-border px-4 py-4 rounded-lg active:opacity-70">
            <Text className="text-foreground text-center font-bold">
              分享我的資料
            </Text>
          </Pressable>

          <Pressable
            onPress={handleLogout}
            className="bg-error/10 border border-error px-4 py-4 rounded-lg active:opacity-70"
          >
            <Text className="text-error text-center font-bold">登出</Text>
          </Pressable>
        </View>

        {/* 帳戶信息 */}
        <View className="bg-surface rounded-lg p-4 border border-border">
          <Text className="text-foreground font-bold mb-3">帳戶信息</Text>

          <View className="gap-2">
            <View className="flex-row justify-between">
              <Text className="text-muted text-sm">帳戶建立</Text>
              <Text className="text-foreground text-sm font-bold">
                {new Date(user.createdAt).toLocaleDateString('zh-TW')}
              </Text>
            </View>

            <View className="flex-row justify-between">
              <Text className="text-muted text-sm">最後更新</Text>
              <Text className="text-foreground text-sm font-bold">
                {new Date(user.updatedAt).toLocaleDateString('zh-TW')}
              </Text>
            </View>

            <View className="flex-row justify-between">
              <Text className="text-muted text-sm">用戶 ID</Text>
              <Text className="text-foreground text-xs font-bold font-mono">
                {user.id.substring(0, 8)}...
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
