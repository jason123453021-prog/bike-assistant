import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Switch } from 'react-native';
import { useColors } from '@/hooks/use-colors';
import { cn } from '@/lib/utils';

export interface SimplifiedModeSettingsProps {
  mode: 'manual' | 'auto' | 'off';
  enabledFields: Array<'distance' | 'speed' | 'time' | 'direction' | 'elevation' | 'power'>;
  autoTriggerDelay?: number; // 自動觸發延遲（秒）
  onModeChange?: (mode: 'manual' | 'auto' | 'off') => void;
  onFieldsChange?: (fields: Array<'distance' | 'speed' | 'time' | 'direction' | 'elevation' | 'power'>) => void;
  onAutoTriggerDelayChange?: (delay: number) => void;
}

const AVAILABLE_FIELDS = [
  { id: 'distance', label: '剩餘距離', description: '顯示到目的地的剩餘距離' },
  { id: 'speed', label: '當前速度', description: '顯示實時騎乘速度' },
  { id: 'time', label: '當前時間', description: '顯示系統時間' },
  { id: 'direction', label: '轉向方向', description: '顯示即將轉向的方向' },
  { id: 'elevation', label: '海拔高度', description: '顯示當前海拔' },
  { id: 'power', label: '功率', description: '顯示騎乘功率' },
];

/**
 * 精簡模式設定組件
 * 
 * 功能：
 * - 設置精簡模式開啟方式（手動/自動/關閉）
 * - 選擇精簡模式顯示的數據欄位
 * - 配置自動觸發延遲
 */
export function SimplifiedModeSettings({
  mode,
  enabledFields,
  autoTriggerDelay = 30,
  onModeChange,
  onFieldsChange,
  onAutoTriggerDelayChange,
}: SimplifiedModeSettingsProps) {
  const colors = useColors();
  const [localMode, setLocalMode] = useState(mode);
  const [localFields, setLocalFields] = useState(enabledFields);
  const [localDelay, setLocalDelay] = useState(autoTriggerDelay);

  const handleModeChange = (newMode: 'manual' | 'auto' | 'off') => {
    setLocalMode(newMode);
    onModeChange?.(newMode);
  };

  const toggleField = (fieldId: string) => {
    const newFields = localFields.includes(fieldId as any)
      ? localFields.filter(f => f !== fieldId)
      : [...localFields, fieldId as any];
    setLocalFields(newFields);
    onFieldsChange?.(newFields);
  };

  const handleDelayChange = (delta: number) => {
    const newDelay = Math.max(10, Math.min(120, localDelay + delta));
    setLocalDelay(newDelay);
    onAutoTriggerDelayChange?.(newDelay);
  };

  return (
    <ScrollView style={styles.container}>
      {/* 模式選擇 */}
      <View style={[styles.section, { borderBottomColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
          精簡模式設定
        </Text>
        <Text style={[styles.sectionDescription, { color: colors.muted }]}>
          選擇精簡模式的啟用方式
        </Text>

        <View style={styles.modeOptions}>
          {[
            { id: 'off', label: '關閉', description: '不使用精簡模式' },
            { id: 'manual', label: '手動', description: '點擊按鈕啟用' },
            { id: 'auto', label: '自動', description: '螢幕閒置時自動啟用' },
          ].map((option) => (
            <Pressable
              key={option.id}
              style={[
                styles.modeOption,
                {
                  backgroundColor: localMode === option.id ? colors.primary : colors.surface,
                  borderColor: colors.border,
                },
              ]}
              onPress={() => handleModeChange(option.id as any)}
            >
              <Text
                style={[
                  styles.modeLabel,
                  {
                    color: localMode === option.id ? '#ffffff' : colors.foreground,
                  },
                ]}
              >
                {option.label}
              </Text>
              <Text
                style={[
                  styles.modeDescription,
                  {
                    color: localMode === option.id ? '#e0e0e0' : colors.muted,
                  },
                ]}
              >
                {option.description}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* 自動觸發延遲 */}
      {localMode === 'auto' && (
        <View style={[styles.section, { borderBottomColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            自動觸發延遲
          </Text>
          <Text style={[styles.sectionDescription, { color: colors.muted }]}>
            螢幕閒置多久後自動啟用精簡模式
          </Text>

          <View style={styles.delayControl}>
            <Pressable
              style={[styles.delayButton, { backgroundColor: colors.primary }]}
              onPress={() => handleDelayChange(-10)}
            >
              <Text style={styles.delayButtonText}>−</Text>
            </Pressable>

            <Text
              style={[
                styles.delayValue,
                { color: colors.foreground },
              ]}
            >
              {localDelay} 秒
            </Text>

            <Pressable
              style={[styles.delayButton, { backgroundColor: colors.primary }]}
              onPress={() => handleDelayChange(10)}
            >
              <Text style={styles.delayButtonText}>+</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* 顯示欄位選擇 */}
      <View style={[styles.section, { borderBottomColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
          顯示欄位
        </Text>
        <Text style={[styles.sectionDescription, { color: colors.muted }]}>
          選擇精簡模式下要顯示的數據欄位
        </Text>

        <View style={styles.fieldsList}>
          {AVAILABLE_FIELDS.map((field) => (
            <Pressable
              key={field.id}
              style={[
                styles.fieldItem,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
              onPress={() => toggleField(field.id)}
            >
              <View style={styles.fieldContent}>
                <Text style={[styles.fieldLabel, { color: colors.foreground }]}>
                  {field.label}
                </Text>
                <Text style={[styles.fieldDescription, { color: colors.muted }]}>
                  {field.description}
                </Text>
              </View>

              <View
                style={[
                  styles.checkbox,
                  {
                    backgroundColor: localFields.includes(field.id as any)
                      ? colors.primary
                      : colors.background,
                    borderColor: colors.border,
                  },
                ]}
              >
                {localFields.includes(field.id as any) && (
                  <Text style={styles.checkmark}>✓</Text>
                )}
              </View>
            </Pressable>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingVertical: 16,
  },
  section: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  sectionDescription: {
    fontSize: 13,
    marginBottom: 12,
  },
  modeOptions: {
    gap: 8,
  },
  modeOption: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  modeLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  modeDescription: {
    fontSize: 12,
  },
  delayControl: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  delayButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  delayButtonText: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  delayValue: {
    fontSize: 16,
    fontWeight: '600',
    minWidth: 80,
    textAlign: 'center',
  },
  fieldsList: {
    gap: 8,
  },
  fieldItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  fieldContent: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  fieldDescription: {
    fontSize: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmark: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
