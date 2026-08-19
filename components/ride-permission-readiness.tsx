import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { AppState, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useColors } from '@/hooks/use-colors';
import { PermissionsManager, type PermissionStatus, type PermissionType } from '@/lib/permissions-manager';

type ReadinessItem = {
  type: Extract<PermissionType, 'location' | 'notification' | 'battery_optimization'>;
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  title: string;
  setupLabel: string;
};

const READINESS_ITEMS: ReadinessItem[] = [
  { type: 'notification', icon: 'notifications-active', title: '補給與導航通知', setupLabel: '允許通知' },
  { type: 'location', icon: 'my-location', title: '精確與背景位置', setupLabel: '允許位置' },
  { type: 'battery_optimization', icon: 'battery-charging-full', title: '電池不受限制', setupLabel: '前往設定' },
];

/**
 * 正式 APK 的背景騎乘準備清單。系統層設定不會被 App 繞過；此元件只提供清楚、可返回檢查的官方入口。
 */
export function RidePermissionReadiness() {
  const colors = useColors();
  const [statuses, setStatuses] = useState<PermissionStatus[]>([]);
  const [opening, setOpening] = useState<PermissionType | null>(null);

  const refresh = useCallback(async () => {
    const next = await PermissionsManager.getAllPermissionStatuses();
    setStatuses(next);
  }, []);

  useEffect(() => {
    void refresh();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  const statusByType = useMemo(
    () => new Map(statuses.map((status) => [status.type, status])),
    [statuses],
  );

  const openSetup = useCallback(async (type: PermissionType) => {
    setOpening(type);
    try {
      if (type === 'notification') {
        const granted = await PermissionsManager.requestNotificationPermission();
        if (!granted) await PermissionsManager.openSystemSettings(type);
      } else if (type === 'location') {
        const granted = await PermissionsManager.requestLocationPermission();
        if (!granted) await PermissionsManager.openSystemSettings(type);
      } else {
        await PermissionsManager.openSystemSettings(type);
      }
    } finally {
      await refresh();
      setOpening(null);
    }
  }, [refresh]);

  if (Platform.OS === 'web') return null;

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
      <View style={styles.header}>
        <View style={[styles.headerIcon, { backgroundColor: `${colors.accent}18` }]}>
          <MaterialIcons name="directions-bike" size={20} color={colors.accent} />
        </View>
        <View style={styles.headerCopy}>
          <Text style={[styles.title, { color: colors.foreground }]}>背景騎乘準備</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>完成以下設定，讓鎖屏 GPS 與補給提醒更可靠。</Text>
        </View>
      </View>

      {READINESS_ITEMS.map((item, index) => {
        const status = statusByType.get(item.type);
        const isManualVerification = status?.verification === 'manual';
        const granted = Boolean(status?.granted);
        const isOpening = opening === item.type;
        const stateColor = isManualVerification ? colors.accent : granted ? colors.success : colors.warning;
        const stateBackground = isManualVerification ? `${colors.accent}18` : granted ? `${colors.success}18` : `${colors.warning}18`;
        return (
          <View key={item.type} style={[styles.row, index > 0 && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
            <View style={[styles.itemIcon, { backgroundColor: stateBackground }]}> 
              <MaterialIcons name={item.icon} size={18} color={stateColor} />
            </View>
            <View style={styles.copy}>
              <Text style={[styles.itemTitle, { color: colors.foreground }]}>{item.title}</Text>
              <Text style={[styles.itemHint, { color: colors.muted }]}> 
                {isManualVerification ? status?.description : granted ? '已允許' : status?.description ?? '請在系統設定完成此項目'}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${item.setupLabel}${item.title}`}
              disabled={isOpening}
              onPress={() => { void openSetup(item.type); }}
              style={({ pressed }) => [
                styles.action,
                { borderColor: stateColor, opacity: pressed || isOpening ? 0.66 : 1 },
              ]}
            >
              <Text style={[styles.actionText, { color: stateColor }]}>{isOpening ? '開啟中' : isManualVerification ? item.setupLabel : granted ? '檢查' : item.setupLabel}</Text>
            </Pressable>
          </View>
        );
      })}

      <Text style={[styles.note, { color: colors.muted }]}>電池限制由各手機系統管理；按「前往設定」後，請將本 App 設為「不受限制」或關閉電池最佳化。</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 7 },
  headerIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1 },
  title: { fontSize: 17, fontWeight: '800' },
  subtitle: { fontSize: 13, lineHeight: 19, fontWeight: '500', marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  itemIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1 },
  itemTitle: { fontSize: 15, fontWeight: '700' },
  itemHint: { fontSize: 12, lineHeight: 17, fontWeight: '500', marginTop: 3 },
  action: { minHeight: 44, borderWidth: 1, borderRadius: 10, justifyContent: 'center', paddingHorizontal: 12 },
  actionText: { fontSize: 13, fontWeight: '800' },
  note: { fontSize: 12, lineHeight: 18, fontWeight: '500', marginTop: 7 },
});
