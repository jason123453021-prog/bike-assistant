import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, AppState, AppStateStatus } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PermissionsManager, type PermissionStatus as PermissionStatusType } from '@/lib/permissions-manager';
import { IntentLauncherImproved } from '@/lib/intent-launcher-improved';
import { cn } from '@/lib/utils';

interface PermissionItemUI {
  id: string;
  name: string;
  description: string;
  granted: boolean;
  onPress: () => Promise<boolean>;
}

/**
 * 系統權限狀態區塊組件
 * 在設定頁面中顯示所有核心權限的授予狀態
 * 用戶可點擊「前往設定」按鈕自主修改權限
 */
export function SystemPermissionsStatusBlock() {
  const insets = useSafeAreaInsets();
  const [permissions, setPermissions] = useState<PermissionItemUI[]>([]);
  const [loading, setLoading] = useState(false);
  const [appState, setAppState] = useState<AppStateStatus>('active');

  // 初始化權限列表
  useEffect(() => {
    initializePermissions();
  }, []);

  // 監聽 App 狀態變化，返回時重新檢查權限
  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
    };
  }, []);

  const handleAppStateChange = (nextAppState: AppStateStatus) => {
    if (appState.match(/inactive|background/) && nextAppState === 'active') {
      // App 從背景返回前台，重新檢查權限
      console.log('[SystemPermissionsStatusBlock] App returned to foreground, refreshing permissions');
      refreshPermissions();
    }
    setAppState(nextAppState);
  };

  const initializePermissions = async () => {
    setLoading(true);
    try {
      const statuses = await PermissionsManager.getAllPermissionStatuses();

      const items: PermissionItemUI[] = statuses.map((status) => ({
        id: status.type,
        name: status.name,
        description: status.description,
        granted: status.granted,
        onPress: () => handleOpenSettings(status.type),
      }));

      setPermissions(items);
    } catch (error) {
      console.error('[SystemPermissionsStatusBlock] Error initializing permissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshPermissions = async () => {
    try {
      const statuses = await PermissionsManager.getAllPermissionStatuses();

      setPermissions(prev =>
        prev.map((item) => {
          const status = statuses.find(s => s.type === item.id);
          return {
            ...item,
            granted: status?.granted ?? false,
          };
        })
      );
    } catch (error) {
      console.error('[SystemPermissionsStatusBlock] Error refreshing permissions:', error);
    }
  };

  const handleOpenSettings = async (permissionType: string): Promise<boolean> => {
    try {
      switch (permissionType) {
        case 'location':
          return await IntentLauncherImproved.openLocationPermissionSettings();
        case 'notification':
          return await IntentLauncherImproved.openNotificationPermissionSettings();
        case 'overlay':
          return await IntentLauncherImproved.openOverlayPermissionSettings();
        case 'battery_optimization':
          return await IntentLauncherImproved.openBatteryOptimizationSettings();
        default:
          return false;
      }
    } catch (error) {
      console.error(`[SystemPermissionsStatusBlock] Error opening settings for ${permissionType}:`, error);
      return false;
    }
  };

  const handlePermissionPress = async (item: PermissionItemUI) => {
    try {
      const success = await item.onPress();
      if (success) {
        // 跳轉後延遲 500ms 再刷新，給用戶時間修改設定
        setTimeout(() => {
          refreshPermissions();
        }, 500);
      }
    } catch (error) {
      console.error(`[SystemPermissionsStatusBlock] Error handling ${item.id} permission:`, error);
    }
  };

  const getStatusColor = (granted: boolean) => {
    return granted ? '#22C55E' : '#EF4444'; // 綠色或紅色
  };

  const getStatusText = (granted: boolean) => {
    return granted ? '已授與' : '未授與';
  };

  return (
    <View className="bg-surface rounded-lg p-4 mb-4">
      {/* 標題 */}
      <Text className="text-lg font-bold text-foreground mb-4">系統權限狀態</Text>

      {/* 權限列表 */}
      <View className="gap-3">
        {permissions.map((item) => (
          <View key={item.id} className="bg-background rounded-lg p-3 border border-border">
            {/* 權限名稱和狀態 */}
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-base font-semibold text-foreground flex-1">{item.name}</Text>
              <View
                className="px-3 py-1 rounded-full"
                style={{ backgroundColor: getStatusColor(item.granted) + '20' }}
              >
                <Text
                  className="text-sm font-medium"
                  style={{ color: getStatusColor(item.granted) }}
                >
                  {getStatusText(item.granted)}
                </Text>
              </View>
            </View>

            {/* 權限描述 */}
            <Text className="text-sm text-muted mb-3">{item.description}</Text>

            {/* 前往設定按鈕 */}
            {!item.granted && (
              <TouchableOpacity
                onPress={() => handlePermissionPress(item)}
                className="bg-primary px-4 py-2 rounded-lg items-center"
                activeOpacity={0.7}
              >
                <Text className="text-white font-semibold">前往設定</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
      </View>

      {/* 刷新提示 */}
      <Text className="text-xs text-muted mt-4">
        💡 修改設定後返回 App，權限狀態會自動更新
      </Text>
    </View>
  );
}


