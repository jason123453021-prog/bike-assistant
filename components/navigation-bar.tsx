import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColors } from '@/hooks/use-colors';

export interface NavigationInstruction {
  type: 'left' | 'right' | 'straight' | 'uturn' | 'arrive' | 'none';
  distance: number; // 距離（公尺）
  instruction: string; // 導航指令文字
  isNavigating: boolean; // 是否正在導航
}

interface NavigationBarProps {
  instruction: NavigationInstruction | null;
  onClose?: () => void;
}

/**
 * 頂部實時轉彎提示導航欄
 * 
 * 功能：
 * - 深綠色（#1B5E20）背景，圓角設計
 * - 左側動態轉彎圖示
 * - 右側導航指令與剩餘距離
 * - 未導航時自動隱藏或顯示引導文字
 */
export function NavigationBar({ instruction, onClose }: NavigationBarProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  // 轉彎圖示映射
  const getTurnIcon = (type: string): string => {
    switch (type) {
      case 'left':
        return 'arrow.turn.up.left';
      case 'right':
        return 'arrow.turn.up.right';
      case 'straight':
        return 'arrow.up';
      case 'uturn':
        return 'arrow.uturn.up';
      case 'arrive':
        return 'checkmark.circle.fill';
      default:
        return 'location.fill';
    }
  };

  // 格式化距離
  const formatDistance = (meters: number): string => {
    if (meters < 1000) {
      return `${Math.round(meters)} m`;
    }
    return `${(meters / 1000).toFixed(1)} km`;
  };

  // 如果沒有導航或導航已結束，顯示引導文字
  if (!instruction || !instruction.isNavigating) {
    return (
      <View
        style={[
          styles.container,
          {
            top: insets.top + 8,
            backgroundColor: '#1B5E20',
          },
        ]}
      >
        <View style={styles.content}>
          <IconSymbol
            size={24}
            name="location.fill"
            color="#FFFFFF"
          />
          <Text style={styles.guidanceText}>
            匯入 GPX 路線開始導航
          </Text>
        </View>
      </View>
    );
  }

  // 導航中顯示轉彎提示
  return (
    <View
      style={[
        styles.container,
        {
          top: insets.top + 8,
          backgroundColor: '#1B5E20',
        },
      ]}
    >
      <View style={styles.content}>
        {/* 左側轉彎圖示 */}
        <View style={styles.iconContainer}>
          <IconSymbol
            size={28}
            name={getTurnIcon(instruction.type)}
            color="#FFFFFF"
          />
        </View>

        {/* 中間導航指令與距離 */}
        <View style={styles.instructionContainer}>
          <Text style={styles.instruction} numberOfLines={1}>
            {instruction.instruction}
          </Text>
          <Text style={styles.distance}>
            {formatDistance(instruction.distance)}
          </Text>
        </View>

        {/* 右側關閉按鈕 */}
        {onClose && (
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [
              styles.closeButton,
              { opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <IconSymbol
              size={20}
              name="xmark"
              color="#FFFFFF"
            />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 100,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  instructionContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  instruction: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  distance: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  guidanceText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
    flex: 1,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    flexShrink: 0,
  },
});
