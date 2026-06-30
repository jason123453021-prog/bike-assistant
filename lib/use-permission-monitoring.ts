import { useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import { usePermissionMonitor, type PermissionChangeEvent } from './permission-monitor';
import { getBatteryOptimizationMonitor } from './battery-optimization-monitor';
import { PermissionsManager } from './permissions-manager';

/**
 * React Hook - 監控權限變化並提示用戶
 * 
 * 使用方式：
 * ```tsx
 * function MyScreen() {
 *   usePermissionMonitoring();
 *   return <View>...</View>;
 * }
 * ```
 */
export function usePermissionMonitoring() {
  const permissionMonitor = usePermissionMonitor(
    useCallback((event: PermissionChangeEvent) => {
      handlePermissionChange(event);
    }, []),
    true // autoStart
  );

  const batteryMonitor = getBatteryOptimizationMonitor();

  // 訂閱電池最佳化狀態變化
  useEffect(() => {
    const unsubscribe = batteryMonitor.subscribe((status) => {
      handleBatteryOptimizationChange(status);
    });

    // 啟動監控
    if (!batteryMonitor['isMonitoring']) {
      batteryMonitor.startMonitoring();
    }

    return () => {
      unsubscribe();
    };
  }, [batteryMonitor]);

  // 清理
  useEffect(() => {
    return () => {
      // 可選：在組件卸載時停止監控
      // permissionMonitor.stopMonitoring();
      // batteryMonitor.stopMonitoring();
    };
  }, [permissionMonitor, batteryMonitor]);
}

/**
 * 處理權限變化事件
 */
async function handlePermissionChange(event: PermissionChangeEvent): Promise<void> {
  console.log(
    `[PermissionMonitoring] Permission ${event.type} changed: ${event.previousStatus} -> ${event.currentStatus}`
  );

  // 如果權限被撤銷，提示用戶
  if (event.previousStatus && !event.currentStatus) {
    handlePermissionRevoked(event.type);
  }
}

/**
 * 處理權限被撤銷
 */
function handlePermissionRevoked(permissionType: string): void {
  const permissionNames: Record<string, string> = {
    location: '位置',
    notification: '通知',
    overlay: '懸浮窗',
    battery_optimization: '電池最佳化白名單',
  };

  const permissionName = permissionNames[permissionType] || permissionType;

  Alert.alert(
    '權限已撤銷',
    `${permissionName}權限已被撤銷。某些功能可能無法正常使用。`,
    [
      {
        text: '取消',
        onPress: () => {},
        style: 'cancel',
      },
      {
        text: '前往設定',
        onPress: () => {
          PermissionsManager.openSystemSettings(permissionType as any);
        },
      },
    ]
  );
}

/**
 * 處理電池最佳化狀態變化
 */
function handleBatteryOptimizationChange(status: any): void {
  console.log(
    `[PermissionMonitoring] Battery optimization status: ${status.isIgnoringOptimizations}`
  );

  // 如果 App 不在白名單中，定期提示用戶
  if (!status.isIgnoringOptimizations) {
    const monitor = getBatteryOptimizationMonitor();

    // 檢查是否應該提示用戶（避免頻繁提示）
    if (monitor.shouldPromptUser()) {
      console.log('[PermissionMonitoring] Prompting user for battery optimization exemption');

      Alert.alert(
        '電池最佳化提示',
        '為了確保 App 在背景持續運行，建議將此應用程式從電池最佳化名單中移除。',
        [
          {
            text: '稍後',
            onPress: () => {},
            style: 'cancel',
          },
          {
            text: '立即設定',
            onPress: async () => {
              await monitor.requestBatteryOptimizationExemption();
            },
          },
        ]
      );
    }
  }
}
