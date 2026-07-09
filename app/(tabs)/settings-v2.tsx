import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Switch,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { PushNotificationService, NotificationSettings } from '@/lib/push-notification-service';

interface SyncStatus {
  isSyncing: boolean;
  lastSyncTime: number;
  pendingItems: number;
  failedItems: number;
}

export default function SettingsV2Screen() {
  const colors = useColors();
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettings();
    const interval = setInterval(loadSettings, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadSettings = async () => {
    try {
      const settings = await PushNotificationService.getSettings();
      // 模擬同步狀態
      const mockStatus: SyncStatus = {
        isSyncing: false,
        lastSyncTime: Date.now(),
        pendingItems: 0,
        failedItems: 0,
      };
      setNotificationSettings(settings);
      setSyncStatus(mockStatus);
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationSettingChange = async (
    key: keyof NotificationSettings,
    value: boolean
  ) => {
    try {
      const updated = {
        ...notificationSettings,
        [key]: value,
      } as NotificationSettings;
      setNotificationSettings(updated);
      await PushNotificationService.updateSettings({ [key]: value } as Partial<NotificationSettings>);
    } catch (error) {
      console.error('Failed to update notification setting:', error);
      Alert.alert('錯誤', '無法更新設置');
    }
  };

  const handleManualSync = async () => {
    try {
      Alert.alert('同步中...', '正在同步數據，請稍候');
      // 模擬同步
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await loadSettings();
      Alert.alert('成功', '數據同步完成');
    } catch (error) {
      console.error('Failed to sync:', error);
      Alert.alert('錯誤', '同步失敗');
    }
  };

  const handleClearNotificationHistory = () => {
    Alert.alert('清除通知歷史', '確定要清除所有通知歷史嗎？', [
      { text: '取消', style: 'cancel' },
      {
        text: '清除',
        style: 'destructive',
        onPress: async () => {
          try {
            await PushNotificationService.clearNotificationHistory();
            Alert.alert('成功', '通知歷史已清除');
          } catch (error) {
            Alert.alert('錯誤', '清除失敗');
          }
        },
      },
    ]);
  };

  if (loading || !notificationSettings || !syncStatus) {
    return (
      <ScreenContainer className="flex items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="bg-background">
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* 標題 */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.foreground }]}>設置</Text>
        </View>

        {/* 通知設置部分 */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>通知設置</Text>

          {/* 成就通知 */}
          <View style={styles.settingItem}>
            <View style={styles.settingLabel}>
              <Text style={[styles.settingName, { color: colors.foreground }]}>
                🏆 成就解鎖通知
              </Text>
              <Text style={[styles.settingDesc, { color: colors.muted }]}>
                解鎖新成就時發送通知
              </Text>
            </View>
            <Switch
              value={notificationSettings.achievementsEnabled}
              onValueChange={(value) =>
                handleNotificationSettingChange('achievementsEnabled', value)
              }
              trackColor={{ false: colors.border, true: colors.primary + '80' }}
              thumbColor={notificationSettings.achievementsEnabled ? colors.primary : colors.muted}
            />
          </View>

          {/* 隊友通知 */}
          <View style={styles.settingItem}>
            <View style={styles.settingLabel}>
              <Text style={[styles.settingName, { color: colors.foreground }]}>
                👥 隊友上線通知
              </Text>
              <Text style={[styles.settingDesc, { color: colors.muted }]}>
                隊友開始騎乘時發送通知
              </Text>
            </View>
            <Switch
              value={notificationSettings.buddyUpdatesEnabled}
              onValueChange={(value) =>
                handleNotificationSettingChange('buddyUpdatesEnabled', value)
              }
              trackColor={{ false: colors.border, true: colors.primary + '80' }}
              thumbColor={notificationSettings.buddyUpdatesEnabled ? colors.primary : colors.muted}
            />
          </View>

          {/* 緊急警報 */}
          <View style={styles.settingItem}>
            <View style={styles.settingLabel}>
              <Text style={[styles.settingName, { color: colors.foreground }]}>
                🚨 緊急警報
              </Text>
              <Text style={[styles.settingDesc, { color: colors.muted }]}>
                隊友遇到緊急情況時發送警報
              </Text>
            </View>
            <Switch
              value={notificationSettings.emergencyAlertsEnabled}
              onValueChange={(value) =>
                handleNotificationSettingChange('emergencyAlertsEnabled', value)
              }
              trackColor={{ false: colors.border, true: colors.primary + '80' }}
              thumbColor={notificationSettings.emergencyAlertsEnabled ? colors.primary : colors.muted}
            />
          </View>

          {/* 天氣警告 */}
          <View style={styles.settingItem}>
            <View style={styles.settingLabel}>
              <Text style={[styles.settingName, { color: colors.foreground }]}>
                ⚠️ 天氣警告
              </Text>
              <Text style={[styles.settingDesc, { color: colors.muted }]}>
                惡劣天氣時發送警告
              </Text>
            </View>
            <Switch
              value={notificationSettings.weatherAlertsEnabled}
              onValueChange={(value) =>
                handleNotificationSettingChange('weatherAlertsEnabled', value)
              }
              trackColor={{ false: colors.border, true: colors.primary + '80' }}
              thumbColor={notificationSettings.weatherAlertsEnabled ? colors.primary : colors.muted}
            />
          </View>

          {/* 訓練提醒 */}
          <View style={styles.settingItem}>
            <View style={styles.settingLabel}>
              <Text style={[styles.settingName, { color: colors.foreground }]}>
                🏋️ 訓練提醒
              </Text>
              <Text style={[styles.settingDesc, { color: colors.muted }]}>
                根據計劃發送訓練提醒
              </Text>
            </View>
            <Switch
              value={notificationSettings.trainingRemindersEnabled}
              onValueChange={(value) =>
                handleNotificationSettingChange('trainingRemindersEnabled', value)
              }
              trackColor={{ false: colors.border, true: colors.primary + '80' }}
              thumbColor={notificationSettings.trainingRemindersEnabled ? colors.primary : colors.muted}
            />
          </View>
        </View>

        {/* 通知效果設置 */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>通知效果</Text>

          {/* 聲音 */}
          <View style={styles.settingItem}>
            <View style={styles.settingLabel}>
              <Text style={[styles.settingName, { color: colors.foreground }]}>
                🔊 聲音
              </Text>
              <Text style={[styles.settingDesc, { color: colors.muted }]}>
                通知時播放聲音
              </Text>
            </View>
            <Switch
              value={notificationSettings.soundEnabled}
              onValueChange={(value) =>
                handleNotificationSettingChange('soundEnabled', value)
              }
              trackColor={{ false: colors.border, true: colors.primary + '80' }}
              thumbColor={notificationSettings.soundEnabled ? colors.primary : colors.muted}
            />
          </View>

          {/* 振動 */}
          <View style={styles.settingItem}>
            <View style={styles.settingLabel}>
              <Text style={[styles.settingName, { color: colors.foreground }]}>
                📳 振動
              </Text>
              <Text style={[styles.settingDesc, { color: colors.muted }]}>
                通知時設備振動
              </Text>
            </View>
            <Switch
              value={notificationSettings.vibrationEnabled}
              onValueChange={(value) =>
                handleNotificationSettingChange('vibrationEnabled', value)
              }
              trackColor={{ false: colors.border, true: colors.primary + '80' }}
              thumbColor={notificationSettings.vibrationEnabled ? colors.primary : colors.muted}
            />
          </View>
        </View>

        {/* 數據同步設置 */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>數據同步</Text>

          {/* 同步狀態 */}
          <View style={styles.syncStatus}>
            <View style={styles.syncStatusItem}>
              <Text style={[styles.syncStatusLabel, { color: colors.muted }]}>
                同步狀態
              </Text>
              <Text
                style={[
                  styles.syncStatusValue,
                  {
                    color: syncStatus.isSyncing ? colors.primary : colors.success,
                  },
                ]}
              >
                {syncStatus.isSyncing ? '同步中...' : '已同步'}
              </Text>
            </View>

            <View style={styles.syncStatusItem}>
              <Text style={[styles.syncStatusLabel, { color: colors.muted }]}>
                待同步項目
              </Text>
              <Text style={[styles.syncStatusValue, { color: colors.foreground }]}>
                {syncStatus.pendingItems}
              </Text>
            </View>

            <View style={styles.syncStatusItem}>
              <Text style={[styles.syncStatusLabel, { color: colors.muted }]}>
                失敗項目
              </Text>
              <Text
                style={[
                  styles.syncStatusValue,
                  {
                    color: syncStatus.failedItems > 0 ? colors.error : colors.success,
                  },
                ]}
              >
                {syncStatus.failedItems}
              </Text>
            </View>
          </View>

          {/* 最後同步時間 */}
          {syncStatus.lastSyncTime > 0 && (
            <Text style={[styles.lastSyncTime, { color: colors.muted }]}>
              最後同步: {new Date(syncStatus.lastSyncTime).toLocaleString('zh-TW')}
            </Text>
          )}

          {/* 手動同步按鈕 */}
          <TouchableOpacity
            onPress={handleManualSync}
            disabled={syncStatus.isSyncing}
            style={[
              styles.button,
              {
                backgroundColor: syncStatus.isSyncing ? colors.muted + '40' : colors.primary + '20',
              },
            ]}
          >
            <Text style={[styles.buttonText, { color: colors.primary }]}>
              {syncStatus.isSyncing ? '同步中...' : '🔄 手動同步'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* 隱私和數據 */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>隱私和數據</Text>

          {/* 清除通知歷史 */}
          <TouchableOpacity
            onPress={handleClearNotificationHistory}
            style={[
              styles.button,
              {
                backgroundColor: colors.error + '20',
              },
            ]}
          >
            <Text style={[styles.buttonText, { color: colors.error }]}>
              🗑️ 清除通知歷史
            </Text>
          </TouchableOpacity>

          {/* 隱私政策 */}
          <TouchableOpacity
            onPress={() => {
              Linking.openURL('https://example.com/privacy');
            }}
            style={[
              styles.button,
              {
                backgroundColor: colors.primary + '20',
              },
            ]}
          >
            <Text style={[styles.buttonText, { color: colors.primary }]}>
              🔐 隱私政策
            </Text>
          </TouchableOpacity>

          {/* 服務條款 */}
          <TouchableOpacity
            onPress={() => {
              Linking.openURL('https://example.com/terms');
            }}
            style={[
              styles.button,
              {
                backgroundColor: colors.primary + '20',
              },
            ]}
          >
            <Text style={[styles.buttonText, { color: colors.primary }]}>
              📋 服務條款
            </Text>
          </TouchableOpacity>
        </View>

        {/* 關於 */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>關於</Text>

          <View style={styles.aboutItem}>
            <Text style={[styles.aboutLabel, { color: colors.muted }]}>應用版本</Text>
            <Text style={[styles.aboutValue, { color: colors.foreground }]}>1.0.0</Text>
          </View>

          <View style={styles.aboutItem}>
            <Text style={[styles.aboutLabel, { color: colors.muted }]}>構建號</Text>
            <Text style={[styles.aboutValue, { color: colors.foreground }]}>2026.07.09</Text>
          </View>

          <View style={styles.aboutItem}>
            <Text style={[styles.aboutLabel, { color: colors.muted }]}>開發者</Text>
            <Text style={[styles.aboutValue, { color: colors.foreground }]}>Bike Assistant Team</Text>
          </View>
        </View>

        {/* 底部間距 */}
        <View style={{ height: 32 }} />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  section: {
    marginHorizontal: 16,
    marginBottom: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  settingLabel: {
    flex: 1,
  },
  settingName: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  settingDesc: {
    fontSize: 12,
  },
  syncStatus: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  syncStatusItem: {
    alignItems: 'center',
  },
  syncStatusLabel: {
    fontSize: 11,
    marginBottom: 4,
  },
  syncStatusValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  lastSyncTime: {
    fontSize: 11,
    marginBottom: 12,
  },
  button: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  buttonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  aboutItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  aboutLabel: {
    fontSize: 12,
  },
  aboutValue: {
    fontSize: 12,
    fontWeight: '600',
  },
});
