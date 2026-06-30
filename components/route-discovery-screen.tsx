import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import {
  getRouteCommunityManager,
  type CommunityRoute,
} from '@/lib/route-community-manager';
import { getRouteDifficultyClassifier } from '@/lib/route-difficulty-classifier';

export interface RouteDiscoveryScreenProps {
  onRouteSelect?: (route: CommunityRoute) => void;
}

/**
 * 路線探索屏幕
 */
export function RouteDiscoveryScreen({ onRouteSelect }: RouteDiscoveryScreenProps) {
  const [routes, setRoutes] = useState<CommunityRoute[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'popular' | 'search'>('popular');

  useEffect(() => {
    loadPopularRoutes();
  }, []);

  const loadPopularRoutes = async () => {
    try {
      setIsLoading(true);
      const routeManager = getRouteCommunityManager();
      const popularRoutes = await routeManager.getPopularRoutes(20);
      setRoutes(popularRoutes);
    } catch (error) {
      Alert.alert('錯誤', '無法加載路線');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      Alert.alert('提示', '請輸入搜尋關鍵字');
      return;
    }

    try {
      setIsLoading(true);
      const routeManager = getRouteCommunityManager();
      const searchResults = await routeManager.searchRoutes(
        searchQuery,
        selectedDifficulty || undefined
      );
      setRoutes(searchResults);
      setActiveTab('search');
    } catch (error) {
      Alert.alert('錯誤', '搜尋失敗');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setSelectedDifficulty(null);
    setActiveTab('popular');
    loadPopularRoutes();
  };

  const renderRouteItem = ({ item }: { item: CommunityRoute }) => {
    const difficultyClassifier = getRouteDifficultyClassifier();
    const difficultyColor = difficultyClassifier.getDifficultyColor(item.difficulty);
    const difficultyLabel = difficultyClassifier.getDifficultyLabel(item.difficulty);

    return (
      <Pressable
        onPress={() => onRouteSelect?.(item)}
        className="bg-surface rounded-lg p-4 mb-3 border border-border active:opacity-70"
      >
        {/* 路線名稱和難度 */}
        <View className="flex-row items-start justify-between mb-2">
          <View className="flex-1">
            <Text className="text-foreground font-bold text-base">{item.name}</Text>
            <Text className="text-muted text-xs mt-1">{item.username}</Text>
          </View>
          <View
            className="px-3 py-1 rounded-full"
            style={{ backgroundColor: `${difficultyColor}20` }}
          >
            <Text style={{ color: difficultyColor }} className="text-xs font-bold">
              {difficultyLabel}
            </Text>
          </View>
        </View>

        {/* 路線描述 */}
        {item.description && (
          <Text className="text-muted text-xs mb-3 line-clamp-2">
            {item.description}
          </Text>
        )}

        {/* 路線統計 */}
        <View className="flex-row gap-4 mb-3">
          <View>
            <Text className="text-muted text-xs">距離</Text>
            <Text className="text-foreground font-bold">
              {item.distance.toFixed(1)} km
            </Text>
          </View>
          <View>
            <Text className="text-muted text-xs">爬升</Text>
            <Text className="text-foreground font-bold">
              {item.elevationGain.toFixed(0)} m
            </Text>
          </View>
          <View>
            <Text className="text-muted text-xs">騎乘次數</Text>
            <Text className="text-foreground font-bold">{item.rides}</Text>
          </View>
        </View>

        {/* 評分和點讚 */}
        <View className="flex-row items-center gap-4 pt-3 border-t border-border">
          <View className="flex-row items-center gap-1">
            <Text>⭐</Text>
            <Text className="text-foreground font-bold">
              {item.averageRating.toFixed(1)}
            </Text>
            <Text className="text-muted text-xs">({item.totalRatings})</Text>
          </View>
          <View className="flex-row items-center gap-1">
            <Text>❤️</Text>
            <Text className="text-foreground font-bold">{item.likes}</Text>
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <ScreenContainer className="p-4">
      {/* 搜尋欄 */}
      <View className="mb-4">
        <View className="flex-row gap-2 mb-3">
          <TextInput
            className="flex-1 bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
            placeholder="搜尋路線..."
            placeholderTextColor="rgba(107, 114, 128, 0.5)"
            value={searchQuery}
            onChangeText={setSearchQuery}
            editable={!isLoading}
          />
          <Pressable
            onPress={handleSearch}
            disabled={isLoading}
            className="bg-primary px-4 py-3 rounded-lg active:opacity-80"
          >
            <Text className="text-white font-bold">搜尋</Text>
          </Pressable>
        </View>

        {/* 難度篩選 */}
        <View className="flex-row gap-2">
          {['easy', 'moderate', 'hard', 'expert'].map((difficulty) => (
            <Pressable
              key={difficulty}
              onPress={() =>
                setSelectedDifficulty(
                  selectedDifficulty === difficulty ? null : difficulty
                )
              }
              className={`px-3 py-2 rounded-lg ${
                selectedDifficulty === difficulty
                  ? 'bg-primary'
                  : 'bg-surface border border-border'
              }`}
            >
              <Text
                className={`text-xs font-bold ${
                  selectedDifficulty === difficulty
                    ? 'text-white'
                    : 'text-foreground'
                }`}
              >
                {difficulty === 'easy'
                  ? '簡單'
                  : difficulty === 'moderate'
                    ? '中等'
                    : difficulty === 'hard'
                      ? '困難'
                      : '專家'}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* 清除篩選 */}
        {(searchQuery || selectedDifficulty) && (
          <Pressable
            onPress={handleClearSearch}
            className="mt-2 px-3 py-2 bg-error/10 rounded-lg"
          >
            <Text className="text-error text-xs font-bold text-center">
              清除篩選
            </Text>
          </Pressable>
        )}
      </View>

      {/* 標籤欄 */}
      <View className="flex-row gap-2 mb-4">
        <Pressable
          onPress={() => {
            setActiveTab('popular');
            handleClearSearch();
          }}
          className={`flex-1 py-3 rounded-lg ${
            activeTab === 'popular'
              ? 'bg-primary'
              : 'bg-surface border border-border'
          }`}
        >
          <Text
            className={`text-center font-bold ${
              activeTab === 'popular' ? 'text-white' : 'text-foreground'
            }`}
          >
            熱門
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setActiveTab('search')}
          className={`flex-1 py-3 rounded-lg ${
            activeTab === 'search'
              ? 'bg-primary'
              : 'bg-surface border border-border'
          }`}
        >
          <Text
            className={`text-center font-bold ${
              activeTab === 'search' ? 'text-white' : 'text-foreground'
            }`}
          >
            搜尋結果
          </Text>
        </Pressable>
      </View>

      {/* 路線列表 */}
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#0a7ea4" />
          <Text className="text-muted mt-4">加載中...</Text>
        </View>
      ) : routes.length > 0 ? (
        <FlatList
          data={routes}
          renderItem={renderRouteItem}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
        />
      ) : (
        <View className="flex-1 items-center justify-center">
          <Text className="text-muted text-lg">
            {activeTab === 'popular' ? '沒有熱門路線' : '沒有搜尋結果'}
          </Text>
          <Text className="text-muted text-sm mt-2">
            {activeTab === 'popular'
              ? '稍後再試'
              : '嘗試其他搜尋條件'}
          </Text>
        </View>
      )}
    </ScreenContainer>
  );
}
