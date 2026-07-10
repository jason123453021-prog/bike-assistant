import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/use-colors';

export interface GPSTrackingIndicatorProps {
  isTracking: boolean;
  accuracy?: number; // GPS 精度（公尺）
  speed?: number; // 當前速度（km/h）
  altitude?: number; // 海拔（公尺）
  visible?: boolean;
}

/**
 * 實時 GPS 追蹤指示器組件
 * 
 * 功能：
 * - 顯示 GPS 追蹤狀態
 * - 顯示 GPS 精度
 * - 顯示當前速度和海拔
 * - 動畫效果指示追蹤活躍狀態
 */
export function GPSTrackingIndicator({
  isTracking,
  accuracy = 0,
  speed = 0,
  altitude = 0,
  visible = true,
}: GPSTrackingIndicatorProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const [signalStrength, setSignalStrength] = useState(0);

  // 脈衝動畫
  useEffect(() => {
    if (isTracking) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            easing: Easing.out(Easing.quad),
            useNativeDriver: false,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0,
            duration: 1000,
            easing: Easing.in(Easing.quad),
            useNativeDriver: false,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(0);
    }
  }, [isTracking, pulseAnim]);

  // 根據精度計算信號強度
  useEffect(() => {
    if (accuracy <= 5) {
      setSignalStrength(4); // 優秀
    } else if (accuracy <= 10) {
      setSignalStrength(3); // 良好
    } else if (accuracy <= 20) {
      setSignalStrength(2); // 中等
    } else if (accuracy <= 50) {
      setSignalStrength(1); // 弱
    } else {
      setSignalStrength(0); // 無信號
    }
  }, [accuracy]);

  if (!visible) {
    return null;
  }

  const pulseScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.2],
  });

  const pulseOpacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.8, 0.2],
  });

  return (
    <View
      style={[
        styles.container,
        {
          top: insets.top + 16,
          left: 16,
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
      ]}
    >
      {/* 脈衝圓圈 */}
      {isTracking && (
        <Animated.View
          style={[
            styles.pulse,
            {
              transform: [{ scale: pulseScale }],
              opacity: pulseOpacity,
              backgroundColor: colors.primary,
            },
          ]}
        />
      )}

      {/* 主容器 */}
      <View style={styles.content}>
        {/* GPS 狀態指示 */}
        <View style={styles.statusRow}>
          <View
            style={[
              styles.statusDot,
              {
                backgroundColor: isTracking ? colors.success : colors.muted,
              },
            ]}
          />
          <Text
            style={[
              styles.statusText,
              { color: isTracking ? colors.success : colors.muted },
            ]}
          >
            {isTracking ? 'GPS 追蹤中' : 'GPS 未連接'}
          </Text>
        </View>

        {/* 信號強度 */}
        <View style={styles.signalRow}>
          {[0, 1, 2, 3].map((bar) => (
            <View
              key={`signal-${bar}`}
              style={[
                styles.signalBar,
                {
                  height: 4 + bar * 2,
                  backgroundColor: bar < signalStrength ? colors.primary : colors.border,
                },
              ]}
            />
          ))}
          <Text style={[styles.accuracyText, { color: colors.muted }]}>
            ±{accuracy.toFixed(0)}m
          </Text>
        </View>

        {/* 速度和海拔 */}
        {isTracking && (
          <View style={styles.dataRow}>
            <View style={styles.dataItem}>
              <Text style={[styles.dataLabel, { color: colors.muted }]}>速度</Text>
              <Text style={[styles.dataValue, { color: colors.foreground }]}>
                {speed.toFixed(1)} km/h
              </Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.dataItem}>
              <Text style={[styles.dataLabel, { color: colors.muted }]}>海拔</Text>
              <Text style={[styles.dataValue, { color: colors.foreground }]}>
                {altitude.toFixed(0)} m
              </Text>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    minWidth: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  pulse: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    top: 6,
    right: 6,
  },
  content: {
    gap: 8,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  signalRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
  },
  signalBar: {
    width: 3,
    borderRadius: 1.5,
  },
  accuracyText: {
    fontSize: 11,
    marginLeft: 6,
  },
  dataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  dataItem: {
    flex: 1,
    alignItems: 'center',
  },
  dataLabel: {
    fontSize: 10,
    marginBottom: 2,
  },
  dataValue: {
    fontSize: 12,
    fontWeight: '600',
  },
  divider: {
    width: 1,
    height: 20,
    backgroundColor: '#e0e0e0',
    marginHorizontal: 8,
  },
});
