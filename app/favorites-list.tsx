/**
 * 最愛路線列表頁
 *
 * 功能：
 * - 顯示所有最愛路線
 * - 搜尋最愛路線
 * - 套用最愛路線至導航
 * - 刪除最愛路線
 */

import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Dimensions,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/use-colors";
import { useFavorites } from "@/lib/favorites-context";
import { useGpx } from "@/lib/gpx-context";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ScreenContainer } from "@/components/screen-container";
import { type FavoriteRoute } from "@/lib/favorites-context";

const { width: SCREEN_W } = Dimensions.get("window");

export default function FavoritesListScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { favorites, removeFavorite, updateLastUsed } = useFavorites();
  const { applyFavoriteRoute } = useGpx();
  const [searchQuery, setSearchQuery] = useState("");

  // 搜尋最愛路線
  const filteredFavorites = useMemo(() => {
    if (!searchQuery.trim()) return favorites;
    const lowerQuery = searchQuery.toLowerCase();
    return favorites.filter((f) => f.name.toLowerCase().includes(lowerQuery));
  }, [favorites, searchQuery]);

  // 套用最愛路線
  const handleApplyFavorite = useCallback(
    async (favorite: FavoriteRoute) => {
      try {
        await applyFavoriteRoute(favorite.gpxContent);
        await updateLastUsed(favorite.id);
        // 返回地圖頁面
        router.back();
      } catch (err) {
        Alert.alert("錯誤", "套用路線失敗");
      }
    },
    [applyFavoriteRoute, updateLastUsed]
  );

  // 刪除最愛路線
  const handleDeleteFavorite = useCallback(
    (favorite: FavoriteRoute) => {
      Alert.alert("刪除最愛", `確定要刪除「${favorite.name}」嗎？`, [
        { text: "取消", style: "cancel" },
        {
          text: "刪除",
          style: "destructive",
          onPress: async () => {
            try {
              await removeFavorite(favorite.id);
            } catch (err) {
              Alert.alert("錯誤", "刪除失敗");
            }
          },
        },
      ]);
    },
    [removeFavorite]
  );

  const renderFavoriteItem = useCallback(
    ({ item: favorite }: { item: FavoriteRoute }) => (
      <Pressable
        style={({ pressed }) => [
          styles.favoriteItem,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            opacity: pressed ? 0.7 : 1,
          },
        ]}
        onPress={() => handleApplyFavorite(favorite)}
      >
        <View style={styles.favoriteContent}>
          <Text style={[styles.favoriteName, { color: colors.foreground }]}>
            {favorite.name}
          </Text>
          <View style={styles.favoriteDetails}>
            <Text style={[styles.favoriteDetail, { color: colors.muted }]}>
              {(favorite.distance).toFixed(1)} km
            </Text>
            <Text style={[styles.favoriteDetail, { color: colors.muted }]}>
              {Math.floor(favorite.estimatedTime / 60)} 分
            </Text>
            {favorite.lastUsed && (
              <Text style={[styles.favoriteDetail, { color: colors.muted }]}>
                最後使用：{new Date(favorite.lastUsed).toLocaleDateString()}
              </Text>
            )}
          </View>
        </View>

        {/* 刪除按鈕 */}
        <Pressable
          style={({ pressed }) => [
            styles.deleteBtn,
            { opacity: pressed ? 0.6 : 1 },
          ]}
          onPress={() => handleDeleteFavorite(favorite)}
        >
          <IconSymbol name="trash" size={18} color={colors.error} />
        </Pressable>
      </Pressable>
    ),
    [colors, handleApplyFavorite, handleDeleteFavorite]
  );

  return (
    <ScreenContainer className="bg-background">
      {/* 標題 */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <IconSymbol name="chevron.left" size={24} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          最愛路線
        </Text>
        <View style={{ width: 24 }} />
      </View>

      {/* 搜尋框 */}
      <View style={[styles.searchContainer, { borderColor: colors.border }]}>
        <IconSymbol name="magnifyingglass" size={16} color={colors.muted} />
        <TextInput
          style={[styles.searchInput, { color: colors.foreground }]}
          placeholder="搜尋路線..."
          placeholderTextColor={colors.muted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* 最愛路線列表 */}
      {filteredFavorites.length > 0 ? (
        <FlatList
          data={filteredFavorites}
          keyExtractor={(item) => item.id}
          renderItem={renderFavoriteItem}
          scrollEnabled={false}
          contentContainerStyle={styles.listContent}
        />
      ) : (
        <View style={styles.emptyState}>
          <IconSymbol name="heart" size={48} color={colors.muted} />
          <Text style={[styles.emptyText, { color: colors.muted }]}>
            {searchQuery ? "沒有符合的路線" : "還沒有最愛路線"}
          </Text>
        </View>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
  },
  listContent: {
    paddingHorizontal: 16,
    gap: 12,
  },
  favoriteItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  favoriteContent: {
    flex: 1,
  },
  favoriteName: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  favoriteDetails: {
    flexDirection: "row",
    gap: 12,
  },
  favoriteDetail: {
    fontSize: 12,
  },
  deleteBtn: {
    padding: 8,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
  },
});
