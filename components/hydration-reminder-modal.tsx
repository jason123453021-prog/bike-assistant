import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
  BackHandler,
  useColorScheme,
  Platform,
} from 'react-native';
import { useAudioPlayer, setAudioModeAsync } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/use-colors';
import { notificationWakeupManager } from '@/lib/notification-wakeup';
import { ScreenWakeup } from '@/lib/native-modules';
import { ttsManager } from '@/lib/tts-manager';

export interface HydrationReminderProps {
  visible: boolean;
  type: 'water' | 'calories' | 'both'; // 補給類型
  amount?: number; // 補給量（毫升或卡路里）
  onDismiss: () => void;
  onConfirm: () => void;
  voiceEnabled?: boolean; // 是否啟用語音提示
  voiceRepeatInterval?: number; // 語音重複間隔（秒）
}

export const HydrationReminderModal: React.FC<HydrationReminderProps> = ({
  visible,
  type,
  amount = 0,
  onDismiss,
  onConfirm,
  voiceEnabled = true,
  voiceRepeatInterval = 5,
}) => {
  const colors = useColors();
  const colorScheme = useColorScheme();
  const audioPlayer = useAudioPlayer();
  const [voicePlayer, setVoicePlayer] = useState<any>(null);
  const voiceIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const notificationIdRef = useRef<string>(`hydration-${Date.now()}`);

  // 獲取補給文本
  const getHydrationText = () => {
    switch (type) {
      case 'water':
        return `補充水分\n${amount} ml`;
      case 'calories':
        return `補充能量\n${amount} 卡路里`;
      case 'both':
        return `補充水分和能量\n水: ${amount} ml`;
      default:
        return '補給提醒';
    }
  };

  // 初始化屏幕喚醒和語音
  useEffect(() => {
    if (!visible) return;

    const initializeWakeupAndVoice = async () => {
      try {
        // 初始化 TTS 引擎
        await ttsManager.initialize();
        console.log('[HydrationReminder] TTS initialized');

        // 初始化通知喚醒模塊
        await notificationWakeupManager.initialize();

        // 喚醒屏幕
        await notificationWakeupManager.wakeupScreenAndShowNotification({
          notificationId: notificationIdRef.current,
          duration: 0, // 無限期
        });

        // 初始化並使用原生鎖屏喚醒模塊（Android）
        if (Platform.OS === 'android') {
          try {
            await ScreenWakeup.initialize();
            await ScreenWakeup.wakeupScreen();
            await ScreenWakeup.requestAudioFocus();
            console.log('[HydrationReminder] Native screen wakeup initialized');
          } catch (error) {
            console.warn('[HydrationReminder] Native screen wakeup failed:', error);
          }
        }

        // 啟用音頻播放（即使在靜音模式下）
        if (voiceEnabled) {
          await setAudioModeAsync({
            playsInSilentMode: true,
          });

          // 播放語音提示（如果有音頻文件）
          startVoiceLoop();
        }

        // 觸發觸覺反饋
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } catch (error) {
        console.error('[HydrationReminder] Initialization error:', error);
      }
    };

    initializeWakeupAndVoice();

    // 攔截返回鍵（Android）
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      // 返回鍵不關閉彈窗，只有音量鍵或「已補給」按鈕可以關閉
      return true;
    });

    return () => {
      backHandler.remove();
    };
  }, [visible, voiceEnabled]);

  // 語音循環播放
  const startVoiceLoop = async () => {
    if (voiceIntervalRef.current) {
      clearInterval(voiceIntervalRef.current);
    }

    // 立即播放一次
    await playVoiceReminder();

    // 定期重複播放
    voiceIntervalRef.current = setInterval(() => {
      playVoiceReminder();
    }, voiceRepeatInterval * 1000);
  };

  // 播放語音提示（使用 TTS 動態合成）
  const playVoiceReminder = async () => {
    try {
      // 根據補給類型構建播報文本
      let supplyName = '';
      switch (type) {
        case 'water':
          supplyName = '水分';
          break;
        case 'calories':
          supplyName = '能量';
          break;
        case 'both':
          supplyName = '水分和能量';
          break;
        default:
          supplyName = '補給品';
      }

      // 使用 TTS 播報補給品名稱
      await ttsManager.speakSupplyReminder(supplyName, {
        pitch: 1.0,
        rate: 0.9,
        volume: 1.0,
      });

      console.log('[HydrationReminder] Voice reminder played via TTS:', supplyName);
    } catch (error) {
      console.error('[HydrationReminder] Voice playback error:', error);
    }
  };

  // 關閉彈窗
  const handleDismiss = async () => {
    if (voiceIntervalRef.current) {
      clearInterval(voiceIntervalRef.current);
    }

    // 停止 TTS 播報
    try {
      await ttsManager.stop();
      console.log('[HydrationReminder] TTS stopped');
    } catch (error) {
      console.warn('[HydrationReminder] TTS stop failed:', error);
    }

    // 關閉屏幕喚醒
    await notificationWakeupManager.dismissOldestNotification();

    // 釋放原生資源（Android）
    if (Platform.OS === 'android') {
      try {
        await ScreenWakeup.abandonAudioFocus();
        await ScreenWakeup.releaseWakeupLock();
        console.log('[HydrationReminder] Native screen wakeup resources released');
      } catch (error) {
        console.warn('[HydrationReminder] Native resource release failed:', error);
      }
    }

    onDismiss();
  };

  // 確認補給
  const handleConfirm = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await handleDismiss();
    onConfirm();
  };

  // 監聽音量鍵（原生模塊支持）
  useEffect(() => {
    if (!visible) return;

    const handleVolumeKeyDown = async () => {
      console.log('[HydrationReminder] Volume key pressed, dismissing notification');
      await handleDismiss();
    };

    // 集成音量鍵監聽器（Android）
    if (Platform.OS === 'android') {
      try {
        const unsubscribeVolumeKey = ScreenWakeup.onVolumeKeyPressed((keyName: string) => {
          console.log('[HydrationReminder] Volume key pressed:', keyName);
          handleVolumeKeyDown();
        });

        return () => {
          if (unsubscribeVolumeKey) {
            unsubscribeVolumeKey();
          }
        };
      } catch (error) {
        console.warn('[HydrationReminder] Volume key listener setup failed:', error);
      }
    }
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleDismiss}
    >
      <View style={[styles.container, { backgroundColor: 'rgba(0, 0, 0, 0.7)' }]}>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          {/* 標題 */}
          <Text style={[styles.title, { color: colors.foreground }]}>補給提醒</Text>

          {/* 內容 */}
          <Text style={[styles.content, { color: colors.foreground }]}>
            {getHydrationText()}
          </Text>

          {/* 提示文本 */}
          <Text style={[styles.hint, { color: colors.muted }]}>
            按下音量鍵或點擊下方按鈕關閉
          </Text>

          {/* 按鈕 */}
          <View style={styles.buttonContainer}>
            <Pressable
              style={({ pressed }) => [
                styles.button,
                styles.confirmButton,
                { backgroundColor: '#22C55E', opacity: pressed ? 0.8 : 1 },
              ]}
              onPress={handleConfirm}
            >
              <Text style={styles.buttonText}>已補給</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.button,
                styles.dismissButton,
                { backgroundColor: colors.border, opacity: pressed ? 0.8 : 1 },
              ]}
              onPress={handleDismiss}
            >
              <Text style={[styles.buttonText, { color: colors.foreground }]}>關閉</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    borderRadius: 16,
    padding: 24,
    width: '80%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 16 /* internal spacing */,
    textAlign: 'center',
  },
  content: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16 /* internal spacing */,
    textAlign: 'center',
    lineHeight: 28,
  },
  hint: {
    fontSize: 12,
    marginBottom: 24 /* internal spacing */,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmButton: {
    // 綠色確認按鈕
  },
  dismissButton: {
    // 灰色關閉按鈕
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
