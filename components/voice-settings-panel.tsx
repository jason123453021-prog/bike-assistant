import React, { useState, useEffect } from 'react';
import { View, Text, Switch, Pressable, ScrollView } from 'react-native';
import Slider from '@react-native-community/slider';
import { useVoiceTurnNotification } from './voice-turn-notification-provider';
import { type VoiceConfig } from '@/lib/turn-voice-notification-manager';
import { cn } from '@/lib/utils';

export interface VoiceSettingsPanelProps {
  className?: string;
  onClose?: () => void;
}

/**
 * 轉向導航語音提示設置面板
 * 功能：
 * - 啟用/禁用語音提示
 * - 調整語音速率、音量、音調
 * - 選擇語言
 * - 設置重複次數
 * - 靜音模式
 * - 測試語音
 */
export function VoiceSettingsPanel({ className, onClose }: VoiceSettingsPanelProps) {
  const { getConfig, updateConfig, testVoice } = useVoiceTurnNotification();

  const [config, setConfig] = useState<VoiceConfig>(getConfig());
  const [isTesting, setIsTesting] = useState(false);

  // 更新本地配置
  const handleConfigChange = (newConfig: Partial<VoiceConfig>) => {
    const updated = { ...config, ...newConfig };
    setConfig(updated);
    updateConfig(newConfig);
  };

  // 測試語音
  const handleTestVoice = async () => {
    setIsTesting(true);
    try {
      await testVoice();
    } catch (error) {
      console.error('[VoiceSettingsPanel] Test voice error:', error);
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <ScrollView className={cn('flex-1 bg-background', className)}>
      <View className="p-4 gap-6">
        {/* 標題 */}
        <View className="flex-row items-center justify-between">
          <Text className="text-2xl font-bold text-foreground">語音提示設置</Text>
          {onClose && (
            <Pressable
              onPress={onClose}
              className="p-2"
              style={({ pressed }) => [pressed && { opacity: 0.7 }]}
            >
              <Text className="text-lg text-muted">✕</Text>
            </Pressable>
          )}
        </View>

        {/* 啟用/禁用 */}
        <View className="bg-surface rounded-lg p-4 gap-3">
          <View className="flex-row items-center justify-between">
            <Text className="text-base font-semibold text-foreground">啟用語音提示</Text>
            <Switch
              value={config.enabled}
              onValueChange={(value) => handleConfigChange({ enabled: value })}
              trackColor={{ false: '#767577', true: '#81c784' }}
              thumbColor={config.enabled ? '#4caf50' : '#f1f1f1'}
            />
          </View>
          <Text className="text-sm text-muted">
            {config.enabled ? '語音提示已啟用' : '語音提示已禁用'}
          </Text>
        </View>

        {/* 靜音模式 */}
        <View className="bg-surface rounded-lg p-4 gap-3">
          <View className="flex-row items-center justify-between">
            <Text className="text-base font-semibold text-foreground">靜音模式</Text>
            <Switch
              value={config.silenceMode}
              onValueChange={(value) => handleConfigChange({ silenceMode: value })}
              trackColor={{ false: '#767577', true: '#81c784' }}
              thumbColor={config.silenceMode ? '#4caf50' : '#f1f1f1'}
              disabled={!config.enabled}
            />
          </View>
          <Text className="text-sm text-muted">
            {config.silenceMode ? '靜音模式已啟用，不播放語音' : '靜音模式已禁用'}
          </Text>
        </View>

        {/* 語言選擇 */}
        <View className="bg-surface rounded-lg p-4 gap-3">
          <Text className="text-base font-semibold text-foreground">語言</Text>
          <View className="flex-row gap-2">
            {(['zh-TW', 'en-US'] as const).map((lang) => (
              <Pressable
                key={lang}
                onPress={() => handleConfigChange({ language: lang })}
                className={cn(
                  'flex-1 py-2 px-3 rounded-lg border',
                  config.language === lang
                    ? 'bg-primary border-primary'
                    : 'bg-background border-border'
                )}
                style={({ pressed }) => [pressed && { opacity: 0.7 }]}
              >
                <Text
                  className={cn(
                    'text-center font-semibold',
                    config.language === lang ? 'text-background' : 'text-foreground'
                  )}
                >
                  {lang === 'zh-TW' ? '繁體中文' : 'English'}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* 語音速率 */}
        <View className="bg-surface rounded-lg p-4 gap-3">
          <View className="flex-row items-center justify-between">
            <Text className="text-base font-semibold text-foreground">語音速率</Text>
            <Text className="text-sm text-primary font-semibold">{config.rate.toFixed(1)}x</Text>
          </View>
          <Slider
            style={{ height: 40 }}
            minimumValue={0.5}
            maximumValue={2.0}
            step={0.1}
            value={config.rate}
            onValueChange={(value) => handleConfigChange({ rate: value })}
            minimumTrackTintColor="#4caf50"
            maximumTrackTintColor="#cccccc"
            thumbTintColor="#4caf50"
            disabled={!config.enabled}
          />
          <View className="flex-row justify-between">
            <Text className="text-xs text-muted">0.5x (慢)</Text>
            <Text className="text-xs text-muted">2.0x (快)</Text>
          </View>
        </View>

        {/* 音量 */}
        <View className="bg-surface rounded-lg p-4 gap-3">
          <View className="flex-row items-center justify-between">
            <Text className="text-base font-semibold text-foreground">音量</Text>
            <Text className="text-sm text-primary font-semibold">{Math.round(config.volume * 100)}%</Text>
          </View>
          <Slider
            style={{ height: 40 }}
            minimumValue={0}
            maximumValue={1}
            step={0.1}
            value={config.volume}
            onValueChange={(value) => handleConfigChange({ volume: value })}
            minimumTrackTintColor="#4caf50"
            maximumTrackTintColor="#cccccc"
            thumbTintColor="#4caf50"
            disabled={!config.enabled}
          />
          <View className="flex-row justify-between">
            <Text className="text-xs text-muted">0% (靜音)</Text>
            <Text className="text-xs text-muted">100% (最大)</Text>
          </View>
        </View>

        {/* 音調 */}
        <View className="bg-surface rounded-lg p-4 gap-3">
          <View className="flex-row items-center justify-between">
            <Text className="text-base font-semibold text-foreground">音調</Text>
            <Text className="text-sm text-primary font-semibold">{config.pitch.toFixed(1)}x</Text>
          </View>
          <Slider
            style={{ height: 40 }}
            minimumValue={0.5}
            maximumValue={2.0}
            step={0.1}
            value={config.pitch}
            onValueChange={(value) => handleConfigChange({ pitch: value })}
            minimumTrackTintColor="#4caf50"
            maximumTrackTintColor="#cccccc"
            thumbTintColor="#4caf50"
            disabled={!config.enabled}
          />
          <View className="flex-row justify-between">
            <Text className="text-xs text-muted">0.5x (低)</Text>
            <Text className="text-xs text-muted">2.0x (高)</Text>
          </View>
        </View>

        {/* 重複次數 */}
        <View className="bg-surface rounded-lg p-4 gap-3">
          <View className="flex-row items-center justify-between">
            <Text className="text-base font-semibold text-foreground">重複次數</Text>
            <Text className="text-sm text-primary font-semibold">{config.repeatCount}x</Text>
          </View>
          <View className="flex-row gap-2">
            {[1, 2, 3].map((count) => (
              <Pressable
                key={count}
                onPress={() => handleConfigChange({ repeatCount: count })}
                className={cn(
                  'flex-1 py-2 px-3 rounded-lg border',
                  config.repeatCount === count
                    ? 'bg-primary border-primary'
                    : 'bg-background border-border'
                )}
                style={({ pressed }) => [pressed && { opacity: 0.7 }]}
                disabled={!config.enabled}
              >
                <Text
                  className={cn(
                    'text-center font-semibold',
                    config.repeatCount === count ? 'text-background' : 'text-foreground'
                  )}
                >
                  {count}x
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* 測試按鈕 */}
        <Pressable
          onPress={handleTestVoice}
          disabled={!config.enabled || isTesting}
          className={cn(
            'py-3 px-4 rounded-lg',
            config.enabled && !isTesting ? 'bg-primary' : 'bg-muted opacity-50'
          )}
          style={({ pressed }) => [pressed && { opacity: 0.8 }]}
        >
          <Text className="text-center font-semibold text-background">
            {isTesting ? '正在測試...' : '測試語音'}
          </Text>
        </Pressable>

        {/* 提示信息 */}
        <View className="bg-warning/10 rounded-lg p-3 border border-warning">
          <Text className="text-sm text-warning font-semibold">💡 提示</Text>
          <Text className="text-xs text-warning mt-1">
            語音提示會在接近轉彎處（300 米）時自動播放，立即轉彎時（50 米）會播放立即提示。
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}
