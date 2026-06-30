/**
 * 自訂補給品編輯彈窗
 *
 * 功能：
 * - 新增補給品
 * - 編輯補給品
 * - 設置觸發方式（時間或距離）
 * - 設置重複模式
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  ScrollView,
  Switch,
  Alert,
} from 'react-native';
import { useColors } from '@/hooks/use-colors';
import { SupplyItem } from '@/lib/settings-context';
import Slider from '@react-native-community/slider';

export interface CustomSupplyItemModalProps {
  visible: boolean;
  item?: SupplyItem; // 編輯時提供
  onSave: (item: SupplyItem) => void;
  onCancel: () => void;
}

export const CustomSupplyItemModal: React.FC<CustomSupplyItemModalProps> = ({
  visible,
  item,
  onSave,
  onCancel,
}) => {
  const colors = useColors();
  const [name, setName] = useState('');
  const [triggerType, setTriggerType] = useState<'time' | 'distance'>('time');
  const [triggerValue, setTriggerValue] = useState(5); // 距離：公里
  const [triggerHours, setTriggerHours] = useState(0);
  const [triggerMinutes, setTriggerMinutes] = useState(30);
  const [triggerSeconds, setTriggerSeconds] = useState(0);
  const [repeatMode, setRepeatMode] = useState<'once' | 'every' | 'off'>('every');
  const [enabled, setEnabled] = useState(true);
  const [repeatUntilDismissed, setRepeatUntilDismissed] = useState(true);
  const [pauseOnDownhill, setPauseOnDownhill] = useState(false);

  // 初始化表單
  useEffect(() => {
    if (item) {
      setName(item.name);
      setTriggerType(item.triggerType);
      setTriggerValue(item.triggerValue || 5);
      setTriggerHours(item.triggerHours || 0);
      setTriggerMinutes(item.triggerMinutes || 30);
      setTriggerSeconds(item.triggerSeconds || 0);
      setRepeatMode(item.repeatMode);
      setEnabled(item.enabled);
      setRepeatUntilDismissed(item.repeatUntilDismissed ?? true);
      setPauseOnDownhill(item.pauseOnDownhill ?? false);
    } else {
      // 新增時重置表單
      setName('');
      setTriggerType('time');
      setTriggerValue(5);
      setTriggerHours(0);
      setTriggerMinutes(30);
      setTriggerSeconds(0);
      setRepeatMode('every');
      setEnabled(true);
      setRepeatUntilDismissed(true);
      setPauseOnDownhill(false);
    }
  }, [visible, item]);

  // 驗證表單
  const validateForm = (): boolean => {
    if (!name.trim()) {
      Alert.alert('錯誤', '請輸入補給品名稱');
      return false;
    }

    if (triggerType === 'distance' && triggerValue <= 0) {
      Alert.alert('錯誤', '距離必須大於 0');
      return false;
    }

    if (
      triggerType === 'time' &&
      triggerHours === 0 &&
      triggerMinutes === 0 &&
      triggerSeconds === 0
    ) {
      Alert.alert('錯誤', '時間必須大於 0');
      return false;
    }

    return true;
  };

  // 保存補給品
  const handleSave = () => {
    if (!validateForm()) return;

    const newItem: SupplyItem = {
      id: item?.id || `supply-${Date.now()}`,
      name: name.trim(),
      triggerType,
      triggerValue: triggerType === 'distance' ? triggerValue : undefined,
      triggerHours: triggerType === 'time' ? triggerHours : undefined,
      triggerMinutes: triggerType === 'time' ? triggerMinutes : undefined,
      triggerSeconds: triggerType === 'time' ? triggerSeconds : undefined,
      repeatMode,
      enabled,
      repeatUntilDismissed,
      pauseOnDownhill,
    };

    onSave(newItem);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onCancel}
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* 標題欄 */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            {item ? '編輯補給品' : '新增補給品'}
          </Text>
          <Pressable
            onPress={onCancel}
            style={({ pressed }) => [
              styles.closeButton,
              { opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Text style={{ color: colors.primary, fontSize: 18, fontWeight: '600' }}>
              ✕
            </Text>
          </Pressable>
        </View>

        <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 100 }}>
          {/* 補給品名稱 */}
          <View style={styles.section}>
            <Text style={[styles.label, { color: colors.foreground }]}>
              補給品名稱 *
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  borderColor: colors.border,
                  color: colors.foreground,
                  backgroundColor: colors.surface,
                },
              ]}
              placeholder="例如：水分、BCAA、電解質"
              placeholderTextColor={colors.muted}
              value={name}
              onChangeText={setName}
            />
          </View>

          {/* 啟用開關 */}
          <View style={[styles.section, styles.switchRow]}>
            <Text style={[styles.label, { color: colors.foreground }]}>啟用</Text>
            <Switch
              value={enabled}
              onValueChange={setEnabled}
              trackColor={{ false: colors.border, true: colors.primary }}
            />
          </View>

          {/* 觸發方式 */}
          <View style={styles.section}>
            <Text style={[styles.label, { color: colors.foreground }]}>
              觸發方式
            </Text>
            <View style={styles.segmentControl}>
              <Pressable
                onPress={() => setTriggerType('time')}
                style={[
                  styles.segmentButton,
                  triggerType === 'time' && {
                    backgroundColor: colors.primary,
                  },
                  triggerType !== 'time' && {
                    backgroundColor: colors.surface,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.segmentText,
                    {
                      color: triggerType === 'time' ? '#fff' : colors.foreground,
                    },
                  ]}
                >
                  時間
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setTriggerType('distance')}
                style={[
                  styles.segmentButton,
                  triggerType === 'distance' && {
                    backgroundColor: colors.primary,
                  },
                  triggerType !== 'distance' && {
                    backgroundColor: colors.surface,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.segmentText,
                    {
                      color: triggerType === 'distance' ? '#fff' : colors.foreground,
                    },
                  ]}
                >
                  距離
                </Text>
              </Pressable>
            </View>
          </View>

          {/* 時間觸發設置 */}
          {triggerType === 'time' && (
            <View style={styles.section}>
              <Text style={[styles.label, { color: colors.foreground }]}>
                觸發時間
              </Text>
              <View style={styles.timeInputRow}>
                <View style={styles.timeInputGroup}>
                  <Text style={[styles.timeLabel, { color: colors.muted }]}>小時</Text>
                  <TextInput
                    style={[
                      styles.timeInput,
                      {
                        borderColor: colors.border,
                        color: colors.foreground,
                        backgroundColor: colors.surface,
                      },
                    ]}
                    keyboardType="number-pad"
                    value={String(triggerHours)}
                    onChangeText={(val) =>
                      setTriggerHours(Math.max(0, parseInt(val) || 0))
                    }
                  />
                </View>
                <View style={styles.timeInputGroup}>
                  <Text style={[styles.timeLabel, { color: colors.muted }]}>分鐘</Text>
                  <TextInput
                    style={[
                      styles.timeInput,
                      {
                        borderColor: colors.border,
                        color: colors.foreground,
                        backgroundColor: colors.surface,
                      },
                    ]}
                    keyboardType="number-pad"
                    value={String(triggerMinutes)}
                    onChangeText={(val) =>
                      setTriggerMinutes(Math.max(0, Math.min(59, parseInt(val) || 0)))
                    }
                  />
                </View>
                <View style={styles.timeInputGroup}>
                  <Text style={[styles.timeLabel, { color: colors.muted }]}>秒</Text>
                  <TextInput
                    style={[
                      styles.timeInput,
                      {
                        borderColor: colors.border,
                        color: colors.foreground,
                        backgroundColor: colors.surface,
                      },
                    ]}
                    keyboardType="number-pad"
                    value={String(triggerSeconds)}
                    onChangeText={(val) =>
                      setTriggerSeconds(Math.max(0, Math.min(59, parseInt(val) || 0)))
                    }
                  />
                </View>
              </View>
            </View>
          )}

          {/* 距離觸發設置 */}
          {triggerType === 'distance' && (
            <View style={styles.section}>
              <View style={styles.sliderLabelRow}>
                <Text style={[styles.label, { color: colors.foreground }]}>
                  觸發距離
                </Text>
                <Text style={[styles.sliderValue, { color: colors.primary }]}>
                  {triggerValue.toFixed(1)} km
                </Text>
              </View>
              <Slider
                style={styles.slider}
                minimumValue={0.5}
                maximumValue={50}
                step={0.5}
                value={triggerValue}
                onValueChange={setTriggerValue}
                minimumTrackTintColor={colors.primary}
                maximumTrackTintColor={colors.border}
              />
            </View>
          )}

          {/* 重複模式 */}
          <View style={styles.section}>
            <Text style={[styles.label, { color: colors.foreground }]}>
              重複模式
            </Text>
            <View style={styles.segmentControl}>
              <Pressable
                onPress={() => setRepeatMode('once')}
                style={[
                  styles.segmentButton,
                  repeatMode === 'once' && {
                    backgroundColor: colors.primary,
                  },
                  repeatMode !== 'once' && {
                    backgroundColor: colors.surface,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.segmentText,
                    {
                      color: repeatMode === 'once' ? '#fff' : colors.foreground,
                    },
                  ]}
                >
                  只提醒一次
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setRepeatMode('every')}
                style={[
                  styles.segmentButton,
                  repeatMode === 'every' && {
                    backgroundColor: colors.primary,
                  },
                  repeatMode !== 'every' && {
                    backgroundColor: colors.surface,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.segmentText,
                    {
                      color: repeatMode === 'every' ? '#fff' : colors.foreground,
                    },
                  ]}
                >
                  每次重複
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setRepeatMode('off')}
                style={[
                  styles.segmentButton,
                  repeatMode === 'off' && {
                    backgroundColor: colors.primary,
                  },
                  repeatMode !== 'off' && {
                    backgroundColor: colors.surface,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.segmentText,
                    {
                      color: repeatMode === 'off' ? '#fff' : colors.foreground,
                    },
                  ]}
                >
                  不提醒
                </Text>
              </Pressable>
            </View>
          </View>

          {/* 進階選項 */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              進階選項
            </Text>

            <View style={[styles.switchRow, { marginTop: 12 }]}>
              <Text style={[styles.label, { color: colors.foreground }]}>
                未關閉時重複提醒
              </Text>
              <Switch
                value={repeatUntilDismissed}
                onValueChange={setRepeatUntilDismissed}
                trackColor={{ false: colors.border, true: colors.primary }}
              />
            </View>

            <View style={[styles.switchRow, { marginTop: 12 }]}>
              <Text style={[styles.label, { color: colors.foreground }]}>
                長下坡暫停提醒
              </Text>
              <Switch
                value={pauseOnDownhill}
                onValueChange={setPauseOnDownhill}
                trackColor={{ false: colors.border, true: colors.primary }}
              />
            </View>
          </View>
        </ScrollView>

        {/* 按鈕欄 */}
        <View style={[styles.footer, { borderTopColor: colors.border }]}>
          <Pressable
            onPress={onCancel}
            style={({ pressed }) => [
              styles.button,
              styles.cancelButton,
              { backgroundColor: colors.surface, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Text style={[styles.buttonText, { color: colors.foreground }]}>
              取消
            </Text>
          </Pressable>
          <Pressable
            onPress={handleSave}
            style={({ pressed }) => [
              styles.button,
              styles.saveButton,
              { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Text style={[styles.buttonText, { color: '#fff' }]}>
              {item ? '更新' : '新增'}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    marginTop: 20,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  closeButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  segmentControl: {
    flexDirection: 'row',
    gap: 8,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '600',
  },
  timeInputRow: {
    flexDirection: 'row',
    gap: 12,
  },
  timeInputGroup: {
    flex: 1,
    alignItems: 'center',
  },
  timeLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  timeInput: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 8,
    fontSize: 14,
    textAlign: 'center',
  },
  sliderLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sliderValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  slider: {
    width: '100%',
    height: 40,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {},
  saveButton: {},
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
