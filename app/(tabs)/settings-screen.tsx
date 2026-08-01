/**
 * 設定頁面
 * 管理應用程式設定、補給提醒、省電模式、儀表板自訂等
 */

import React, { useState, useEffect } from 'react';
import { ScrollView, View, Text, Switch, TouchableOpacity, Alert } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { cn } from '@/lib/utils';

interface SettingsState {
  // 補給提醒設定
  supplyReminderEnabled: boolean;
  calorieThreshold: number;
  waterThreshold: number;

  // 省電模式設定
  powerSavingEnabled: boolean;
  powerSavingIdleTime: number;

  // 儀表板設定
  dashboardCollapsedFields: string[];
  dashboardExpandedFields: string[];

  // 離線模式
  offlineModeEnabled: boolean;
}

const AVAILABLE_FIELDS = [
  { id: 'speed', label: '即時速度' },
  { id: 'avgSpeed', label: '均速' },
  { id: 'time', label: '當前時間' },
  { id: 'totalTime', label: '總時數' },
  { id: 'distance', label: '累積距離' },
  { id: 'remainingDistance', label: '剩餘距離' },
  { id: 'eta', label: '預估到達' },
  { id: 'ascent', label: '總爬升' },
  { id: 'calories', label: '卡路里' },
  { id: 'water', label: '水分流失' },
];

