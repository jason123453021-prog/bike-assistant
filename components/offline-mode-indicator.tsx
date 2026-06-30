import React, { useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { getNetworkStatusMonitor, type NetworkState } from '@/lib/network-status-monitor';

export interface OfflineModeIndicatorProps {
  onPress?: () => void;
  className?: string;
}

/**
 * 離線模式狀態指示器
 * 顯示網絡連接狀態、信號強度和離線模式狀態
 */
export function OfflineModeIndicator({ onPress, className }: OfflineModeIndicatorProps) {
  const [networkState, setNetworkState] = useState<NetworkState | null>(null);

  useEffect(() => {
    const monitor = getNetworkStatusMonitor();

    const unsubscribe = monitor.subscribe((state) => {
      setNetworkState(state);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  if (!networkState) {
    return null;
  }

  const getStatusColor = () => {
    if (networkState.isOfflineMode) {
      return 'bg-warning'; // 黃色 - 離線模式
    }
    if (!networkState.isConnected) {
      return 'bg-error'; // 紅色 - 無連接
    }
    if (networkState.signal < 50) {
      return 'bg-warning'; // 黃色 - 信號弱
    }
    return 'bg-success'; // 綠色 - 正常
  };

  const getStatusText = () => {
    if (networkState.isOfflineMode) {
      return '離線模式';
    }
    if (!networkState.isConnected) {
      return '無連接';
    }
    if (networkState.signal < 50) {
      return '信號弱';
    }
    return '在線';
  };

  const getSignalBars = () => {
    const signal = networkState.signal;
    if (signal >= 75) return 4;
    if (signal >= 50) return 3;
    if (signal >= 25) return 2;
    return 1;
  };

  const signalBars = getSignalBars();

  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center gap-2 px-3 py-2 rounded-full ${getStatusColor()} ${className || ''}`}
    >
      {/* 信號強度指示器 */}
      <View className="flex-row items-end gap-0.5">
        {[1, 2, 3, 4].map((bar) => (
          <View
            key={bar}
            className={`rounded-sm ${
              bar <= signalBars ? 'bg-white' : 'bg-white/30'
            }`}
            style={{
              width: 2,
              height: bar * 3,
            }}
          />
        ))}
      </View>

      {/* 狀態文本 */}
      <Text className="text-xs font-semibold text-white">
        {getStatusText()}
      </Text>

      {/* 信號百分比 */}
      <Text className="text-xs text-white/80">
        {networkState.signal}%
      </Text>
    </Pressable>
  );
}
