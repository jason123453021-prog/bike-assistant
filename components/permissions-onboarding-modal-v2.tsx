import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { useColors } from '@/hooks/use-colors';
import { PermissionsManager, type PermissionStatus } from '@/lib/permissions-manager';

interface PermissionsOnboardingModalV2Props {
  visible: boolean;
  onComplete: () => void;
}

// 簡化的權限配置 - 只保留 3 項核心權限
const CORE_PERMISSIONS = [
  {
    type: 'location',
    name: '位置權限',
    description: '用於追蹤您的騎乘路線和實時位置',
    icon: '📍',
  },
  {
    type: 'notification',
    name: '通知權限',
    description: '接收補給提醒和騎乘提示',
    icon: '🔔',
  },
  {
    type: 'overlay',
    name: '懸浮窗權限',
    description: '在鎖屏時顯示騎乘數據和提醒',
    icon: '📋',
  },
];

export function PermissionsOnboardingModalV2({
  visible,
  onComplete,
}: PermissionsOnboardingModalV2Props) {
  const colors = useColors();
  const [permissions, setPermissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (visible) {
      loadPermissions();
    }
  }, [visible]);

  const loadPermissions = async () => {
    setLoading(true);
    try {
      // 只檢查核心權限
      const statuses = await Promise.all(
        CORE_PERMISSIONS.map(async (perm) => {
          let status: any = 'denied';
          if (perm.type === 'location') {
            status = await PermissionsManager.checkLocationPermission();
          } else if (perm.type === 'notification') {
            status = await PermissionsManager.checkNotificationPermission();
          } else if (perm.type === 'overlay') {
            status = await PermissionsManager.checkOverlayPermission();
          }
          return {
            ...perm,
            granted: status === 'granted',
          };
        })
      );
      setPermissions(statuses);
    } catch (error) {
      console.error('[PermissionsOnboardingModalV2] Error loading permissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestPermission = async (permission: any) => {
    try {
      let granted = false;

      if (permission.type === 'location') {
        granted = await PermissionsManager.requestLocationPermission();
      } else if (permission.type === 'notification') {
        granted = await PermissionsManager.requestNotificationPermission();
      } else if (permission.type === 'overlay') {
        await PermissionsManager.openSystemSettings('overlay');
        return;
      }

      if (granted) {
        setPermissions((prev) =>
          prev.map((p) =>
            p.type === permission.type ? { ...p, granted: true } : p
          )
        );
      }
    } catch (error) {
      console.error('[PermissionsOnboardingModalV2] Error requesting permission:', error);
    }
  };

  const allGranted = permissions.every((p) => p.granted);

  const handleComplete = async () => {
    await PermissionsManager.markOnboardingCompleted();
    onComplete();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      statusBarTranslucent
    >
      <View
        style={[
          styles.container,
          { backgroundColor: colors.background },
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.foreground }]}>
            開始騎乘
          </Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>
            我們需要 3 項權限來提供最佳體驗
          </Text>
        </View>

        {/* Permissions List */}
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
        >
          {loading ? (
            <Text style={[styles.loadingText, { color: colors.muted }]}>
              正在檢查權限...
            </Text>
          ) : (
            permissions.map((permission) => (
              <PermissionItemV2
                key={permission.type}
                permission={permission}
                colors={colors}
                onRequest={() => handleRequestPermission(permission)}
              />
            ))
          )}
        </ScrollView>

        {/* Footer */}
        <View style={[styles.footer, { borderTopColor: colors.border }]}>
          <TouchableOpacity
            style={[
              styles.button,
              {
                backgroundColor: allGranted ? colors.primary : colors.surface,
              },
            ]}
            onPress={handleComplete}
            disabled={!allGranted}
          >
            <Text
              style={[
                styles.buttonText,
                {
                  color: allGranted ? '#ffffff' : colors.muted,
                },
              ]}
            >
              {allGranted ? '開始騎乘' : '稍後設定'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

interface PermissionItemV2Props {
  permission: any;
  colors: any;
  onRequest: () => void;
}

function PermissionItemV2({
  permission,
  colors,
  onRequest,
}: PermissionItemV2Props) {
  return (
    <View
      style={[
        styles.permissionItem,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
      ]}
    >
      <View style={styles.permissionContent}>
        <View style={styles.permissionHeader}>
          <View style={styles.iconContainer}>
            <Text style={styles.icon}>{permission.icon}</Text>
          </View>
          <View style={styles.textContainer}>
            <Text style={[styles.permissionName, { color: colors.foreground }]}>
              {permission.name}
            </Text>
            <Text style={[styles.permissionDescription, { color: colors.muted }]}>
              {permission.description}
            </Text>
          </View>
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor: permission.granted
                  ? '#00E676'
                  : colors.surface,
                borderColor: permission.granted ? '#00E676' : colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.statusText,
                {
                  color: permission.granted ? '#ffffff' : colors.muted,
                },
              ]}
            >
              {permission.granted ? '✓' : '○'}
            </Text>
          </View>
        </View>
      </View>

      {!permission.granted && (
        <TouchableOpacity
          style={[styles.requestButton, { backgroundColor: colors.primary }]}
          onPress={onRequest}
        >
          <Text style={styles.requestButtonText}>
            {permission.type === 'overlay' ? '前往設定' : '授予權限'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? 40 : 0,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    textAlign: 'center',
    marginVertical: 24,
  },
  permissionItem: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    marginBottom: 8,
  },
  permissionContent: {
    marginBottom: 12,
  },
  permissionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  iconContainer: {
    marginRight: 12,
  },
  icon: {
    fontSize: 24,
  },
  textContainer: {
    flex: 1,
  },
  permissionName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  permissionDescription: {
    fontSize: 12,
    lineHeight: 16,
  },
  statusBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  requestButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  requestButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
  },
  button: {
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
