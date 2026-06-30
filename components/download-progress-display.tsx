import React, { useState } from 'react';
import { View, Text, Pressable, Modal, ActivityIndicator } from 'react-native';

export interface DownloadProgress {
  id: string;
  name: string;
  type: 'map' | 'voice'; // 地圖或語音
  current: number;
  total: number;
  status: 'downloading' | 'completed' | 'failed' | 'paused';
  speed?: number; // 字節/秒
  timeRemaining?: number; // 秒
}

export interface DownloadProgressDisplayProps {
  downloads: DownloadProgress[];
  onPause?: (id: string) => void;
  onResume?: (id: string) => void;
  onCancel?: (id: string) => void;
  onRetry?: (id: string) => void;
}

/**
 * 下載進度顯示組件
 * 顯示地圖和語音包的下載進度
 */
export function DownloadProgressDisplay({
  downloads,
  onPause,
  onResume,
  onCancel,
  onRetry,
}: DownloadProgressDisplayProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const formatSpeed = (bytesPerSecond: number): string => {
    return formatBytes(bytesPerSecond) + '/s';
  };

  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${Math.round(seconds)}秒`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}分鐘`;
    return `${Math.round(seconds / 3600)}小時`;
  };

  const getProgressPercentage = (download: DownloadProgress): number => {
    if (download.total === 0) return 0;
    return (download.current / download.total) * 100;
  };

  const getStatusColor = (status: DownloadProgress['status']): string => {
    switch (status) {
      case 'downloading':
        return 'bg-primary';
      case 'completed':
        return 'bg-success';
      case 'failed':
        return 'bg-error';
      case 'paused':
        return 'bg-warning';
      default:
        return 'bg-muted';
    }
  };

  const getStatusText = (status: DownloadProgress['status']): string => {
    switch (status) {
      case 'downloading':
        return '下載中';
      case 'completed':
        return '已完成';
      case 'failed':
        return '失敗';
      case 'paused':
        return '已暫停';
      default:
        return '未知';
    }
  };

  if (downloads.length === 0) {
    return null;
  }

  return (
    <View className="bg-surface rounded-2xl p-4 border border-border">
      <Text className="text-lg font-semibold text-foreground mb-4">下載進度</Text>

      {downloads.map((download) => {
        const isExpanded = expandedId === download.id;
        const percentage = getProgressPercentage(download);

        return (
          <Pressable
            key={download.id}
            onPress={() => setExpandedId(isExpanded ? null : download.id)}
            className="mb-4 last:mb-0"
          >
            {/* 下載項目摘要 */}
            <View className="bg-background rounded-lg p-3 mb-2">
              {/* 標題和狀態 */}
              <View className="flex-row justify-between items-center mb-2">
                <View className="flex-1">
                  <Text className="text-foreground font-semibold text-sm">{download.name}</Text>
                  <Text className="text-muted text-xs mt-1">
                    {download.type === 'map' ? '地圖瓦片' : '語音包'}
                  </Text>
                </View>
                <View
                  className={`px-2 py-1 rounded ${getStatusColor(download.status)}`}
                >
                  <Text className="text-white text-xs font-semibold">
                    {getStatusText(download.status)}
                  </Text>
                </View>
              </View>

              {/* 進度條 */}
              <View className="bg-border rounded-full h-2 mb-2 overflow-hidden">
                <View
                  className={getStatusColor(download.status)}
                  style={{
                    width: `${Math.min(percentage, 100)}%`,
                  }}
                />
              </View>

              {/* 進度信息 */}
              <View className="flex-row justify-between items-center">
                <Text className="text-muted text-xs">
                  {formatBytes(download.current)} / {formatBytes(download.total)}
                </Text>
                <Text className="text-foreground text-xs font-semibold">
                  {Math.round(percentage)}%
                </Text>
              </View>
            </View>

            {/* 展開的詳細信息 */}
            {isExpanded && (
              <View className="bg-background rounded-lg p-3 mb-2">
                {/* 詳細統計 */}
                {download.speed && (
                  <View className="flex-row justify-between mb-2">
                    <Text className="text-muted text-xs">下載速度</Text>
                    <Text className="text-foreground text-xs font-semibold">
                      {formatSpeed(download.speed)}
                    </Text>
                  </View>
                )}

                {download.timeRemaining && download.status === 'downloading' && (
                  <View className="flex-row justify-between mb-3">
                    <Text className="text-muted text-xs">預計剩餘時間</Text>
                    <Text className="text-foreground text-xs font-semibold">
                      {formatTime(download.timeRemaining)}
                    </Text>
                  </View>
                )}

                {/* 操作按鈕 */}
                <View className="flex-row gap-2">
                  {download.status === 'downloading' && onPause && (
                    <Pressable
                      onPress={() => onPause(download.id)}
                      className="flex-1 bg-warning/10 px-3 py-2 rounded active:opacity-70"
                    >
                      <Text className="text-warning text-center text-xs font-semibold">暫停</Text>
                    </Pressable>
                  )}

                  {download.status === 'paused' && onResume && (
                    <Pressable
                      onPress={() => onResume(download.id)}
                      className="flex-1 bg-primary/10 px-3 py-2 rounded active:opacity-70"
                    >
                      <Text className="text-primary text-center text-xs font-semibold">繼續</Text>
                    </Pressable>
                  )}

                  {download.status === 'failed' && onRetry && (
                    <Pressable
                      onPress={() => onRetry(download.id)}
                      className="flex-1 bg-primary/10 px-3 py-2 rounded active:opacity-70"
                    >
                      <Text className="text-primary text-center text-xs font-semibold">重試</Text>
                    </Pressable>
                  )}

                  {(download.status === 'downloading' || download.status === 'paused') &&
                    onCancel && (
                      <Pressable
                        onPress={() => onCancel(download.id)}
                        className="flex-1 bg-error/10 px-3 py-2 rounded active:opacity-70"
                      >
                        <Text className="text-error text-center text-xs font-semibold">取消</Text>
                      </Pressable>
                    )}
                </View>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}
