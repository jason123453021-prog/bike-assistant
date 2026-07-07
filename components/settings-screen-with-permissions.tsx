import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenContainer } from '@/components/screen-container';
import { PermissionStatusCard } from '@/components/permission-status-card';
import { usePushNotification } from '@/hooks/use-push-notification';

/**
 * 設定頁面集成組件
 * 包含權限狀態卡片和推送通知設定
 */
export function SettingsScreenWithPermissions() {
  const insets = useSafeAreaInsets();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [rideRemindersEnabled, setRideRemindersEnabled] = useState(true);
  const [turnInstructionsEnabled, setTurnInstructionsEnabled] = useState(true);
  const [achievementsEnabled, setAchievementsEnabled] = useState(true);
  const [socialNotificationsEnabled, setSocialNotificationsEnabled] =
    useState(true);

  const { sendRideReminder, sendAchievement } = usePushNotification({
    onNotificationReceived: (notification) => {
      console.log('[Settings] 收到通知:', notification);
    },
    onNotificationResponse: (response) => {
      console.log('[Settings] 用戶點擊通知:', response);
    },
  });

  const handleTestNotification = async () => {
    try {
      await sendRideReminder('這是一個測試騎乘提醒通知', 1);
    } catch (error) {
      console.error('[Settings] 發送測試通知失敗:', error);
    }
  };

  const handleTestAchievement = async () => {
    try {
      await sendAchievement('🎉 恭喜！您完成了首次 10km 騎乘', 1);
    } catch (error) {
      console.error('[Settings] 發送測試成就通知失敗:', error);
    }
  };

  return (
    <ScreenContainer className="p-4">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 24) }}>
        {/* 標題 */}
        <View className="mb-6">
          <Text className="text-3xl font-bold text-foreground mb-2">
            ⚙️ 設定
          </Text>
          <Text className="text-muted text-sm">
            管理應用程式權限和通知設定
          </Text>
        </View>

        {/* 權限狀態區段 */}
        <View className="mb-6">
          <Text className="text-lg font-bold text-foreground mb-3">
            🔐 應用程式權限
          </Text>
          <Text className="text-muted text-xs mb-3">
            以下權限用於提供最佳的騎乘體驗
          </Text>

          <PermissionStatusCard
            title="位置權限"
            description="允許 App 在背景記錄您的騎乘軌跡"
            icon="📍"
            permissionType="location"
          />

          <PermissionStatusCard
            title="通知權限"
            description="允許 App 發送騎乘提示與補給提醒通知"
            icon="🔔"
            permissionType="notification"
          />

          <PermissionStatusCard
            title="懸浮窗權限"
            description="允許 App 在鎖屏時顯示補給提醒彈窗"
            icon="📋"
            permissionType="overlay"
          />
        </View>

        {/* 通知設定區段 */}
        <View className="mb-6">
          <Text className="text-lg font-bold text-foreground mb-3">
            🔔 通知設定
          </Text>

          {/* 全局通知開關 */}
          <View className="bg-surface rounded-lg p-4 mb-3 border border-border flex-row items-center justify-between">
            <View className="flex-1">
              <Text className="text-foreground font-bold text-base">
                啟用所有通知
              </Text>
              <Text className="text-muted text-xs mt-1">
                關閉此選項將禁用所有通知
              </Text>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              trackColor={{ false: '#ccc', true: '#22C55E' }}
              thumbColor={notificationsEnabled ? '#fff' : '#999'}
            />
          </View>

          {/* 騎乘提醒 */}
          <View
            className={`bg-surface rounded-lg p-4 mb-3 border border-border flex-row items-center justify-between ${
              !notificationsEnabled ? 'opacity-50' : ''
            }`}
          >
            <View className="flex-1">
              <Text className="text-foreground font-bold text-base">
                🚴 騎乘提醒
              </Text>
              <Text className="text-muted text-xs mt-1">
                接收騎乘開始、暫停和結束提醒
              </Text>
            </View>
            <Switch
              value={rideRemindersEnabled}
              onValueChange={setRideRemindersEnabled}
              disabled={!notificationsEnabled}
              trackColor={{ false: '#ccc', true: '#22C55E' }}
              thumbColor={rideRemindersEnabled ? '#fff' : '#999'}
            />
          </View>

          {/* 轉向指令 */}
          <View
            className={`bg-surface rounded-lg p-4 mb-3 border border-border flex-row items-center justify-between ${
              !notificationsEnabled ? 'opacity-50' : ''
            }`}
          >
            <View className="flex-1">
              <Text className="text-foreground font-bold text-base">
                🗺️ 轉向指令
              </Text>
              <Text className="text-muted text-xs mt-1">
                接收導航轉向提示和語音提醒
              </Text>
            </View>
            <Switch
              value={turnInstructionsEnabled}
              onValueChange={setTurnInstructionsEnabled}
              disabled={!notificationsEnabled}
              trackColor={{ false: '#ccc', true: '#22C55E' }}
              thumbColor={turnInstructionsEnabled ? '#fff' : '#999'}
            />
          </View>

          {/* 成就通知 */}
          <View
            className={`bg-surface rounded-lg p-4 mb-3 border border-border flex-row items-center justify-between ${
              !notificationsEnabled ? 'opacity-50' : ''
            }`}
          >
            <View className="flex-1">
              <Text className="text-foreground font-bold text-base">
                🏆 成就通知
              </Text>
              <Text className="text-muted text-xs mt-1">
                接收里程碑和成就解鎖通知
              </Text>
            </View>
            <Switch
              value={achievementsEnabled}
              onValueChange={setAchievementsEnabled}
              disabled={!notificationsEnabled}
              trackColor={{ false: '#ccc', true: '#22C55E' }}
              thumbColor={achievementsEnabled ? '#fff' : '#999'}
            />
          </View>

          {/* 社交通知 */}
          <View
            className={`bg-surface rounded-lg p-4 mb-3 border border-border flex-row items-center justify-between ${
              !notificationsEnabled ? 'opacity-50' : ''
            }`}
          >
            <View className="flex-1">
              <Text className="text-foreground font-bold text-base">
                👥 社交通知
              </Text>
              <Text className="text-muted text-xs mt-1">
                接收好友請求、評論和分享通知
              </Text>
            </View>
            <Switch
              value={socialNotificationsEnabled}
              onValueChange={setSocialNotificationsEnabled}
              disabled={!notificationsEnabled}
              trackColor={{ false: '#ccc', true: '#22C55E' }}
              thumbColor={socialNotificationsEnabled ? '#fff' : '#999'}
            />
          </View>
        </View>

        {/* 測試區段 */}
        <View className="mb-6">
          <Text className="text-lg font-bold text-foreground mb-3">
            🧪 測試通知
          </Text>

          <Pressable
            onPress={handleTestNotification}
            className="bg-primary px-4 py-3 rounded-lg active:opacity-80 mb-2"
          >
            <Text className="text-white text-center font-bold">
              發送測試騎乘提醒
            </Text>
          </Pressable>

          <Pressable
            onPress={handleTestAchievement}
            className="bg-success px-4 py-3 rounded-lg active:opacity-80"
          >
            <Text className="text-white text-center font-bold">
              發送測試成就通知
            </Text>
          </Pressable>
        </View>

        {/* 提示 */}
        <View className="bg-primary/10 rounded-lg p-4 border border-primary/20 mb-6">
          <Text className="text-primary text-xs text-center">
            ℹ️ 通知設定將立即生效。您可以隨時在此頁面修改設定。
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
