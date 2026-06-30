import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Modal,
  Platform,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { useColors } from '@/hooks/use-colors';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

interface RouteOption {
  id: string;
  name: string;
  distance: number;
  duration: number;
  elevation: number;
  type: 'fastest' | 'shortest' | 'flattest';
  polyline?: string;
}

interface RouteSearchAndSelectionProps {
  visible: boolean;
  onClose: () => void;
  onSelectRoute: (route: RouteOption) => void;
  isLoading?: boolean;
  startLocation?: string;
  endLocation?: string;
}

/**
 * 搜尋欄和路線選擇組件
 * 支援：
 * - 地址搜尋
 * - 多條路線選擇（最快、最短、最平緩）
 * - 路線詳細資訊顯示
 */
export function RouteSearchAndSelection({
  visible,
  onClose,
  onSelectRoute,
  isLoading = false,
  startLocation = '目前位置',
  endLocation = '輸入目的地',
}: RouteSearchAndSelectionProps) {
  const colors = useColors();
  const [startText, setStartText] = useState(startLocation);
  const [endText, setEndText] = useState(endLocation);
  const [selectedTab, setSelectedTab] = useState<'fastest' | 'shortest' | 'flattest'>('fastest');
  const [routes, setRoutes] = useState<RouteOption[]>([
    {
      id: '1',
      name: '最快路線',
      distance: 12.5,
      duration: 45,
      elevation: 320,
      type: 'fastest',
    },
    {
      id: '2',
      name: '最短路線',
      distance: 10.8,
      duration: 50,
      elevation: 280,
      type: 'shortest',
    },
    {
      id: '3',
      name: '最平緩路線',
      distance: 14.2,
      duration: 55,
      elevation: 150,
      type: 'flattest',
    },
  ]);

  const handleSearch = useCallback(() => {
    // TODO: 實現搜尋邏輯
    console.log('Search:', { startText, endText });
  }, [startText, endText]);

  const handleSelectRoute = useCallback(
    (route: RouteOption) => {
      onSelectRoute(route);
      onClose();
    },
    [onSelectRoute, onClose]
  );

  const selectedRoute = routes.find((r) => r.type === selectedTab);

  const renderRouteCard = ({ item }: { item: RouteOption }) => (
    <TouchableOpacity
      style={[
        styles.routeCard,
        {
          backgroundColor: colors.surface,
          borderColor: item.type === selectedTab ? colors.primary : colors.border,
          borderWidth: item.type === selectedTab ? 2 : 1,
        },
      ]}
      onPress={() => setSelectedTab(item.type)}
      activeOpacity={0.7}
    >
      <View style={styles.routeCardHeader}>
        <Text style={[styles.routeCardTitle, { color: colors.foreground }]}>
          {item.name}
        </Text>
        {item.type === selectedTab && (
          <MaterialIcons name="check-circle" size={20} color={colors.primary} />
        )}
      </View>

      <View style={styles.routeCardMetrics}>
        <View style={styles.routeMetric}>
          <MaterialIcons name="straighten" size={16} color={colors.muted} />
          <Text style={[styles.routeMetricText, { color: colors.muted }]}>
            {item.distance} km
          </Text>
        </View>

        <View style={styles.routeMetric}>
          <MaterialIcons name="schedule" size={16} color={colors.muted} />
          <Text style={[styles.routeMetricText, { color: colors.muted }]}>
            {item.duration} 分鐘
          </Text>
        </View>

        <View style={styles.routeMetric}>
          <MaterialIcons name="trending-up" size={16} color={colors.muted} />
          <Text style={[styles.routeMetricText, { color: colors.muted }]}>
            {item.elevation} m
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent={false} statusBarTranslucent>
      <SafeAreaView
        style={[
          styles.container,
          {
            backgroundColor: colors.background,
          },
        ]}
      >
        {/* 頂部關閉按鈕 */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
            <MaterialIcons name="close" size={24} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            選擇路線
          </Text>
          <View style={{ width: 24 }} />
        </View>

        {/* 搜尋欄 */}
        <View style={styles.searchSection}>
          {/* 起點 */}
          <View
            style={[
              styles.searchInput,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <MaterialIcons name="location-on" size={20} color={colors.primary} />
            <TextInput
              style={[styles.input, { color: colors.foreground }]}
              placeholder="起點"
              placeholderTextColor={colors.muted}
              value={startText}
              onChangeText={setStartText}
            />
          </View>

          {/* 交換按鈕 */}
          <TouchableOpacity
            style={[
              styles.swapButton,
              {
                backgroundColor: colors.primary,
              },
            ]}
            onPress={() => {
              const temp = startText;
              setStartText(endText);
              setEndText(temp);
            }}
            activeOpacity={0.7}
          >
            <MaterialIcons name="swap-vert" size={20} color="#ffffff" />
          </TouchableOpacity>

          {/* 終點 */}
          <View
            style={[
              styles.searchInput,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <MaterialIcons name="location-on" size={20} color={colors.primary} />
            <TextInput
              style={[styles.input, { color: colors.foreground }]}
              placeholder="終點"
              placeholderTextColor={colors.muted}
              value={endText}
              onChangeText={setEndText}
            />
          </View>

          {/* 搜尋按鈕 */}
          <TouchableOpacity
            style={[
              styles.searchButton,
              {
                backgroundColor: colors.primary,
              },
            ]}
            onPress={handleSearch}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <MaterialIcons name="search" size={20} color="#ffffff" />
            )}
          </TouchableOpacity>
        </View>

        {/* 路線選擇 */}
        <View style={styles.routesSection}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            推薦路線
          </Text>

          <FlatList
            data={routes}
            renderItem={renderRouteCard}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            contentContainerStyle={styles.routesList}
          />
        </View>

        {/* 開始按鈕 */}
        {selectedRoute && (
          <View style={styles.footer}>
            <TouchableOpacity
              style={[
                styles.startButton,
                {
                  backgroundColor: colors.primary,
                },
              ]}
              onPress={() => handleSelectRoute(selectedRoute)}
              activeOpacity={0.8}
            >
              <Text style={styles.startButtonText}>開始騎乘</Text>
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  searchSection: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  searchInput: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  input: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
  },
  swapButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginVertical: 4,
  },
  searchButton: {
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  routesSection: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  routesList: {
    gap: 12,
  },
  routeCard: {
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
  },
  routeCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  routeCardTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  routeCardMetrics: {
    flexDirection: 'row',
    gap: 16,
  },
  routeMetric: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  routeMetricText: {
    fontSize: 12,
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  startButton: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  startButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
