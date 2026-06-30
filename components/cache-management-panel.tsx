import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { getOfflineMapCacheManager } from '@/lib/offline-map-cache-manager';
import { getOfflineVoicePackageManager } from '@/lib/offline-voice-package-manager';
import { ScreenContainer } from '@/components/screen-container';

export interface CacheStats {
  mapCacheSize: number;
  mapTileCount: number;
  voiceCacheSize: number;
  voicePackageCount: number;
  totalSize: number;
  totalCount: number;
}

/**
 * 快取管理面板
 * 顯示地圖和語音包的快取統計信息
 */
export function CacheManagementPanel() {
  const [stats, setStats] = useState<CacheStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    loadCacheStats();
  }, []);

  const loadCacheStats = async () => {
    try {
      setLoading(true);

      const mapManager = getOfflineMapCacheManager();
      const voiceManager = getOfflineVoicePackageManager();

      const mapStats = await mapManager.getCacheStats();
      const voiceStats = await voiceManager.getCacheStats();

      setStats({
        mapCacheSize: mapStats.totalSize,
        mapTileCount: mapStats.tileCount,
        voiceCacheSize: voiceStats.totalSize,
        voicePackageCount: voiceStats.packageCount,
        totalSize: mapStats.totalSize + voiceStats.totalSize,
        totalCount: mapStats.tileCount + voiceStats.packageCount,
      });
    } catch (error) {
      console.error('[CacheManagementPanel] Error loading cache stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const handleClearMapCache = async () => {
    try {
      setClearing(true);
      const mapManager = getOfflineMapCacheManager();
      await mapManager.clearCache();
      await loadCacheStats();
    } catch (error) {
      console.error('[CacheManagementPanel] Error clearing map cache:', error);
    } finally {
      setClearing(false);
    }
  };

  const handleClearVoiceCache = async () => {
    try {
      setClearing(true);
      const voiceManager = getOfflineVoicePackageManager();
      await voiceManager.clearCache();
      await loadCacheStats();
    } catch (error) {
      console.error('[CacheManagementPanel] Error clearing voice cache:', error);
    } finally {
      setClearing(false);
    }
  };

  const handleClearAllCache = async () => {
    try {
      setClearing(true);
      const mapManager = getOfflineMapCacheManager();
      const voiceManager = getOfflineVoicePackageManager();

      await mapManager.clearCache();
      await voiceManager.clearCache();
      await loadCacheStats();
    } catch (error) {
      console.error('[CacheManagementPanel] Error clearing all cache:', error);
    } finally {
      setClearing(false);
    }
  };

  if (loading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color="#0a7ea4" />
      </ScreenContainer>
    );
  }

  if (!stats) {
    return (
      <ScreenContainer className="items-center justify-center">
        <Text className="text-foreground">無法加載快取信息</Text>
      </ScreenContainer>
    );
  }

  const mapCachePercentage = (stats.mapCacheSize / (500 * 1024 * 1024)) * 100;
  const voiceCachePercentage = (stats.voiceCacheSize / (200 * 1024 * 1024)) * 100;

  return (
    <ScreenContainer className="p-4">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        {/* 標題 */}
        <Text className="text-2xl font-bold text-foreground mb-6">快取管理</Text>

        {/* 總快取統計 */}
        <View className="bg-surface rounded-2xl p-4 mb-6 border border-border">
          <Text className="text-lg font-semibold text-foreground mb-3">總快取統計</Text>
          <View className="gap-2">
            <View className="flex-row justify-between">
              <Text className="text-muted">總大小</Text>
              <Text className="text-foreground font-semibold">{formatBytes(stats.totalSize)}</Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-muted">總項目數</Text>
              <Text className="text-foreground font-semibold">{stats.totalCount}</Text>
            </View>
          </View>
        </View>

        {/* 地圖快取 */}
        <View className="bg-surface rounded-2xl p-4 mb-6 border border-border">
          <View className="flex-row justify-between items-center mb-3">
            <Text className="text-lg font-semibold text-foreground">地圖瓦片快取</Text>
            <Text className="text-xs text-muted">{Math.round(mapCachePercentage)}%</Text>
          </View>

          {/* 進度條 */}
          <View className="bg-background rounded-full h-2 mb-3 overflow-hidden">
            <View
              className="bg-primary h-full rounded-full"
              style={{
                width: `${Math.min(mapCachePercentage, 100)}%`,
              }}
            />
          </View>

          <View className="gap-2 mb-4">
            <View className="flex-row justify-between">
              <Text className="text-muted text-sm">大小</Text>
              <Text className="text-foreground text-sm font-semibold">
                {formatBytes(stats.mapCacheSize)} / 500 MB
              </Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-muted text-sm">瓦片數量</Text>
              <Text className="text-foreground text-sm font-semibold">{stats.mapTileCount}</Text>
            </View>
          </View>

          <Pressable
            onPress={handleClearMapCache}
            disabled={clearing}
            className="bg-error/10 px-4 py-2 rounded-lg active:opacity-70"
          >
            <Text className="text-error text-center font-semibold text-sm">
              {clearing ? '清理中...' : '清除地圖快取'}
            </Text>
          </Pressable>
        </View>

        {/* 語音包快取 */}
        <View className="bg-surface rounded-2xl p-4 mb-6 border border-border">
          <View className="flex-row justify-between items-center mb-3">
            <Text className="text-lg font-semibold text-foreground">語音包快取</Text>
            <Text className="text-xs text-muted">{Math.round(voiceCachePercentage)}%</Text>
          </View>

          {/* 進度條 */}
          <View className="bg-background rounded-full h-2 mb-3 overflow-hidden">
            <View
              className="bg-success h-full rounded-full"
              style={{
                width: `${Math.min(voiceCachePercentage, 100)}%`,
              }}
            />
          </View>

          <View className="gap-2 mb-4">
            <View className="flex-row justify-between">
              <Text className="text-muted text-sm">大小</Text>
              <Text className="text-foreground text-sm font-semibold">
                {formatBytes(stats.voiceCacheSize)} / 200 MB
              </Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-muted text-sm">語音包數量</Text>
              <Text className="text-foreground text-sm font-semibold">{stats.voicePackageCount}</Text>
            </View>
          </View>

          <Pressable
            onPress={handleClearVoiceCache}
            disabled={clearing}
            className="bg-error/10 px-4 py-2 rounded-lg active:opacity-70"
          >
            <Text className="text-error text-center font-semibold text-sm">
              {clearing ? '清理中...' : '清除語音快取'}
            </Text>
          </Pressable>
        </View>

        {/* 清除所有快取按鈕 */}
        <Pressable
          onPress={handleClearAllCache}
          disabled={clearing}
          className="bg-error px-4 py-3 rounded-lg active:opacity-70 mb-4"
        >
          <Text className="text-white text-center font-semibold">
            {clearing ? '清理中...' : '清除所有快取'}
          </Text>
        </Pressable>

        {/* 刷新按鈕 */}
        <Pressable
          onPress={loadCacheStats}
          disabled={loading}
          className="bg-primary/10 px-4 py-3 rounded-lg active:opacity-70"
        >
          <Text className="text-primary text-center font-semibold">刷新統計</Text>
        </Pressable>
      </ScrollView>
    </ScreenContainer>
  );
}
