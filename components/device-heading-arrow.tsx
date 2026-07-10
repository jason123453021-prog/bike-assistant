import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { Gyroscope } from 'expo-sensors';
import { useColors } from '@/hooks/use-colors';

interface DeviceHeadingArrowProps {
  size?: number; // 箭頭大小（像素）
  showCompass?: boolean; // 是否顯示羅盤
}

/**
 * 手機朝向箭頭組件
 * 
 * 功能：
 * - 基於設備陀螺儀和加速度計顯示手機朝向
 * - 實時更新箭頭方向
 * - 支持羅盤顯示
 */
export function DeviceHeadingArrow({
  size = 60,
  showCompass = true,
}: DeviceHeadingArrowProps) {
  const colors = useColors();
  const [heading, setHeading] = useState(0);
  const [rotationAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    // 設置陀螺儀更新頻率
    Gyroscope.setUpdateInterval(100);

    // 監聽陀螺儀數據
    const subscription = Gyroscope.addListener(({ x, y, z }) => {
      // 計算設備朝向（簡化計算）
      // 實際應用中應使用加速度計和磁力計進行更精確的計算
      const newHeading = (heading + z * 10) % 360;
      setHeading(newHeading);

      // 更新旋轉動畫
      Animated.timing(rotationAnim, {
        toValue: newHeading,
        duration: 100,
        useNativeDriver: false,
      }).start();
    });

    return () => {
      subscription.remove();
    };
  }, [heading, rotationAnim]);

  const rotation = rotationAnim.interpolate({
    inputRange: [0, 360],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {showCompass && (
        <View style={[styles.compass, { width: size, height: size }]}>
          {/* 羅盤背景 */}
          <View style={[styles.compassCircle, { width: size, height: size }]}>
            {/* 方向標記 */}
            <View style={styles.directionMarker}>
              <View style={styles.northMarker} />
            </View>
            <View style={[styles.directionMarker, { transform: [{ rotate: '90deg' }] }]}>
              <View style={styles.eastMarker} />
            </View>
            <View style={[styles.directionMarker, { transform: [{ rotate: '180deg' }] }]}>
              <View style={styles.southMarker} />
            </View>
            <View style={[styles.directionMarker, { transform: [{ rotate: '270deg' }] }]}>
              <View style={styles.westMarker} />
            </View>
          </View>
        </View>
      )}

      {/* 箭頭 */}
      <Animated.View
        style={[
          styles.arrow,
          {
            width: size * 0.6,
            height: size * 0.6,
            transform: [{ rotate: rotation }],
          },
        ]}
      >
        <View
          style={[
            styles.arrowHead,
            {
              borderLeftColor: 'transparent',
              borderRightColor: 'transparent',
              borderBottomColor: colors.primary,
              borderLeftWidth: (size * 0.6) / 4,
              borderRightWidth: (size * 0.6) / 4,
              borderBottomWidth: (size * 0.6) / 2,
            },
          ]}
        />
        <View
          style={[
            styles.arrowTail,
            {
              width: (size * 0.6) / 5,
              height: (size * 0.6) / 2,
              backgroundColor: colors.primary,
            },
          ]}
        />
      </Animated.View>

      {/* 中心圓點 */}
      <View
        style={[
          styles.center,
          {
            width: size * 0.15,
            height: size * 0.15,
            backgroundColor: colors.primary,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  compass: {
    position: 'absolute',
    borderRadius: 9999,
    borderWidth: 2,
    borderColor: '#CCCCCC',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  compassCircle: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  directionMarker: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  northMarker: {
    width: 2,
    height: '20%',
    backgroundColor: '#FF0000',
    marginTop: '5%',
  },
  eastMarker: {
    width: 2,
    height: '15%',
    backgroundColor: '#000000',
    marginTop: '5%',
  },
  southMarker: {
    width: 2,
    height: '15%',
    backgroundColor: '#000000',
    marginTop: '5%',
  },
  westMarker: {
    width: 2,
    height: '15%',
    backgroundColor: '#000000',
    marginTop: '5%',
  },
  arrow: {
    position: 'absolute',
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  arrowHead: {
    width: 0,
    height: 0,
  },
  arrowTail: {
    marginTop: 2,
  },
  center: {
    position: 'absolute',
    borderRadius: 9999,
    zIndex: 10,
  },
});
