/**
 * 騎乘頁面
 * 核心騎乘功能、實時數據顯示、補給提醒
 */

import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { getRideSessionIntegration } from '@/lib/integration/ride-session-integration';

interface RideStats {
  distance: number;
  duration: number;
  speed: number;
  calories: number;
  water: number;
  ascent: number;
}

export default function RideScreen() {
  const colors = useColors();
  const [isRiding, setIsRiding] = useState(false);
  const [stats, setStats] = useState<RideStats>({
    distance: 0,
    duration: 0,
    speed: 0,
    calories: 0,
    water: 0,
    ascent: 0,
  });

  const rideSessionRef = useRef(getRideSessionIntegration());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 初始化
  useEffect(() => {
    const initializeSession = async () => {
      await rideSessionRef.current.initialize();
    };
    initializeSession();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // 開始騎乘
  const handleStartRide = async () => {
    const success = await rideSessionRef.current.startSession('user-123');
    if (success) {
      setIsRiding(true);
      startStatsUpdate();
    }
  };

  // 結束騎乘
  const handleEndRide = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    const success = await rideSessionRef.current.endSession();
    if (success) {
      setIsRiding(false);
      Alert.alert('騎乘已結束', `總距離: ${stats.distance.toFixed(2)} km`);
    }
  };

  // 更新統計數據
  const startStatsUpdate = () => {
    timerRef.current = setInterval(() => {
      const sessionData = rideSessionRef.current.getSessionData();
      if (sessionData) {
        setStats({
          distance: sessionData.statistics.distance,
          duration: sessionData.statistics.duration,
          speed: 0, // 應從 GPS 計算
          calories: sessionData.statistics.calories,
          water: sessionData.statistics.water,
          ascent: sessionData.statistics.ascent,
        });
      }
    }, 1000);
  };

  // 格式化時間
  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <ScreenContainer className="bg-background">
      <View className="flex-1 justify-center items-center p-4">
        {/* 大型數據顯示 */}
        <View className="bg-surface rounded-2xl p-8 w-full mb-6">
          {/* 距離 */}
          <View className="items-center mb-6">
            <Text className="text-muted text-sm mb-2">距離</Text>
            <Text className="text-5xl font-bold text-primary">
              {stats.distance.toFixed(2)}
            </Text>
            <Text className="text-muted text-sm">km</Text>
          </View>

          {/* 時間 */}
          <View className="items-center mb-6">
            <Text className="text-muted text-sm mb-2">時間</Text>
            <Text className="text-4xl font-bold text-foreground font-mono">
              {formatTime(stats.duration)}
            </Text>
          </View>

          {/* 速度 */}
          <View className="items-center mb-6">
            <Text className="text-muted text-sm mb-2">即時速度</Text>
            <Text className="text-3xl font-bold text-foreground">
              {stats.speed.toFixed(1)}
            </Text>
            <Text className="text-muted text-sm">km/h</Text>
          </View>
        </View>

        {/* 副數據 */}
        <View className="flex-row gap-4 w-full mb-6">
          {/* 卡路里 */}
          <View className="flex-1 bg-surface rounded-lg p-4">
            <Text className="text-muted text-xs mb-2">卡路里</Text>
            <Text className="text-2xl font-bold text-foreground">
              {Math.round(stats.calories)}
            </Text>
            <Text className="text-muted text-xs">kcal</Text>
          </View>

          {/* 爬升 */}
          <View className="flex-1 bg-surface rounded-lg p-4">
            <Text className="text-muted text-xs mb-2">爬升</Text>
            <Text className="text-2xl font-bold text-foreground">
              {Math.round(stats.ascent)}
            </Text>
            <Text className="text-muted text-xs">m</Text>
          </View>

          {/* 水分 */}
          <View className="flex-1 bg-surface rounded-lg p-4">
            <Text className="text-muted text-xs mb-2">水分</Text>
            <Text className="text-2xl font-bold text-foreground">
              {Math.round(stats.water)}
            </Text>
            <Text className="text-muted text-xs">ml</Text>
          </View>
        </View>

        {/* 控制按鈕 */}
        <View className="flex-row gap-4 w-full">
          {!isRiding ? (
            <TouchableOpacity
              onPress={handleStartRide}
              className="flex-1 bg-primary rounded-lg py-4"
            >
              <Text className="text-background font-bold text-center text-lg">
                開始騎乘
              </Text>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity
                onPress={handleEndRide}
                className="flex-1 bg-error rounded-lg py-4"
              >
                <Text className="text-background font-bold text-center text-lg">
                  結束騎乘
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </ScreenContainer>
  );
}
