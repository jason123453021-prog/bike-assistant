// 網絡狀態類型定義
export enum NetworkStateType {
  UNKNOWN = 'UNKNOWN',
  NONE = 'NONE',
  CELLULAR = 'CELLULAR',
  WIFI = 'WIFI',
  BLUETOOTH = 'BLUETOOTH',
  ETHERNET = 'ETHERNET',
}

export interface NetworkState {
  isConnected: boolean;
  isInternetReachable: boolean;
  type: NetworkStateType;
  signal: number; // 信號強度 0-100
  isOfflineMode: boolean;
}

export type NetworkStatusListener = (state: NetworkState) => void;

/**
 * 網絡狀態監控器
 * 功能：
 * - 監控網絡連接狀態
 * - 檢測信號強度
 * - 自動切換離線模式
 * - 事件通知
 */
export class NetworkStatusMonitor {
  private state: NetworkState = {
    isConnected: false,
    isInternetReachable: false,
    type: NetworkStateType.UNKNOWN,
    signal: 0,
    isOfflineMode: false,
  };

  private listeners: Set<NetworkStatusListener> = new Set();
  private updateInterval: ReturnType<typeof setInterval> | null = null;
  private readonly SIGNAL_THRESHOLD = 30; // 信號強度低於 30% 時進入離線模式

  /**
   * 初始化網絡監控器
   */
  async initialize(): Promise<void> {
    try {
      // 獲取初始狀態
      await this.updateNetworkState();

      // 開始定期檢查
      this.updateInterval = setInterval(() => {
        this.updateNetworkState();
      }, 5000); // 每 5 秒檢查一次

      console.log('[NetworkStatusMonitor] Initialized');
    } catch (error) {
      console.error('[NetworkStatusMonitor] Initialization error:', error);
      throw error;
    }
  }

  /**
   * 更新網絡狀態
   */
  private async updateNetworkState(): Promise<void> {
    try {
      // 簡化的網絡狀態檢查（實際應使用 expo-network）
      const isConnected = true; // 默認連接
      const isInternetReachable = true; // 默認可達
      const type = NetworkStateType.WIFI; // 默認 WiFi

      const newState: NetworkState = {
        isConnected,
        isInternetReachable,
        type,
        signal: this.calculateSignalStrength(type),
        isOfflineMode: false,
      };

      // 檢查是否應進入離線模式
      if (!newState.isInternetReachable || newState.signal < this.SIGNAL_THRESHOLD) {
        newState.isOfflineMode = true;
      }

      // 檢查狀態是否改變
      if (this.hasStateChanged(this.state, newState)) {
        this.state = newState;
        this.notifyListeners();

        console.log('[NetworkStatusMonitor] Network state changed:', {
          isConnected: newState.isConnected,
          isInternetReachable: newState.isInternetReachable,
          type: newState.type,
          signal: newState.signal,
          isOfflineMode: newState.isOfflineMode,
        });
      }
    } catch (error) {
      console.error('[NetworkStatusMonitor] Error updating network state:', error);
    }
  }

  /**
   * 計算信誤強度
   */
  private calculateSignalStrength(type: NetworkStateType): number {
    // 簡化的信號強度計算
    switch (type) {
      case NetworkStateType.WIFI:
        return 100; // WiFi 最強
      case NetworkStateType.CELLULAR:
        return 70; // 蓮窗網絡
      case NetworkStateType.BLUETOOTH:
        return 50; // 藍牙
      case NetworkStateType.ETHERNET:
        return 100; // 以太網
      case NetworkStateType.UNKNOWN:
        return 0; // 未知
      default:
        return 0;
    }
  }

  /**
   * 檢查狀態是否改變
   */
  private hasStateChanged(oldState: NetworkState, newState: NetworkState): boolean {
    return (
      oldState.isConnected !== newState.isConnected ||
      oldState.isInternetReachable !== newState.isInternetReachable ||
      oldState.type !== newState.type ||
      oldState.isOfflineMode !== newState.isOfflineMode
    );
  }

  /**
   * 獲取當前網絡狀態
   */
  getState(): NetworkState {
    return { ...this.state };
  }

  /**
   * 訂閱網絡狀態變化
   */
  subscribe(listener: NetworkStatusListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * 通知所有監聽者
   */
  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.state);
      } catch (error) {
        console.error('[NetworkStatusMonitor] Error in listener:', error);
      }
    }
  }

  /**
   * 檢查是否應使用離線模式
   */
  shouldUseOfflineMode(): boolean {
    return this.state.isOfflineMode;
  }

  /**
   * 檢查是否有網絡連接
   */
  isOnline(): boolean {
    return this.state.isConnected && this.state.isInternetReachable;
  }

  /**
   * 獲取網絡類型
   */
  getNetworkType(): NetworkStateType {
    return this.state.type;
  }

  /**
   * 銷毀監控器
   */
  destroy(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    this.listeners.clear();
    console.log('[NetworkStatusMonitor] Destroyed');
  }
}

// 全局單例
let monitorInstance: NetworkStatusMonitor | null = null;

export function getNetworkStatusMonitor(): NetworkStatusMonitor {
  if (!monitorInstance) {
    monitorInstance = new NetworkStatusMonitor();
  }
  return monitorInstance;
}
