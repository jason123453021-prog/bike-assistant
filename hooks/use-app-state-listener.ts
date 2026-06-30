import { useEffect, useRef, useCallback } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

export interface AppStateListenerOptions {
  /**
   * 當 App 從背景返回前景時的回調
   */
  onForeground?: () => void;

  /**
   * 當 App 進入背景時的回調
   */
  onBackground?: () => void;

  /**
   * 當 App 狀態改變時的通用回調
   */
  onStateChange?: (state: AppStateStatus) => void;
}

/**
 * AppState 監聽 Hook
 * 用於監聽應用程式前景/背景狀態變化
 *
 * 使用場景：
 * - 返回 App 時重新檢查權限狀態
 * - 進入背景時保存狀態
 * - 位置追蹤的暫停/恢復
 */
export function useAppStateListener(options: AppStateListenerOptions = {}) {
  const { onForeground, onBackground, onStateChange } = options;
  const appState = useRef(AppState.currentState);

  const handleAppStateChange = useCallback(
    (nextAppState: AppStateStatus) => {
      const previousState = appState.current;
      appState.current = nextAppState;

      console.log(
        `[AppStateListener] 應用狀態變化: ${previousState} -> ${nextAppState}`
      );

      // 觸發通用回調
      onStateChange?.(nextAppState);

      // 從背景返回前景
      if (previousState.match(/inactive|background/) && nextAppState === 'active') {
        console.log('[AppStateListener] 應用返回前景');
        onForeground?.();
      }

      // 進入背景
      if (nextAppState.match(/inactive|background/)) {
        console.log('[AppStateListener] 應用進入背景');
        onBackground?.();
      }
    },
    [onForeground, onBackground, onStateChange]
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [handleAppStateChange]);
}

/**
 * 簡化版本：僅監聽前景狀態
 */
export function useAppForegroundListener(callback: () => void) {
  useAppStateListener({
    onForeground: callback,
  });
}

/**
 * 簡化版本：僅監聽背景狀態
 */
export function useAppBackgroundListener(callback: () => void) {
  useAppStateListener({
    onBackground: callback,
  });
}
