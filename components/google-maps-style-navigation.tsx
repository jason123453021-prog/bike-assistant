import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
  SafeAreaView,
} from 'react-native';
import { useColors } from '@/hooks/use-colors';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface GoogleMapsStyleNavigationProps {
  onSearchPress?: () => void;
  onLayersPress?: () => void;
  onMyLocationPress?: () => void;
  onDirectionsPress?: () => void;
  searchPlaceholder?: string;
  currentLocation?: string;
}

/**
 * Google Maps 風格導航 UI 組件
 * 包含：
 * - 頂部搜尋欄
 * - 右側浮動工具列（圖層、我的位置、方向）
 * - 底部路線卡片
 */
export function GoogleMapsStyleNavigation({
  onSearchPress,
  onLayersPress,
  onMyLocationPress,
  onDirectionsPress,
  searchPlaceholder = '搜尋地點或路線',
  currentLocation,
}: GoogleMapsStyleNavigationProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [showBottomCard, setShowBottomCard] = useState(false);

  return (
    <View style={styles.container}>
      {/* 頂部搜尋欄 */}
      <View
        style={[
          styles.topBar,
          {
            paddingTop: insets.top + 8,
            backgroundColor: colors.background,
          },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.searchBar,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
          onPress={onSearchPress}
          activeOpacity={0.7}
        >
          <MaterialIcons name="search" size={20} color={colors.muted} />
          <Text style={[styles.searchText, { color: colors.muted }]}>
            {searchPlaceholder}
          </Text>
        </TouchableOpacity>
      </View>

      {/* 右側浮動工具列 */}
      <View style={[styles.floatingToolbar, { right: 16, top: insets.top + 120 }]}>
        {/* 圖層按鈕 */}
        <TouchableOpacity
          style={[
            styles.floatingButton,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
          onPress={onLayersPress}
          activeOpacity={0.7}
        >
          <MaterialIcons name="layers" size={24} color={colors.foreground} />
        </TouchableOpacity>

        {/* 我的位置按鈕 */}
        <TouchableOpacity
          style={[
            styles.floatingButton,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              marginTop: 12,
            },
          ]}
          onPress={onMyLocationPress}
          activeOpacity={0.7}
        >
          <MaterialIcons name="my-location" size={24} color={colors.foreground} />
        </TouchableOpacity>

        {/* 方向按鈕 */}
        <TouchableOpacity
          style={[
            styles.floatingButton,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              marginTop: 12,
            },
          ]}
          onPress={onDirectionsPress}
          activeOpacity={0.7}
        >
          <MaterialIcons name="directions" size={24} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      {/* 底部路線卡片 */}
      {showBottomCard && (
        <View
          style={[
            styles.bottomCard,
            {
              backgroundColor: colors.surface,
              borderTopColor: colors.border,
            },
          ]}
        >
          <View style={styles.cardHandle} />

          <View style={styles.cardContent}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>
              路線資訊
            </Text>

            <View style={styles.cardMetrics}>
              <View style={styles.metricItem}>
                <Text style={[styles.metricLabel, { color: colors.muted }]}>
                  距離
                </Text>
                <Text style={[styles.metricValue, { color: colors.foreground }]}>
                  12.5 km
                </Text>
              </View>

              <View style={styles.metricItem}>
                <Text style={[styles.metricLabel, { color: colors.muted }]}>
                  時間
                </Text>
                <Text style={[styles.metricValue, { color: colors.foreground }]}>
                  45 分鐘
                </Text>
              </View>

              <View style={styles.metricItem}>
                <Text style={[styles.metricLabel, { color: colors.muted }]}>
                  爬升
                </Text>
                <Text style={[styles.metricValue, { color: colors.foreground }]}>
                  320 m
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.startButton,
                {
                  backgroundColor: colors.primary,
                },
              ]}
              activeOpacity={0.8}
            >
              <Text style={styles.startButtonText}>開始騎乘</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* 展開底部卡片的按鈕 */}
      {!showBottomCard && (
        <TouchableOpacity
          style={[
            styles.expandButton,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              bottom: insets.bottom + 16,
            },
          ]}
          onPress={() => setShowBottomCard(true)}
          activeOpacity={0.7}
        >
          <Text style={[styles.expandButtonText, { color: colors.foreground }]}>
            查看路線
          </Text>
          <MaterialIcons name="expand-less" size={20} color={colors.foreground} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  topBar: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1,
  },
  searchText: {
    marginLeft: 8,
    fontSize: 14,
    flex: 1,
  },
  floatingToolbar: {
    position: 'absolute',
    alignItems: 'center',
  },
  floatingButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  bottomCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
    maxHeight: '50%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  cardHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CCCCCC',
    alignSelf: 'center',
    marginBottom: 12,
  },
  cardContent: {
    gap: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  cardMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
  },
  metricItem: {
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  startButton: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  startButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  expandButton: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  expandButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
