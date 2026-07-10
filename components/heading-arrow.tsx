import React, { useMemo } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { useColors } from '@/hooks/use-colors';

interface HeadingArrowProps {
  heading: number; // 方向角（0-360 度）
  speed: number; // 速度（km/h）
  size?: number; // 箭頭大小（像素）
}

/**
 * 行徑方向箭頭指示組件
 * 
 * 功能：
 * - 基於 GPS 方向角顯示方向箭頭
 * - 箭頭顏色與大小動態調整（基於速度）
 * - 低速時箭頭變淡，停止時隱藏
 */
export function HeadingArrow({ heading, speed, size = 40 }: HeadingArrowProps) {
  const colors = useColors();

  // 計算箭頭透明度（基於速度）
  const opacity = useMemo(() => {
    if (speed < 1) return 0; // 停止時隱藏
    if (speed < 5) return 0.5; // 低速時變淡
    return 1; // 正常速度
  }, [speed]);

  // 計算箭頭顏色（基於速度）
  const arrowColor = useMemo(() => {
    if (speed < 1) return colors.muted;
    if (speed < 10) return colors.warning;
    if (speed < 20) return colors.primary;
    return colors.success;
  }, [speed, colors]);

  // 計算箭頭大小（基於速度）
  const arrowSize = useMemo(() => {
    const baseSize = size;
    const speedFactor = Math.min(speed / 30, 1.5); // 最多放大 1.5 倍
    return baseSize * (1 + speedFactor * 0.2);
  }, [speed, size]);

  // 獲取方向符號
  const getDirectionSymbol = (heading: number): string => {
    const normalizedHeading = ((heading % 360) + 360) % 360;

    if (normalizedHeading < 22.5 || normalizedHeading >= 337.5) {
      return '↑'; // 北
    } else if (normalizedHeading < 67.5) {
      return '↗'; // 東北
    } else if (normalizedHeading < 112.5) {
      return '→'; // 東
    } else if (normalizedHeading < 157.5) {
      return '↘'; // 東南
    } else if (normalizedHeading < 202.5) {
      return '↓'; // 南
    } else if (normalizedHeading < 247.5) {
      return '↙'; // 西南
    } else if (normalizedHeading < 292.5) {
      return '←'; // 西
    } else {
      return '↖'; // 西北
    }
  };

  return (
    <View
      style={[
        styles.container,
        {
          width: arrowSize,
          height: arrowSize,
          opacity,
        },
      ]}
    >
      <View
        style={[
          styles.arrow,
          {
            transform: [{ rotate: `${heading}deg` }],
          },
        ]}
      >
        <View
          style={[
            styles.arrowHead,
            {
              borderLeftColor: 'transparent',
              borderRightColor: 'transparent',
              borderBottomColor: arrowColor,
              borderLeftWidth: arrowSize / 2,
              borderRightWidth: arrowSize / 2,
              borderBottomWidth: arrowSize * 0.6,
            },
          ]}
        />
        <View
          style={[
            styles.arrowTail,
            {
              width: arrowSize * 0.3,
              height: arrowSize * 0.6,
              backgroundColor: arrowColor,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrow: {
    width: '100%',
    height: '100%',
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
});
