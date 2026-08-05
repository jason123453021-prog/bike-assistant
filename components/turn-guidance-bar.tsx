/**
 * 轉彎提示導航欄組件
 * 
 * 功能：
 * 1. 顯示實時轉彎指令
 * 2. 顯示剩餘距離
 * 3. 深綠色圓角浮動卡片設計
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useColors } from '@/hooks/use-colors';

export interface TurnGuidanceData {
  instruction: string; // 轉彎指令
  streetName: string; // 街道名稱
  distance: number; // 剩餘距離（米）
  icon?: string; // 轉彎圖示（可選）
}

interface TurnGuidanceBarProps {
  data: TurnGuidanceData | null;
  visible?: boolean;
}

/**
 * 格式化距離顯示
 */
function formatDistance(meters: number): string {
  if (meters < 100) {
    return `${Math.round(meters)} m`;
  } else if (meters < 1000) {
    return `${(meters / 100).toFixed(0)}00 m`;
  } else {
    return `${(meters / 1000).toFixed(1)} km`;
  }
}

/**
 * 獲取轉彎圖示符號
 */
function getTurnIcon(instruction: string): string {
  const lower = instruction.toLowerCase();

  if (lower.includes('left')) {
    return '↙';
  } else if (lower.includes('right')) {
    return '↘';
  } else if (lower.includes('straight') || lower.includes('continue')) {
    return '↑';
  } else if (lower.includes('u-turn')) {
    return '↻';
  }

  return '→';
}

/**
 * 轉彎提示導航欄組件
 */
export function TurnGuidanceBar({ data, visible = true }: TurnGuidanceBarProps) {
  const colors = useColors();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          position: 'absolute',
          top: 16,
          left: 16,
          right: 16,
          backgroundColor: '#1B5E20', // 深綠色
          borderRadius: 12,
          paddingHorizontal: 16,
          paddingVertical: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 4,
          elevation: 5,
        },
        iconContainer: {
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: '#2E7D32',
          justifyContent: 'center',
          alignItems: 'center',
        },
        icon: {
          fontSize: 20,
          color: '#FFFFFF',
          fontWeight: 'bold',
        },
        contentContainer: {
          flex: 1,
          gap: 4,
        },
        instruction: {
          fontSize: 14,
          fontWeight: '600',
          color: '#FFFFFF',
        },
        distance: {
          fontSize: 12,
          color: '#C8E6C9',
        },
      }),
    []
  );

  if (!visible || !data) {
    return null;
  }

  const icon = data.icon || getTurnIcon(data.instruction);
  const distanceStr = formatDistance(data.distance);

  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Text style={styles.icon}>{icon}</Text>
      </View>

      <View style={styles.contentContainer}>
        <Text style={styles.instruction} numberOfLines={1}>
          {data.instruction}
        </Text>
        <Text style={styles.distance} numberOfLines={1}>
          {data.streetName} • {distanceStr}
        </Text>
      </View>
    </View>
  );
}

export default TurnGuidanceBar;
