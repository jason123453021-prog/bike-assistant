import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, Switch, ActivityIndicator } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { OfflineModeIndicator } from '@/components/offline-mode-indicator';
import { CacheManagementPanel } from '@/components/cache-management-panel';
import { DownloadProgressDisplay, type DownloadProgress } from '@/components/download-progress-display';
import { getNetworkStatusMonitor, type NetworkState } from '@/lib/network-status-monitor';
import { getOfflineMapCacheManager } from '@/lib/offline-map-cache-manager';
import { getOfflineVoicePackageManager } from '@/lib/offline-voice-package-manager';

/**
 * 離線設置屏幕
 * 集成離線模式指示器、快取管理和下載進度
 */
export function OfflineSettingsScreen() {
  const [networkState, setNetworkState] = useState<NetworkState | null>(null);
  const [autoDownload, setAutoDownload] = useState(true);
  const [downloads, setDownloads] = useState<DownloadProgress[]>([]);
  const [showCachePanel, setShowCachePanel] = useState(false);

  useEffect(() => {
    const monitor = getNetworkStatusMonitor();

    const unsubscribe = monitor.subscribe((state) => {
      setNetworkState(state);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleToggleAutoDownload = (value: boolean) => {
    setAutoDownload(value);
    // 保存設置到 AsyncStorage
  };

  const handleDownloadMaps = async () => {
    try {
      // 模擬下載進度
      const download: DownloadProgress = {
        id: 'map-download-' + Date.now(),
        name: '台北市地圖',
        type: 'map',
        current: 0,
        total: 100 * 1024 * 1024, // 100 MB
        status: 'downloading',
        speed: 5 * 1024 * 1024, // 5 MB/s
        timeRemaining: 20,
      };

      setDownloads([...downloads, download]);

      // 實際下載邏輯
      const mapManager = getOfflineMapCacheManager();
      await mapManager.downloadTilesForRegion(
        {
          minLat: 25.0,
          maxLat: 25.1,
          minLon: 121.5,
          maxLon: 121.6,
        },
        [12, 13, 14, 15],
        'osm',
        (current, total) => {
          setDownloads((prev) =>
            prev.map((d) =>
              d.id === download.id
                ? {
                    ...d,
                    current,
                    total,
                    status: current === total ? 'completed' : 'downloading',
                  }
                : d
            )
          );
        }
      );
    } catch (error) {
      console.error('[OfflineSettingsScreen] Error downloading maps:', error);
      setDownloads((prev) =>
        prev.map((d) =>
          d.type === 'map' && d.status === 'downloading'
            ? { ...d, status: 'failed' }
            : d
        )
      );
    }
  };

  const handleDownloadVoices = async () => {
    try {
      // 模擬下載進度
      const download: DownloadProgress = {
        id: 'voice-download-' + Date.now(),
        name: '繁體中文語音包',
        type: 'voice',
        current: 0,
        total: 50 * 1024 * 1024, // 50 MB
        status: 'downloading',
        speed: 2 * 1024 * 1024, // 2 MB/s
        timeRemaining: 25,
      };

      setDownloads([...downloads, download]);

      // 實際下載邏輯
      const voiceManager = getOfflineVoicePackageManager();
      await voiceManager.downloadVoicePackage(
        'voice-zh-tw',
        'zh-TW',
        'https://example.com/voice-packages/zh-tw.zip',
        (current, total) => {
          setDownloads((prev) =>
            prev.map((d) =>
              d.id === download.id
                ? {
                    ...d,
                    current,
                    total,
                    status: current === total ? 'completed' : 'downloading',
                  }
                : d
            )
          );
        }
      );
    } catch (error) {
      console.error('[OfflineSettingsScreen] Error downloading voices:', error);
      setDownloads((prev) =>
        prev.map((d) =>
          d.type === 'voice' && d.status === 'downloading'
            ? { ...d, status: 'failed' }
            : d
        )
      );
    }
  };

  return (
    <ScreenContainer className="p-4">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        {/* 標題 */}
        <View className="flex-row justify-between items-center mb-6">
          <Text className="text-2xl font-bold text-foreground">離線設置</Text>
          {networkState && (
            <OfflineModeIndicator onPress={() => setShowCachePanel(!showCachePanel)} />
          )}
        </View>

        {/* 網絡狀態詳情 */}
        {networkState && (
          <View className="bg-surface rounded-2xl p-4 mb-6 border border-border">
            <Text className="text-lg font-semibold text-foreground mb-4">網絡狀態</Text>

            <View className="gap-3">
              <View className="flex-row justify-between">
                <Text className="text-muted">連接狀態</Text>
                <Text className="text-foreground font-semibold">
                  {networkState.isConnected ? '已連接' : '未連接'}
                </Text>
              </View>

              <View className="flex-row justify-between">
                <Text className="text-muted">網絡類型</Text>
                <Text className="text-foreground font-semibold">
                  {networkState.type}
                </Text>
              </View>

              <View className="flex-row justify-between">
                <Text className="text-muted">信號強度</Text>
                <Text className="text-foreground font-semibold">
                  {networkState.signal}%
                </Text>
              </View>

              <View className="flex-row justify-between">
                <Text className="text-muted">互聯網可達</Text>
                <Text className="text-foreground font-semibold">
                  {networkState.isInternetReachable ? '是' : '否'}
                </Text>
              </View>

              <View className="flex-row justify-between">
                <Text className="text-muted">離線模式</Text>
                <Text
                  className={`font-semibold ${
                    networkState.isOfflineMode ? 'text-warning' : 'text-success'
                  }`}
                >
                  {networkState.isOfflineMode ? '已啟用' : '已禁用'}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* 自動下載設置 */}
        <View className="bg-surface rounded-2xl p-4 mb-6 border border-border">
          <View className="flex-row justify-between items-center">
            <View className="flex-1">
              <Text className="text-foreground font-semibold mb-1">自動下載</Text>
              <Text className="text-muted text-sm">
                在 WiFi 連接時自動下載地圖和語音包
              </Text>
            </View>
            <Switch
              value={autoDownload}
              onValueChange={handleToggleAutoDownload}
              trackColor={{ false: '#767577', true: '#81c784' }}
              thumbColor={autoDownload ? '#4caf50' : '#f4f3f4'}
            />
          </View>
        </View>

        {/* 下載進度 */}
        {downloads.length > 0 && (
          <DownloadProgressDisplay
            downloads={downloads}
            onPause={(id) => {
              setDownloads((prev) =>
                prev.map((d) =>
                  d.id === id ? { ...d, status: 'paused' } : d
                )
              );
            }}
            onResume={(id) => {
              setDownloads((prev) =>
                prev.map((d) =>
                  d.id === id ? { ...d, status: 'downloading' } : d
                )
              );
            }}
            onCancel={(id) => {
              setDownloads((prev) => prev.filter((d) => d.id !== id));
            }}
            onRetry={(id) => {
              setDownloads((prev) =>
                prev.map((d) =>
                  d.id === id ? { ...d, status: 'downloading' } : d
                )
              );
            }}
          />
        )}

        {/* 下載按鈕 */}
        <View className="gap-3 my-6">
          <Pressable
            onPress={handleDownloadMaps}
            className="bg-primary px-4 py-3 rounded-lg active:opacity-70"
          >
            <Text className="text-white text-center font-semibold">下載地圖瓦片</Text>
          </Pressable>

          <Pressable
            onPress={handleDownloadVoices}
            className="bg-success px-4 py-3 rounded-lg active:opacity-70"
          >
            <Text className="text-white text-center font-semibold">下載語音包</Text>
          </Pressable>
        </View>

        {/* 快取管理 */}
        {showCachePanel && <CacheManagementPanel />}
      </ScrollView>
    </ScreenContainer>
  );
}
