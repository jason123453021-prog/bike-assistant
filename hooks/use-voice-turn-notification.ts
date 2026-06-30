import { useEffect, useRef, useCallback } from 'react';
import { getTurnVoiceNotificationManager, type VoiceConfig, type TurnNotification } from '@/lib/turn-voice-notification-manager';

export interface UseVoiceTurnNotificationOptions {
  enabled?: boolean;
  config?: Partial<VoiceConfig>;
  onNotification?: (notification: TurnNotification) => void;
}

/**
 * 轉向導航語音提示 Hook
 * 功能：
 * - 自動初始化語音引擎
 * - 管理語音配置
 * - 監聽語音通知事件
 * - 清理資源
 */
export function useVoiceTurnNotification(options: UseVoiceTurnNotificationOptions = {}) {
  const { enabled = true, config, onNotification } = options;

  const managerRef = useRef(getTurnVoiceNotificationManager(config));
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // 初始化
  useEffect(() => {
    const initialize = async () => {
      try {
        await managerRef.current.initialize();
      } catch (error) {
        console.error('[useVoiceTurnNotification] Initialization error:', error);
      }
    };

    initialize();
  }, []);

  // 訂閱通知事件
  useEffect(() => {
    if (onNotification) {
      unsubscribeRef.current = managerRef.current.subscribe(onNotification);
    }

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [onNotification]);

  // 更新配置
  useEffect(() => {
    if (config) {
      managerRef.current.updateConfig(config);
    }
  }, [config]);

  // 更新啟用狀態
  useEffect(() => {
    managerRef.current.updateConfig({ enabled });
  }, [enabled]);

  // 清理資源
  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, []);

  // 返回 API
  const checkAndPlayTurnNotification = useCallback(
    async (distance: number, turnType: string, instruction: string, voiceText: string) => {
      await managerRef.current.checkAndPlayTurnNotification(distance, turnType, instruction, voiceText);
    },
    []
  );

  const updateConfig = useCallback((newConfig: Partial<VoiceConfig>) => {
    managerRef.current.updateConfig(newConfig);
  }, []);

  const stop = useCallback(async () => {
    await managerRef.current.stop();
  }, []);

  const reset = useCallback(() => {
    managerRef.current.reset();
  }, []);

  const testVoice = useCallback(async () => {
    await managerRef.current.testVoice();
  }, []);

  const getConfig = useCallback(() => {
    return managerRef.current.getConfig();
  }, []);

  const isSpeaking = useCallback(() => {
    return managerRef.current.isSpeakingNow();
  }, []);

  return {
    checkAndPlayTurnNotification,
    updateConfig,
    stop,
    reset,
    testVoice,
    getConfig,
    isSpeaking,
    manager: managerRef.current,
  };
}
