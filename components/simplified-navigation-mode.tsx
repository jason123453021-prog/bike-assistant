import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Dimensions } from 'react-native';
import { useColors } from '@/hooks/use-colors';

export interface SimplifiedNavigationModeProps {
  isActive: boolean;
  remainingDistance: number; // 剩餘距離（公里）
  currentSpeed: number; // 當前速度（km/h）
  totalDistance: number; // 總距離（公里）
  currentTime: string; // 當前時間
  turnDirection?: 'left' | 'right' | 'straight' | 'uturn'; // 轉向方向
  displayFields?: Array<'distance' | 'speed' | 'time' | 'direction' | 'elevation' | 'power'>; // 可顯示的欄位
  onExit?: () => void;
}

/**
 * 精簡導航模式組件
 * 
 * 功能：
 * - 戶外強光下的高對比黑白顯示
 * - 核心顯示剩餘距離、時速、總距離、當前時間
 * - 可配置的顯示欄位
 * - 點擊螢幕退出精簡模式
 */
export function SimplifiedNavigationMode({
  isActive,
  remainingDistance,
  currentSpeed,
  totalDistance,
  currentTime,
  turnDirection = 'straight',
  displayFields = ['distance', 'speed', 'time'],
  onExit,
}: SimplifiedNavigationModeProps) {
  const colors = useColors();
  const screenWidth = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;

  // 獲取轉向箭頭
  const getTurnArrow = (direction: string): string => {
    switch (direction) {
      case 'left':
        return '↙';
      case 'right':
        return '↘';
      case 'uturn':
        return '↻';
      default:
        return '↑';
    }
  };

  // 計算字體大小（基於螢幕尺寸）
  const calculateFontSize = (baseSize: number) => {
    return baseSize * (screenWidth / 375); // 基準螢幕寬度 375
  };

  if (!isActive) {
    return null;
  }

  return (
    <Pressable
      style={[
        styles.container,
        {
          width: screenWidth,
          height: screenHeight,
          backgroundColor: '#000000',
        },
      ]}
      onPress={onExit}
    >
      {/* 主要信息區域 */}
      <View style={styles.mainContent}>
        {/* 轉向指示 */}
        <Text
          style={[
            styles.turnArrow,
            {
              fontSize: calculateFontSize(80),
              color: '#ffffff',
            },
          ]}
        >
          {getTurnArrow(turnDirection)}
        </Text>

        {/* 剩餘距離 */}
        {displayFields.includes('distance') && (
          <View style={styles.dataBlock}>
            <Text
              style={[
                styles.dataValue,
                {
                  fontSize: calculateFontSize(64),
                  color: '#ffffff',
                },
              ]}
            >
              {remainingDistance.toFixed(1)}
            </Text>
            <Text
              style={[
                styles.dataUnit,
                {
                  fontSize: calculateFontSize(24),
                  color: '#cccccc',
                },
              ]}
            >
              km
            </Text>
          </View>
        )}

        {/* 當前速度 */}
        {displayFields.includes('speed') && (
          <View style={styles.dataBlock}>
            <Text
              style={[
                styles.dataValue,
                {
                  fontSize: calculateFontSize(48),
                  color: '#ffffff',
                },
              ]}
            >
              {currentSpeed.toFixed(1)}
            </Text>
            <Text
              style={[
                styles.dataUnit,
                {
                  fontSize: calculateFontSize(16),
                  color: '#cccccc',
                },
              ]}
            >
              km/h
            </Text>
          </View>
        )}
      </View>

      {/* 底部信息欄 */}
      <View
        style={[
          styles.bottomBar,
          {
            backgroundColor: '#1a1a1a',
            borderTopColor: '#333333',
          },
        ]}
      >
        {/* 當前時間 */}
        {displayFields.includes('time') && (
          <View style={styles.bottomItem}>
            <Text
              style={[
                styles.bottomLabel,
                {
                  fontSize: calculateFontSize(12),
                  color: '#999999',
                },
              ]}
            >
              時間
            </Text>
            <Text
              style={[
                styles.bottomValue,
                {
                  fontSize: calculateFontSize(20),
                  color: '#ffffff',
                },
              ]}
            >
              {currentTime}
            </Text>
          </View>
        )}

        {/* 總距離 */}
        <View style={styles.bottomItem}>
          <Text
            style={[
              styles.bottomLabel,
              {
                fontSize: calculateFontSize(12),
                color: '#999999',
              },
            ]}
          >
            總距
          </Text>
          <Text
            style={[
              styles.bottomValue,
              {
                fontSize: calculateFontSize(20),
                color: '#ffffff',
              },
            ]}
          >
            {totalDistance.toFixed(1)} km
          </Text>
        </View>

        {/* 退出提示 */}
        <Text
          style={[
            styles.exitHint,
            {
              fontSize: calculateFontSize(12),
              color: '#666666',
            },
          ]}
        >
          點擊螢幕退出
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 1000,
  },
  mainContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
  },
  turnArrow: {
    fontWeight: 'bold',
    textAlign: 'center',
  },
  dataBlock: {
    alignItems: 'center',
    gap: 4,
  },
  dataValue: {
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
  },
  dataUnit: {
    fontWeight: '600',
  },
  bottomBar: {
    width: '100%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bottomItem: {
    alignItems: 'center',
    gap: 4,
  },
  bottomLabel: {
    fontWeight: '500',
  },
  bottomValue: {
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
  },
  exitHint: {
    fontStyle: 'italic',
  },
});
