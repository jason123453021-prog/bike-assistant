import { useEffect, useRef, useCallback, useState } from 'react';
import { getRealtimeNavigationManager, type NavigationRoute, type NavigationState, type NavigationEvent } from '@/lib/realtime-navigation-manager';

export interface UseRealtimeNavigationOptions {
  onEvent?: (event: NavigationEvent) => void;
}

/**
 * 實時導航 Hook
 * 功能：
 * - 管理實時導航生命週期
 * - 監聽導航事件
 * - 提供導航狀態
 * - 自動清理資源
 */
export function useRealtimeNavigation(options: UseRealtimeNavigationOptions = {}) {
  const { onEvent } = options;

  const managerRef = useRef(getRealtimeNavigationManager());
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const [state, setState] = useState<NavigationState>(managerRef.current.getState());

  // 初始化
  useEffect(() => {
    const initialize = async () => {
      try {
        await managerRef.current.initialize();
      } catch (error) {
        console.error('[useRealtimeNavigation] Initialization error:', error);
      }
    };

    initialize();
  }, []);

  // 訂閱導航事件
  useEffect(() => {
    const handleEvent = (event: NavigationEvent) => {
      // 更新狀態
      setState(managerRef.current.getState());

      // 調用回調
      if (onEvent) {
        onEvent(event);
      }
    };

    unsubscribeRef.current = managerRef.current.subscribe(handleEvent);

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [onEvent]);

  // 清理資源
  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, []);

  // 返回 API
  const startNavigation = useCallback(async (route: NavigationRoute) => {
    await managerRef.current.startNavigation(route);
    setState(managerRef.current.getState());
  }, []);

  const stopNavigation = useCallback(async () => {
    await managerRef.current.stopNavigation();
    setState(managerRef.current.getState());
  }, []);

  const getTrackPoints = useCallback(() => {
    return managerRef.current.getTrackPoints();
  }, []);

  const exportTrackAsGpx = useCallback(() => {
    return managerRef.current.exportTrackAsGpx();
  }, []);

  return {
    startNavigation,
    stopNavigation,
    state,
    getTrackPoints,
    exportTrackAsGpx,
    manager: managerRef.current,
  };
}
