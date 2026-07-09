/**
 * UI 狀態管理器 - 統一管理加載、錯誤、空狀態
 */

export type UIState = 'idle' | 'loading' | 'success' | 'error' | 'empty';

export interface UIStateConfig {
  state: UIState;
  error?: string;
  message?: string;
  retryable?: boolean;
}

export class UIStateManager {
  /**
   * 創建加載狀態
   */
  static loading(message?: string): UIStateConfig {
    return {
      state: 'loading',
      message: message || '加載中...',
    };
  }

  /**
   * 創建成功狀態
   */
  static success(message?: string): UIStateConfig {
    return {
      state: 'success',
      message: message || '加載成功',
    };
  }

  /**
   * 創建錯誤狀態
   */
  static error(error: string | Error, retryable: boolean = true): UIStateConfig {
    const errorMessage = error instanceof Error ? error.message : error;
    return {
      state: 'error',
      error: errorMessage,
      retryable,
    };
  }

  /**
   * 創建空狀態
   */
  static empty(message?: string): UIStateConfig {
    return {
      state: 'empty',
      message: message || '暫無數據',
    };
  }

  /**
   * 創建空閒狀態
   */
  static idle(): UIStateConfig {
    return {
      state: 'idle',
    };
  }

  /**
   * 判斷是否加載中
   */
  static isLoading(state: UIState): boolean {
    return state === 'loading';
  }

  /**
   * 判斷是否出錯
   */
  static isError(state: UIState): boolean {
    return state === 'error';
  }

  /**
   * 判斷是否為空
   */
  static isEmpty(state: UIState): boolean {
    return state === 'empty';
  }

  /**
   * 判斷是否成功
   */
  static isSuccess(state: UIState): boolean {
    return state === 'success';
  }
}

/**
 * 通用加載狀態 Hook
 */
export function useUIState(initialState: UIState = 'idle') {
  const [state, setState] = React.useState<UIStateConfig>({
    state: initialState,
  });

  const setLoading = (message?: string) => {
    setState(UIStateManager.loading(message));
  };

  const setSuccess = (message?: string) => {
    setState(UIStateManager.success(message));
  };

  const setError = (error: string | Error, retryable?: boolean) => {
    setState(UIStateManager.error(error, retryable));
  };

  const setEmpty = (message?: string) => {
    setState(UIStateManager.empty(message));
  };

  const setIdle = () => {
    setState(UIStateManager.idle());
  };

  return {
    ...state,
    setLoading,
    setSuccess,
    setError,
    setEmpty,
    setIdle,
  };
}

import React from 'react';
