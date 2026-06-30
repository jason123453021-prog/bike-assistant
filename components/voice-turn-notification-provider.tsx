import React, { createContext, useContext, useEffect, useRef, useCallback } from 'react';
import { getTurnVoiceNotificationManager, type VoiceConfig, type TurnNotification } from '@/lib/turn-voice-notification-manager';

interface VoiceTurnNotificationContextType {
  checkAndPlayTurnNotification: (distance: number, turnType: string, instruction: string, voiceText: string) => Promise<void>;
  updateConfig: (config: Partial<VoiceConfig>) => void;
  stop: () => Promise<void>;
  reset: () => void;
  testVoice: () => Promise<void>;
  getConfig: () => VoiceConfig;
  isSpeaking: () => boolean;
  lastNotification: TurnNotification | null;
}

const VoiceTurnNotificationContext = createContext<VoiceTurnNotificationContextType | null>(null);

export interface VoiceTurnNotificationProviderProps {
  children: React.ReactNode;
  config?: Partial<VoiceConfig>;
  onNotification?: (notification: TurnNotification) => void;
}

/**
 * 轉向導航語音提示提供者
 * 在 App 根層級使用，為所有子組件提供語音提示功能
 */
export function VoiceTurnNotificationProvider({
  children,
  config,
  onNotification,
}: VoiceTurnNotificationProviderProps) {
  const managerRef = useRef(getTurnVoiceNotificationManager(config));
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const [lastNotification, setLastNotification] = React.useState<TurnNotification | null>(null);

  // 初始化
  useEffect(() => {
    const initialize = async () => {
      try {
        await managerRef.current.initialize();
        console.log('[VoiceTurnNotificationProvider] Initialized');
      } catch (error) {
        console.error('[VoiceTurnNotificationProvider] Initialization error:', error);
      }
    };

    initialize();
  }, []);

  // 訂閱通知事件
  useEffect(() => {
    const handleNotification = (notification: TurnNotification) => {
      setLastNotification(notification);
      if (onNotification) {
        onNotification(notification);
      }
    };

    unsubscribeRef.current = managerRef.current.subscribe(handleNotification);

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

  const value: VoiceTurnNotificationContextType = {
    checkAndPlayTurnNotification,
    updateConfig,
    stop,
    reset,
    testVoice,
    getConfig,
    isSpeaking,
    lastNotification,
  };

  return (
    <VoiceTurnNotificationContext.Provider value={value}>
      {children}
    </VoiceTurnNotificationContext.Provider>
  );
}

/**
 * 使用轉向導航語音提示
 */
export function useVoiceTurnNotification(): VoiceTurnNotificationContextType {
  const context = useContext(VoiceTurnNotificationContext);
  if (!context) {
    throw new Error('useVoiceTurnNotification must be used within VoiceTurnNotificationProvider');
  }
  return context;
}