export default function SettingsScreen() {
  const colors = useColors();
  const [settings, setSettings] = useState<SettingsState>({
    supplyReminderEnabled: true,
    calorieThreshold: 500,
    waterThreshold: 500,
    powerSavingEnabled: false,
    powerSavingIdleTime: 30,
    dashboardCollapsedFields: ['speed', 'distance', 'time'],
    dashboardExpandedFields: ['speed', 'distance', 'time', 'avgSpeed', 'calories', 'water'],
    offlineModeEnabled: true,
  });

  // 更新補給提醒設定
  const updateSupplySettings = (key: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  // 更新省電設定
  const updatePowerSavingSettings = (key: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  // 切換儀表板字段
  const toggleDashboardField = (fieldId: string, mode: 'collapsed' | 'expanded') => {
    setSettings(prev => {
      const fields = mode === 'collapsed' ? prev.dashboardCollapsedFields : prev.dashboardExpandedFields;
      const newFields = fields.includes(fieldId)
        ? fields.filter(f => f !== fieldId)
        : [...fields, fieldId];

      return {
        ...prev,
        [mode === 'collapsed' ? 'dashboardCollapsedFields' : 'dashboardExpandedFields']: newFields,
      };
    });
  };

  // 手動匯入騎乘紀錄
  const handleImportRecords = () => {
    Alert.alert(
      '匯入騎乘紀錄',
      '選擇要匯入的檔案格式',
      [
        {
          text: 'GPX 檔案',
          onPress: () => {
            // 實現 GPX 檔案選擇邏輯
            console.log('Importing GPX file');
          },
        },
        {
          text: 'JSON 檔案',
          onPress: () => {
            // 實現 JSON 檔案選擇邏輯
            console.log('Importing JSON file');
          },
        },
        {
          text: '取消',
          onPress: () => {},
          style: 'cancel',
        },
      ]
    );
  };

  // 手動備份
  const handleManualBackup = () => {
    Alert.alert('備份', '正在備份騎乘紀錄...', [
      {
        text: '確定',
        onPress: () => {
          console.log('Manual backup initiated');
        },
      },
    ]);
  };

  return (
    <ScreenContainer className="bg-background">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="p-4">
        {/* 補給提醒設定 */}
        <View className="mb-6">
          <Text className="text-lg font-bold text-foreground mb-4">補給提醒設定</Text>

          {/* 補給提醒開關 */}
          <View className="bg-surface rounded-lg p-4 mb-3 flex-row items-center justify-between">
            <Text className="text-foreground">啟用補給提醒</Text>
            <Switch
              value={settings.supplyReminderEnabled}
              onValueChange={value => updateSupplySettings('supplyReminderEnabled', value)}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.background}
            />
          </View>

          {/* 卡路里閾值 */}
          <View className="bg-surface rounded-lg p-4 mb-3">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-foreground">卡路里補給閾值</Text>
              <Text className="text-primary font-bold">{settings.calorieThreshold} kcal</Text>
            </View>
            <View className="h-8 bg-border rounded flex-row items-center px-2">
              <TouchableOpacity
                onPress={() =>
                  updateSupplySettings('calorieThreshold', Math.max(100, settings.calorieThreshold - 50))
                }
                className="px-2"
              >
                <Text className="text-foreground">−</Text>
              </TouchableOpacity>
              <View className="flex-1" />
              <TouchableOpacity
                onPress={() =>
                  updateSupplySettings('calorieThreshold', Math.min(2000, settings.calorieThreshold + 50))
                }
                className="px-2"
              >
                <Text className="text-foreground">+</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* 水分閾值 */}
          <View className="bg-surface rounded-lg p-4">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-foreground">水分補給閾值</Text>
              <Text className="text-primary font-bold">{settings.waterThreshold} ml</Text>
            </View>
            <View className="h-8 bg-border rounded flex-row items-center px-2">
              <TouchableOpacity
                onPress={() =>
                  updateSupplySettings('waterThreshold', Math.max(100, settings.waterThreshold - 50))
                }
                className="px-2"
              >
                <Text className="text-foreground">−</Text>
              </TouchableOpacity>
              <View className="flex-1" />
              <TouchableOpacity
                onPress={() =>
                  updateSupplySettings('waterThreshold', Math.min(2000, settings.waterThreshold + 50))
                }
                className="px-2"
              >
                <Text className="text-foreground">+</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* 省電模式設定 */}
        <View className="mb-6">
          <Text className="text-lg font-bold text-foreground mb-4">省電模式</Text>

          {/* 省電模式開關 */}
          <View className="bg-surface rounded-lg p-4 mb-3 flex-row items-center justify-between">
            <Text className="text-foreground">自動省電模式</Text>
            <Switch
              value={settings.powerSavingEnabled}
              onValueChange={value => updatePowerSavingSettings('powerSavingEnabled', value)}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.background}
            />
          </View>

          {/* 空閒時間設定 */}
          <View className="bg-surface rounded-lg p-4">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-foreground">進入省電模式時間</Text>
              <Text className="text-primary font-bold">{settings.powerSavingIdleTime} 秒</Text>
            </View>
            <View className="h-8 bg-border rounded flex-row items-center px-2">
              <TouchableOpacity
                onPress={() =>
                  updatePowerSavingSettings('powerSavingIdleTime', Math.max(10, settings.powerSavingIdleTime - 5))
                }
                className="px-2"
              >
                <Text className="text-foreground">−</Text>
              </TouchableOpacity>
              <View className="flex-1" />
              <TouchableOpacity
                onPress={() =>
                  updatePowerSavingSettings('powerSavingIdleTime', Math.min(300, settings.powerSavingIdleTime + 5))
                }
                className="px-2"
              >
                <Text className="text-foreground">+</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* 儀表板自訂 */}
        <View className="mb-6">
          <Text className="text-lg font-bold text-foreground mb-4">儀表板自訂</Text>

          {/* 收縮狀態字段 */}
          <View className="bg-surface rounded-lg p-4 mb-3">
            <Text className="text-foreground font-semibold mb-3">收縮狀態顯示字段</Text>
            <View className="flex-row flex-wrap gap-2">
              {AVAILABLE_FIELDS.map(field => (
                <TouchableOpacity
                  key={field.id}
                  onPress={() => toggleDashboardField(field.id, 'collapsed')}
                  className={cn(
                    'px-3 py-2 rounded-full',
                    settings.dashboardCollapsedFields.includes(field.id)
                      ? 'bg-primary'
                      : 'bg-border'
                  )}
                >
                  <Text
                    className={cn(
                      'text-sm font-medium',
                      settings.dashboardCollapsedFields.includes(field.id)
                        ? 'text-background'
                        : 'text-foreground'
                    )}
                  >
                    {field.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* 展開狀態字段 */}
          <View className="bg-surface rounded-lg p-4">
            <Text className="text-foreground font-semibold mb-3">展開狀態顯示字段</Text>
            <View className="flex-row flex-wrap gap-2">
              {AVAILABLE_FIELDS.map(field => (
                <TouchableOpacity
                  key={field.id}
                  onPress={() => toggleDashboardField(field.id, 'expanded')}
                  className={cn(
                    'px-3 py-2 rounded-full',
                    settings.dashboardExpandedFields.includes(field.id)
                      ? 'bg-primary'
                      : 'bg-border'
                  )}
                >
                  <Text
                    className={cn(
                      'text-sm font-medium',
                      settings.dashboardExpandedFields.includes(field.id)
                        ? 'text-background'
                        : 'text-foreground'
                    )}
                  >
                    {field.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* 離線存儲管理 */}
        <View className="mb-6">
          <Text className="text-lg font-bold text-foreground mb-4">離線存儲管理</Text>

          {/* 匯入紀錄按鈕 */}
          <TouchableOpacity
            onPress={handleImportRecords}
            className="bg-primary rounded-lg p-4 mb-3"
          >
            <Text className="text-background font-semibold text-center">匯入/手動同步騎乘紀錄</Text>
          </TouchableOpacity>

          {/* 手動備份按鈕 */}
          <TouchableOpacity
            onPress={handleManualBackup}
            className="bg-border rounded-lg p-4"
          >
            <Text className="text-foreground font-semibold text-center">手動備份</Text>
          </TouchableOpacity>
        </View>

        {/* 關於應用程式 */}
        <View className="bg-surface rounded-lg p-4 mt-6">
          <Text className="text-foreground font-semibold mb-2">關於應用程式</Text>
          <Text className="text-muted text-sm">智慧單車騎乘助手 v1.0.0</Text>
          <Text className="text-muted text-sm mt-2">
            完全離線、高穩定度的單車導航與紀錄應用程式
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
