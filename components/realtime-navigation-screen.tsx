import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { ScreenContainer } from './screen-container';
import { useRealtimeNavigation } from '@/hooks/use-realtime-navigation';
import { useVoiceTurnNotification } from './voice-turn-notification-provider';
import { type NavigationRoute, type NavigationEvent } from '@/lib/realtime-navigation-manager';
import { cn } from '@/lib/utils';

export interface RealtimeNavigationScreenProps {
  route: NavigationRoute;
  onNavigationComplete?: () => void;
}

/**
 * 實時導航屏幕
 * 展示實時 GPS 位置追蹤和語音提示集成
 */
export function RealtimeNavigationScreen({
  route,
  onNavigationComplete,
}: RealtimeNavigationScreenProps) {
  const { startNavigation, stopNavigation, state } = useRealtimeNavigation({
    onEvent: handleNavigationEvent,
  });

  const { getConfig } = useVoiceTurnNotification();
  const [isNavigating, setIsNavigating] = useState(false);
  const [lastEvent, setLastEvent] = useState<NavigationEvent | null>(null);
  const [eventHistory, setEventHistory] = useState<NavigationEvent[]>([]);

  function handleNavigationEvent(event: NavigationEvent) {
    setLastEvent(event);
    setEventHistory((prev) => [...prev.slice(-9), event]); // 保留最近 10 個事件
  }

  const handleStartNavigation = async () => {
    try {
      setIsNavigating(true);
      await startNavigation(route);
    } catch (error) {
      console.error('[RealtimeNavigationScreen] Error starting navigation:', error);
      setIsNavigating(false);
    }
  };

  const handleStopNavigation = async () => {
    try {
      await stopNavigation();
      setIsNavigating(false);
      if (onNavigationComplete) {
        onNavigationComplete();
      }
    } catch (error) {
      console.error('[RealtimeNavigationScreen] Error stopping navigation:', error);
    }
  };

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${minutes}:${String(secs).padStart(2, '0')}`;
  };

  const formatDistance = (meters: number): string => {
    if (meters < 1000) {
      return `${Math.round(meters)} m`;
    }
    return `${(meters / 1000).toFixed(1)} km`;
  };

  const formatSpeed = (mps: number): string => {
    const kmh = mps * 3.6;
    return `${kmh.toFixed(1)} km/h`;
  };

  const getEventColor = (type: string): string => {
    switch (type) {
      case 'approaching-turn':
        return 'text-blue-600';
      case 'immediate-turn':
        return 'text-orange-600';
      case 'off-route':
        return 'text-red-600';
      case 'back-on-route':
        return 'text-green-600';
      case 'step-completed':
        return 'text-purple-600';
      default:
        return 'text-gray-600';
    }
  };

  const getEventLabel = (type: string): string => {
    switch (type) {
      case 'approaching-turn':
        return '接近轉彎';
      case 'immediate-turn':
        return '立即轉彎';
      case 'off-route':
        return '偏離路線';
      case 'back-on-route':
        return '返回路線';
      case 'step-completed':
        return '步驟完成';
      default:
        return type;
    }
  };

  return (
    <ScreenContainer className="p-4">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="gap-4">
        {/* 標題 */}
        <View className="gap-2">
          <Text className="text-2xl font-bold text-foreground">實時導航</Text>
          <Text className="text-sm text-muted">
            GPS 位置追蹤 + 語音提示集成
          </Text>
        </View>

        {/* 主要狀態卡片 */}
        <View className="bg-surface rounded-lg p-4 gap-4 border border-border">
          {/* 導航狀態 */}
          <View className="gap-2">
            <View className="flex-row items-center justify-between">
              <Text className="text-sm font-semibold text-muted">導航狀態</Text>
              <View
                className={cn(
                  'px-3 py-1 rounded-full',
                  isNavigating ? 'bg-green-100' : 'bg-gray-100'
                )}
              >
                <Text
                  className={cn(
                    'text-xs font-semibold',
                    isNavigating ? 'text-green-700' : 'text-gray-700'
                  )}
                >
                  {isNavigating ? '進行中' : '已停止'}
                </Text>
              </View>
            </View>
          </View>

          {/* 位置信息 */}
          {state.currentLocation && (
            <View className="gap-2 border-t border-border pt-3">
              <Text className="text-xs font-semibold text-muted">當前位置</Text>
              <Text className="text-sm font-mono text-foreground">
                {state.currentLocation[0].toFixed(6)}, {state.currentLocation[1].toFixed(6)}
              </Text>
            </View>
          )}

          {/* 距離信息 */}
          <View className="gap-3 border-t border-border pt-3">
            <View className="flex-row justify-between">
              <View className="flex-1">
                <Text className="text-xs text-muted mb-1">距離下一轉彎</Text>
                <Text className="text-lg font-bold text-foreground">
                  {formatDistance(state.distanceToNextTurn)}
                </Text>
              </View>
              <View className="flex-1">
                <Text className="text-xs text-muted mb-1">已騎行距離</Text>
                <Text className="text-lg font-bold text-foreground">
                  {formatDistance(state.totalDistanceTraveled)}
                </Text>
              </View>
            </View>
          </View>

          {/* 速度和時間 */}
          <View className="gap-3 border-t border-border pt-3">
            <View className="flex-row justify-between">
              <View className="flex-1">
                <Text className="text-xs text-muted mb-1">當前速度</Text>
                <Text className="text-lg font-bold text-foreground">
                  {formatSpeed(state.currentSpeed)}
                </Text>
              </View>
              <View className="flex-1">
                <Text className="text-xs text-muted mb-1">平均速度</Text>
                <Text className="text-lg font-bold text-foreground">
                  {formatSpeed(state.averageSpeed)}
                </Text>
              </View>
              <View className="flex-1">
                <Text className="text-xs text-muted mb-1">已用時間</Text>
                <Text className="text-lg font-bold text-foreground">
                  {formatTime(state.elapsedTime)}
                </Text>
              </View>
            </View>
          </View>

          {/* 預計到達時間 */}
          <View className="gap-2 border-t border-border pt-3">
            <Text className="text-xs text-muted">預計到達時間</Text>
            <Text className="text-lg font-bold text-foreground">
              {formatTime(state.eta)}
            </Text>
          </View>

          {/* 進度 */}
          <View className="gap-2 border-t border-border pt-3">
            <View className="flex-row items-center justify-between">
              <Text className="text-xs text-muted">進度</Text>
              <Text className="text-xs font-semibold text-foreground">
                {state.currentStepIndex + 1} / {state.totalSteps}
              </Text>
            </View>
            <View className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <View
                className="h-full bg-primary"
                style={{
                  width: `${((state.currentStepIndex + 1) / state.totalSteps) * 100}%`,
                }}
              />
            </View>
          </View>

          {/* 偏離路線警告 */}
          {state.isOffRoute && (
            <View className="gap-2 border-t border-border pt-3 bg-red-50 p-3 rounded border border-red-200">
              <Text className="text-sm font-bold text-red-700">⚠️ 偏離路線</Text>
              <Text className="text-xs text-red-600">
                距離路線 {formatDistance(state.offRouteDistance)}
              </Text>
            </View>
          )}
        </View>

        {/* 控制按鈕 */}
        <View className="gap-2">
          <Pressable
            onPress={handleStartNavigation}
            disabled={isNavigating}
            className={cn(
              'py-3 px-4 rounded-lg',
              isNavigating ? 'bg-muted opacity-50' : 'bg-primary'
            )}
            style={({ pressed }) => [pressed && { opacity: 0.8 }]}
          >
            <Text className="text-center font-semibold text-background">
              {isNavigating ? '導航進行中...' : '開始導航'}
            </Text>
          </Pressable>

          <Pressable
            onPress={handleStopNavigation}
            disabled={!isNavigating}
            className={cn(
              'py-3 px-4 rounded-lg',
              !isNavigating ? 'bg-muted opacity-50' : 'bg-error'
            )}
            style={({ pressed }) => [pressed && { opacity: 0.8 }]}
          >
            <Text className="text-center font-semibold text-background">
              停止導航
            </Text>
          </Pressable>
        </View>

        {/* 事件歷史 */}
        <View className="bg-surface rounded-lg p-4 gap-2 border border-border">
          <Text className="text-base font-semibold text-foreground">事件歷史</Text>
          {eventHistory.length === 0 ? (
            <Text className="text-sm text-muted">暫無事件</Text>
          ) : (
            <View className="gap-2">
              {eventHistory.map((event, index) => (
                <View key={index} className="flex-row items-start gap-2 p-2 bg-background rounded">
                  <View className="flex-1">
                    <Text className={cn('text-xs font-semibold', getEventColor(event.type))}>
                      {getEventLabel(event.type)}
                    </Text>
                    <Text className="text-xs text-muted mt-1">
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* 使用說明 */}
        <View className="bg-blue-50 rounded-lg p-4 gap-2 border border-blue-200">
          <Text className="text-sm font-semibold text-blue-900">📍 使用說明</Text>
          <View className="gap-1">
            <Text className="text-xs text-blue-800">
              • 點擊「開始導航」開始實時位置追蹤
            </Text>
            <Text className="text-xs text-blue-800">
              • 系統會根據 GPS 位置自動觸發語音提示
            </Text>
            <Text className="text-xs text-blue-800">
              • 接近轉彎（300 米）和立即轉彎（50 米）時會播放提醒
            </Text>
            <Text className="text-xs text-blue-800">
              • 偏離路線時會收到警告提示
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
