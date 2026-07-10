import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColors } from '@/hooks/use-colors';

export interface MapZoomControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onRecenter?: () => void;
  canZoomIn?: boolean;
  canZoomOut?: boolean;
}

/**
 * 地圖縮放控制按鈕組件
 * 
 * 功能：
 * - 放大/縮小按鈕
 * - 重新居中按鈕（回到當前位置）
 * - 響應式設計，適應不同屏幕尺寸
 */
export function MapZoomControls({
  onZoomIn,
  onZoomOut,
  onRecenter,
  canZoomIn = true,
  canZoomOut = true,
}: MapZoomControlsProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        {
          top: insets.top + 16,
          right: 16,
        },
      ]}
    >
      {/* 放大按鈕 */}
      <Pressable
        style={[
          styles.button,
          !canZoomIn && styles.buttonDisabled,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
        onPress={onZoomIn}
        disabled={!canZoomIn}
      >
        <IconSymbol
          name="plus"
          size={20}
          color={canZoomIn ? colors.primary : colors.muted}
        />
      </Pressable>

      {/* 縮小按鈕 */}
      <Pressable
        style={[
          styles.button,
          !canZoomOut && styles.buttonDisabled,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
        onPress={onZoomOut}
        disabled={!canZoomOut}
      >
        <IconSymbol
          name="minus"
          size={20}
          color={canZoomOut ? colors.primary : colors.muted}
        />
      </Pressable>

      {/* 重新居中按鈕 */}
      {onRecenter && (
        <Pressable
          style={[
            styles.button,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
          onPress={onRecenter}
        >
          <IconSymbol
            name="location.fill"
            size={20}
            color={colors.primary}
          />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    gap: 8,
  },
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
