import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, Modal, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PermissionsManager } from '@/lib/permissions-manager';
import { getIntentLauncherManager } from '@/lib/intent-launcher-manager';
import { getOnboardingStateManager } from '@/lib/onboarding-state-manager';
import { useAppForegroundListener } from '@/hooks/use-app-state-listener';

export interface ImprovedPermissionsOnboardingModalProps {
  visible: boolean;
  onDismiss?: () => void;
}

/**
 * 改進的權限 Onboarding 彈窗組件
 * 支援：
 * - 首次啟動時自動顯示
 * - 返回 App 時自動重新整理權限狀態
 * - 底部自適應（避免被系統導航列遮擋）
 * - 改進的導航邏輯
 */
export function ImprovedPermissionsOnboardingModal({
  visible,
  onDismiss,
}: ImprovedPermissionsOnboardingModalProps) {
  const insets = useSafeAreaInsets();
  const [isLoading, setIsLoading] = useState(false);
  const [permissionStates, setPermissionStates] = useState({
    location: false,
    notification: false,
    overlay: false,
    batteryOptimization: false,
  });

  // 重新整理權限狀態
  const refreshPermissionStates = async () => {
    try {
      const states = await Promise.all([
        PermissionsManager.checkLocationPermission(),
        PermissionsManager.checkNotificationPermission(),
        PermissionsManager.checkOverlayPermission(),
        PermissionsManager.checkBatteryOptimizationWhitelist(),
      ]);

      setPermissionStates({
        location: (states[0] as any) === 'granted',
        notification: (states[1] as any) === 'granted',
        overlay: (states[2] as any) === 'granted',
        batteryOptimization: (states[3] as any) === 'granted',
      });

      console.log('[PermissionsOnboarding] 權限狀態已更新:', states);
    } catch (error) {
      console.error('[PermissionsOnboarding] 重新整理權限狀態失敗:', error);
    }
  };

  // 初始化時重新整理權限狀態
  useEffect(() => {
    if (visible) {
      refreshPermissionStates();
    }
  }, [visible]);

  // 監聽 App 返回前景時重新整理權限狀態
  useAppForegroundListener(() => {
    if (visible) {
      console.log('[PermissionsOnboarding] App 返回前景，重新整理權限狀態...');
      refreshPermissionStates();
    }
  });

  const handleRequestLocationPermission = async () => {
    try {
      setIsLoading(true);
      await PermissionsManager.requestLocationPermission();
      await refreshPermissionStates();
    } catch (error) {
      console.error('[PermissionsOnboarding] 請求位置權限失敗:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequestNotificationPermission = async () => {
    try {
      setIsLoading(true);
      await PermissionsManager.requestNotificationPermission();
      await refreshPermissionStates();
    } catch (error) {
      console.error('[PermissionsOnboarding] 請求通知權限失敗:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenOverlaySettings = async () => {
    try {
      setIsLoading(true);
      const intentManager = getIntentLauncherManager();
      await intentManager.openOverlayPermissionSettings();
      // 不立即關閉，等待用戶返回後自動重新整理
    } catch (error) {
      console.error('[PermissionsOnboarding] 打開懸浮窗設定失敗:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenBatterySettings = async () => {
    try {
      setIsLoading(true);
      const intentManager = getIntentLauncherManager();
      await intentManager.openBatteryOptimizationSettings();
      // 不立即關閉，等待用戶返回後自動重新整理
    } catch (error) {
      console.error('[PermissionsOnboarding] 打開電池設定失敗:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = async () => {
    try {
      const onboardingManager = getOnboardingStateManager();
      await onboardingManager.markPermissionOnboardingShown();
      onDismiss?.();
    } catch (error) {
      console.error('[PermissionsOnboarding] 標記 Onboarding 失敗:', error);
    }
  };

  const renderPermissionItem = (
    title: string,
    description: string,
    granted: boolean,
    onPress: () => void,
    isLoading: boolean
  ) => (
    <View className="bg-surface rounded-lg p-4 mb-3 border border-border">
      <View className="flex-row items-start justify-between mb-2">
        <View className="flex-1">
          <Text className="text-foreground font-bold text-base">{title}</Text>
          <Text className="text-muted text-xs mt-1">{description}</Text>
        </View>
        <View
          className={`px-3 py-1 rounded-full ${
            granted
              ? 'bg-success/20'
              : 'bg-warning/20'
          }`}
        >
          <Text
            className={`text-xs font-bold ${
              granted ? 'text-success' : 'text-warning'
            }`}
          >
            {granted ? '已授予' : '未授予'}
          </Text>
        </View>
      </View>

      <Pressable
        onPress={onPress}
        disabled={isLoading || granted}
        className={`py-2 px-3 rounded-lg active:opacity-70 ${
          granted
            ? 'bg-success/10'
            : 'bg-primary'
        }`}
      >
        {isLoading ? (
          <ActivityIndicator color={granted ? '#22C55E' : 'white'} />
        ) : (
          <Text
            className={`text-center font-bold text-sm ${
              granted ? 'text-success' : 'text-white'
            }`}
          >
            {granted ? '已授予' : '授予權限'}
          </Text>
        )}
      </Pressable>
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View className="flex-1 bg-black/50">
        <View
          className="flex-1 bg-background rounded-t-3xl"
          style={{ paddingBottom: Math.max(insets.bottom, 16) }}
        >
          {/* 標題 */}
          <View className="px-4 pt-6 pb-4 border-b border-border">
            <Text className="text-2xl font-bold text-foreground text-center">
              🔐 權限設定
            </Text>
            <Text className="text-muted text-sm text-center mt-2">
              為了提供最佳的騎乘體驗，我們需要以下權限
            </Text>
          </View>

          {/* 權限列表 */}
          <ScrollView
            className="flex-1 px-4 pt-4"
            showsVerticalScrollIndicator={false}
          >
            {renderPermissionItem(
              '📍 位置權限',
              '允許 App 在背景記錄您的騎乘軌跡',
              permissionStates.location,
              handleRequestLocationPermission,
              isLoading
            )}

            {renderPermissionItem(
              '🔔 通知權限',
              '允許 App 發送騎乘提示與補給提醒通知',
              permissionStates.notification,
              handleRequestNotificationPermission,
              isLoading
            )}

            {renderPermissionItem(
              '🪟 懸浮窗權限',
              '允許 App 在其他應用上方顯示導航提示',
              permissionStates.overlay,
              handleOpenOverlaySettings,
              isLoading
            )}

            {renderPermissionItem(
              '🔋 電池最佳化白名單',
              '防止系統因省電機制關閉 App 背景追蹤',
              permissionStates.batteryOptimization,
              handleOpenBatterySettings,
              isLoading
            )}

            {/* 提示文本 */}
            <View className="bg-primary/10 rounded-lg p-4 border border-primary/20 mb-4">
              <Text className="text-primary text-xs text-center">
                ℹ️ 您可以稍後在設定頁面隨時修改這些權限
              </Text>
            </View>
          </ScrollView>

          {/* 底部按鈕 - 使用動態 paddingBottom 確保完全可見 */}
          <View
            className="px-4 pt-4 gap-3"
            style={{ paddingBottom: Math.max(insets.bottom, 24) }}
          >
            <Pressable
              onPress={handleSkip}
              disabled={isLoading}
              className="bg-primary px-4 py-4 rounded-lg active:opacity-80"
            >
              <Text className="text-white text-center font-bold">
                {isLoading ? '處理中...' : '完成設定'}
              </Text>
            </Pressable>

            <Pressable
              onPress={handleSkip}
              disabled={isLoading}
              className="bg-surface border border-border px-4 py-4 rounded-lg active:opacity-70"
            >
              <Text className="text-foreground text-center font-bold">
                稍後設定
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
