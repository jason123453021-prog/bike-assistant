import { useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import { usePermissionMonitor, type PermissionChangeEvent } from './permission-monitor';
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

  // 清理
  useEffect(() => {
    return () => {
      // 可選：在組件卸載時停止監控
      // permissionMonitor.stopMonitoring();
    };
  }, [permissionMonitor]);
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
 * 處理權限被撤錄
 */
function handlePermissionRevoked(permissionType: string): void {
  const permissionNames: Record<string, string> = {
    location: '位置',
    notification: '通知',
    overlay: '懸浮窗',
  };

  const permissionName = permissionNames[permissionType] || permissionType;

  Alert.alert(
    '權限已撤錄',
    `${permissionName}權限已被撤錄。某些功能可能無法正常使用。`,
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
