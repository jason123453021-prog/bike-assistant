import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { PermissionsManager } from '@/lib/permissions-manager';
import { IntentLauncherManager } from '@/lib/intent-launcher-manager';
import { useAppForegroundListener } from '@/hooks/use-app-state-listener';

export interface PermissionStatusCardProps {
  title: string;
  description: string;
  icon: string;
  permissionType: 'location' | 'notification' | 'overlay';
  onStatusChange?: (granted: boolean) => void;
}

/**
 * 權限狀態卡片組件
 * 用於設定頁面常駐顯示權限狀態
 */
export function PermissionStatusCard({
  title,
  description,
  icon,
  permissionType,
  onStatusChange,
}: PermissionStatusCardProps) {
  const [isGranted, setIsGranted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // 檢查權限狀態
  const checkPermissionStatus = async () => {
    try {
      setIsLoading(true);
      let status: any;

      switch (permissionType) {
        case 'location':
          status = await PermissionsManager.checkLocationPermission();
          break;
        case 'notification':
          status = await PermissionsManager.checkNotificationPermission();
          break;
        case 'overlay':
          status = await PermissionsManager.checkOverlayPermission();
          break;
      }

      const granted = status === 'granted';
      setIsGranted(granted);
      onStatusChange?.(granted);
    } catch (error) {
      console.error('[PermissionStatusCard] 檢查權限失敗:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 初始化時檢查權限
  useEffect(() => {
    checkPermissionStatus();
  }, [permissionType]);

  // 監聽 App 返回前景時重新檢查
  useAppForegroundListener(() => {
    checkPermissionStatus();
  });

  const handleRequestOrOpenSettings = async () => {
    try {
      setIsLoading(true);

      // 如果已授予，則打開設定頁面
      if (isGranted) {
        const intentManager = IntentLauncherManager;
        switch (permissionType) {
          case 'location':
            await intentManager.openLocationSettings();
            break;
          case 'notification':
            await intentManager.openNotificationSettings();
            break;
          case 'overlay':
            await intentManager.openOverlayPermissionSettings();
            break;
        }
      } else {
        // 如果未授予，則請求權限
        switch (permissionType) {
          case 'location':
            await PermissionsManager.requestLocationPermission();
            break;
          case 'notification':
            await PermissionsManager.requestNotificationPermission();
            break;
          case 'overlay':
            const intentManager = IntentLauncherManager;
            await intentManager.openOverlayPermissionSettings();
            break;
        }
      }

      // 延遲後重新檢查權限狀態
      setTimeout(() => {
        checkPermissionStatus();
      }, 500);
    } catch (error) {
      console.error('[PermissionStatusCard] 操作失敗:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View className="bg-surface rounded-lg p-4 mb-3 border border-border">
      {/* 標題和狀態 */}
      <View className="flex-row items-start justify-between mb-3">
        <View className="flex-1">
          <View className="flex-row items-center gap-2 mb-1">
            <Text className="text-2xl">{icon}</Text>
            <Text className="text-foreground font-bold text-base flex-1">
              {title}
            </Text>
          </View>
          <Text className="text-muted text-xs ml-8">{description}</Text>
        </View>

        {/* 狀態徽章 */}
        <View
          className={`px-3 py-1 rounded-full ${
            isGranted
              ? 'bg-success/20'
              : 'bg-warning/20'
          }`}
        >
          <Text
            className={`text-xs font-bold ${
              isGranted ? 'text-success' : 'text-warning'
            }`}
          >
            {isGranted ? '已授予' : '未授予'}
          </Text>
        </View>
      </View>

      {/* 按鈕 */}
      <Pressable
        onPress={handleRequestOrOpenSettings}
        disabled={isLoading}
        className={`py-2.5 px-3 rounded-lg active:opacity-70 flex-row items-center justify-center gap-2 ${
          isGranted
            ? 'bg-success/10 border border-success/30'
            : 'bg-primary'
        }`}
      >
        {isLoading ? (
          <ActivityIndicator
            color={isGranted ? '#22C55E' : 'white'}
            size="small"
          />
        ) : (
          <>
            <Text
              className={`text-center font-bold text-sm ${
                isGranted ? 'text-success' : 'text-white'
              }`}
            >
              {isGranted ? '修改設定' : '授予權限'}
            </Text>
            <Text className={isGranted ? 'text-success' : 'text-white'}>
              →
            </Text>
          </>
        )}
      </Pressable>
    </View>
  );
}
