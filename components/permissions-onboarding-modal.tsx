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

interface PermissionsOnboardingModalProps {
  visible: boolean;
  onComplete: () => void;
}

export function PermissionsOnboardingModal({
  visible,
  onComplete,
}: PermissionsOnboardingModalProps) {
  const colors = useColors();
  const [permissions, setPermissions] = useState<PermissionStatus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (visible) {
      loadPermissions();
    }
  }, [visible]);

  const loadPermissions = async () => {
    setLoading(true);
    try {
      const statuses = await PermissionsManager.getAllPermissionStatuses();
      setPermissions(statuses);
    } catch (error) {
      console.error('[PermissionsOnboardingModal] Error loading permissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestPermission = async (permission: PermissionStatus) => {
    try {
      let granted = false;

      switch (permission.type) {
        case 'location':
          granted = await PermissionsManager.requestLocationPermission();
          break;
        case 'notification':
          granted = await PermissionsManager.requestNotificationPermission();
          break;
        case 'overlay':
        case 'battery_optimization':
          await PermissionsManager.openSystemSettings(permission.type);
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
      console.error('[PermissionsOnboardingModal] Error requesting permission:', error);
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
            權限設定
          </Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>
            為了提供最佳的騎乘體驗，我們需要以下權限
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
              <PermissionItem
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
              {allGranted ? '開始使用' : '稍後設定'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

interface PermissionItemProps {
  permission: PermissionStatus;
  colors: any;
  onRequest: () => void;
}

function PermissionItem({
  permission,
  colors,
  onRequest,
}: PermissionItemProps) {
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
          <Text style={[styles.permissionName, { color: colors.foreground }]}>
            {permission.name}
          </Text>
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
              {permission.granted ? '已授予' : '未授予'}
            </Text>
          </View>
        </View>
        <Text style={[styles.permissionDescription, { color: colors.muted }]}>
          {permission.description}
        </Text>
      </View>

      {!permission.granted && (
        <TouchableOpacity
          style={[styles.requestButton, { backgroundColor: colors.primary }]}
          onPress={onRequest}
        >
          <Text style={styles.requestButtonText}>
            {permission.type === 'overlay' ||
            permission.type === 'battery_optimization'
              ? '前往設定'
              : '授予權限'}
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
    marginBottom: 8,
  },
  permissionName: {
    fontSize: 16,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  permissionDescription: {
    fontSize: 13,
    lineHeight: 18,
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
