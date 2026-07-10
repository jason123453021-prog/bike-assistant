import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColors } from '@/hooks/use-colors';
import { searchAddress, type GeocodingResult } from '@/lib/nominatim-geocoding';
import { planRoute, type Route } from '@/lib/osrm-routing';

export interface RouteSearchPanelProps {
  onRouteSelected?: (route: Route) => void;
  onClose?: () => void;
  currentLocation?: { latitude: number; longitude: number };
}

interface RouteOption {
  id: string;
  name: string;
  distance: string;
  duration: string;
  type: 'bike' | 'road';
}

/**
 * 地址搜尋與路線規劃 UI 組件
 * 
 * 功能：
 * - 地址輸入框（起點/終點）
 * - 自行車/道路模式切換
 * - 多條路線選項展示
 * - 路線選擇和確認
 */
export function RouteSearchPanel({
  onRouteSelected,
  onClose,
  currentLocation,
}: RouteSearchPanelProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [startAddress, setStartAddress] = useState('');
  const [endAddress, setEndAddress] = useState('');
  const [routeMode, setRouteMode] = useState<'bike' | 'road'>('bike');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<GeocodingResult[]>([]);
  const [showStartSuggestions, setShowStartSuggestions] = useState(false);
  const [showEndSuggestions, setShowEndSuggestions] = useState(false);
  const [routes, setRoutes] = useState<RouteOption[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [isLoadingRoutes, setIsLoadingRoutes] = useState(false);

  // 搜尋地址
  const handleAddressSearch = useCallback(async (query: string, isStart: boolean) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const results = await searchAddress(query);
      setSearchResults(results);
      if (isStart) {
        setShowStartSuggestions(true);
        setShowEndSuggestions(false);
      } else {
        setShowEndSuggestions(true);
        setShowStartSuggestions(false);
      }
    } catch (error) {
      console.error('地址搜尋失敗:', error);
      Alert.alert('搜尋失敗', '無法搜尋地址，請稍後重試');
    } finally {
      setIsSearching(false);
    }
  }, []);

  // 選擇地址
  const selectAddress = useCallback((result: GeocodingResult, isStart: boolean) => {
    if (isStart) {
      setStartAddress(result.displayName);
      setShowStartSuggestions(false);
    } else {
      setEndAddress(result.displayName);
      setShowEndSuggestions(false);
    }
    setSearchResults([]);
  }, []);

  // 規劃路線
  const planRoute = useCallback(async () => {
    if (!startAddress || !endAddress) {
      Alert.alert('錯誤', '請輸入起點和終點地址');
      return;
    }

    setIsLoadingRoutes(true);
    try {
      // 模擬多條路線規劃
      const mockRoutes: RouteOption[] = [
        {
          id: 'route_1',
          name: '最快路線',
          distance: '12.5 km',
          duration: '45 分鐘',
          type: routeMode,
        },
        {
          id: 'route_2',
          name: '風景路線',
          distance: '15.2 km',
          duration: '52 分鐘',
          type: routeMode,
        },
        {
          id: 'route_3',
          name: '爬升最少',
          distance: '13.8 km',
          duration: '48 分鐘',
          type: routeMode,
        },
      ];
      setRoutes(mockRoutes);
      setSelectedRouteId(mockRoutes[0].id);
    } catch (error) {
      console.error('路線規劃失敗:', error);
      Alert.alert('規劃失敗', '無法規劃路線，請稍後重試');
    } finally {
      setIsLoadingRoutes(false);
    }
  }, [startAddress, endAddress, routeMode]);

  // 確認選擇
  const confirmRoute = useCallback(() => {
    if (!selectedRouteId) {
      Alert.alert('錯誤', '請選擇一條路線');
      return;
    }

    const selected = routes.find(r => r.id === selectedRouteId);
    if (selected && onRouteSelected) {
      // 模擬返回路線結果
      const mockResult: Route = {
        distance: 12500,
        duration: 2700,
        coordinates: [
          { latitude: 25.033, longitude: 121.565 },
          { latitude: 25.034, longitude: 121.566 },
          { latitude: 25.035, longitude: 121.567 },
        ],
        steps: [],
      };
      onRouteSelected(mockResult);
    }
  }, [selectedRouteId, routes, onRouteSelected]);

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      {/* 頂部標題欄 */}
      <View style={styles.header}>
        <Text style={styles.title}>規劃路線</Text>
        {onClose && (
          <Pressable onPress={onClose} style={styles.closeBtn}>
            <IconSymbol name="xmark" size={20} color={colors.foreground} />
          </Pressable>
        )}
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* 起點輸入 */}
        <View style={styles.section}>
          <Text style={styles.label}>起點</Text>
          <View style={[styles.inputContainer, { borderColor: colors.border }]}>
            <IconSymbol name="location.fill" size={18} color={colors.primary} />
            <TextInput
              style={[styles.input, { color: colors.foreground }]}
              placeholder="輸入起點地址"
              placeholderTextColor={colors.muted}
              value={startAddress}
              onChangeText={(text) => {
                setStartAddress(text);
                handleAddressSearch(text, true);
              }}
            />
          </View>
          {showStartSuggestions && searchResults.length > 0 && (
            <View style={[styles.suggestions, { backgroundColor: colors.surface }]}>
              {searchResults.map((result, idx) => (
                <Pressable
                  key={`${result.latitude}-${result.longitude}-${idx}`}
                  style={styles.suggestionItem}
                  onPress={() => selectAddress(result, true)}
                >
                  <Text style={{ color: colors.foreground }}>{result.displayName}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* 終點輸入 */}
        <View style={styles.section}>
          <Text style={styles.label}>終點</Text>
          <View style={[styles.inputContainer, { borderColor: colors.border }]}>
            <IconSymbol name="location.fill" size={18} color={colors.primary} />
            <TextInput
              style={[styles.input, { color: colors.foreground }]}
              placeholder="輸入終點地址"
              placeholderTextColor={colors.muted}
              value={endAddress}
              onChangeText={(text) => {
                setEndAddress(text);
                handleAddressSearch(text, false);
              }}
            />
          </View>
          {showEndSuggestions && searchResults.length > 0 && (
            <View style={[styles.suggestions, { backgroundColor: colors.surface }]}>
              {searchResults.map((result, idx) => (
                <Pressable
                  key={`${result.latitude}-${result.longitude}-${idx}`}
                  style={styles.suggestionItem}
                  onPress={() => selectAddress(result, false)}
                >
                  <Text style={{ color: colors.foreground }}>{result.displayName}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* 路線模式切換 */}
        <View style={styles.section}>
          <Text style={styles.label}>路線模式</Text>
          <View style={styles.modeToggle}>
            <Pressable
              style={[
                styles.modeBtn,
                routeMode === 'bike' && [styles.modeBtnActive, { backgroundColor: colors.primary }],
              ]}
              onPress={() => setRouteMode('bike')}
            >
              <IconSymbol name="bicycle" size={18} color={routeMode === 'bike' ? '#fff' : colors.muted} />
              <Text style={[styles.modeBtnText, { color: routeMode === 'bike' ? '#fff' : colors.muted }]}>
                自行車道優先
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.modeBtn,
                routeMode === 'road' && [styles.modeBtnActive, { backgroundColor: colors.primary }],
              ]}
              onPress={() => setRouteMode('road')}
            >
              <IconSymbol name="road.2" size={18} color={routeMode === 'road' ? '#fff' : colors.muted} />
              <Text style={[styles.modeBtnText, { color: routeMode === 'road' ? '#fff' : colors.muted }]}>
                一般道路
              </Text>
            </Pressable>
          </View>
        </View>

        {/* 規劃按鈕 */}
        <Pressable
          style={[styles.planBtn, { backgroundColor: colors.primary }]}
          onPress={planRoute}
          disabled={isLoadingRoutes}
        >
          {isLoadingRoutes ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <IconSymbol name="map.fill" size={18} color="#fff" />
              <Text style={styles.planBtnText}>規劃路線</Text>
            </>
          )}
        </Pressable>

        {/* 路線選項 */}
        {routes.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.label}>選擇路線</Text>
            {routes.map((route) => (
              <Pressable
                key={route.id}
                style={[
                  styles.routeCard,
                  selectedRouteId === route.id && [styles.routeCardSelected, { borderColor: colors.primary }],
                  { borderColor: colors.border, backgroundColor: colors.surface },
                ]}
                onPress={() => setSelectedRouteId(route.id)}
              >
                <View style={styles.routeInfo}>
                  <Text style={[styles.routeName, { color: colors.foreground }]}>{route.name}</Text>
                  <View style={styles.routeDetails}>
                    <Text style={{ color: colors.muted, fontSize: 12 }}>{route.distance}</Text>
                    <Text style={{ color: colors.muted, fontSize: 12 }}>·</Text>
                    <Text style={{ color: colors.muted, fontSize: 12 }}>{route.duration}</Text>
                  </View>
                </View>
                <View
                  style={[
                    styles.routeCheckbox,
                    selectedRouteId === route.id && [styles.routeCheckboxSelected, { backgroundColor: colors.primary }],
                  ]}
                >
                  {selectedRouteId === route.id && (
                    <IconSymbol name="checkmark" size={16} color="#fff" />
                  )}
                </View>
              </Pressable>
            ))}
          </View>
        )}

        {/* 確認按鈕 */}
        {routes.length > 0 && (
          <Pressable
            style={[styles.confirmBtn, { backgroundColor: colors.primary }]}
            onPress={confirmRoute}
          >
            <Text style={styles.confirmBtnText}>確認選擇</Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  closeBtn: {
    padding: 8,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    gap: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 14,
  },
  suggestions: {
    marginTop: 8,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e5e5e5',
  },
  suggestionItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  modeToggle: {
    flexDirection: 'row',
    gap: 8,
  },
  modeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    backgroundColor: '#fff',
  },
  modeBtnActive: {
    borderColor: 'transparent',
  },
  modeBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  planBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 8,
    marginBottom: 20,
  },
  planBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  routeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 2,
    marginBottom: 8,
  },
  routeCardSelected: {
    borderWidth: 2,
  },
  routeInfo: {
    flex: 1,
  },
  routeName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  routeDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  routeCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e5e5e5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  routeCheckboxSelected: {
    borderColor: 'transparent',
  },
  confirmBtn: {
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  confirmBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
