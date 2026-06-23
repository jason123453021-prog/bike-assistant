/**
 * 路線最愛管理 Context
 *
 * 功能：
 * - 儲存常用路線（GPX 檔案和元數據）
 * - 支援新增、刪除、搜尋最愛路線
 * - 持久化儲存至 AsyncStorage
 */

import React, { createContext, useContext, useCallback, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface FavoriteRoute {
  id: string;
  name: string;
  gpxContent: string; // 完整 GPX 內容
  distance: number; // 公里
  estimatedTime: number; // 秒
  createdAt: number; // 時間戳
  lastUsed?: number; // 上次使用時間戳
}

interface FavoritesContextValue {
  favorites: FavoriteRoute[];
  addFavorite: (route: Omit<FavoriteRoute, "id" | "createdAt">) => Promise<void>;
  removeFavorite: (id: string) => Promise<void>;
  updateFavorite: (id: string, updates: Partial<FavoriteRoute>) => Promise<void>;
  searchFavorites: (query: string) => FavoriteRoute[];
  getFavoriteById: (id: string) => FavoriteRoute | null;
  updateLastUsed: (id: string) => Promise<void>;
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

const STORAGE_KEY = "@bike_assistant_favorites";

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const [favorites, setFavorites] = useState<FavoriteRoute[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 從 AsyncStorage 載入最愛路線
  useEffect(() => {
    (async () => {
      try {
        const data = await AsyncStorage.getItem(STORAGE_KEY);
        if (data) {
          setFavorites(JSON.parse(data));
        }
      } catch (err) {
        console.error("[Favorites] 載入失敗:", err);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // 保存最愛路線至 AsyncStorage
  const saveFavorites = useCallback(async (routes: FavoriteRoute[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(routes));
      setFavorites(routes);
    } catch (err) {
      console.error("[Favorites] 保存失敗:", err);
      throw err;
    }
  }, []);

  // 新增最愛路線
  const addFavorite = useCallback(
    async (route: Omit<FavoriteRoute, "id" | "createdAt">) => {
      const newRoute: FavoriteRoute = {
        ...route,
        id: Date.now().toString(),
        createdAt: Date.now(),
      };
      await saveFavorites([...favorites, newRoute]);
    },
    [favorites, saveFavorites]
  );

  // 刪除最愛路線
  const removeFavorite = useCallback(
    async (id: string) => {
      const updated = favorites.filter((r) => r.id !== id);
      await saveFavorites(updated);
    },
    [favorites, saveFavorites]
  );

  // 更新最愛路線
  const updateFavorite = useCallback(
    async (id: string, updates: Partial<FavoriteRoute>) => {
      const updated = favorites.map((r) =>
        r.id === id ? { ...r, ...updates } : r
      );
      await saveFavorites(updated);
    },
    [favorites, saveFavorites]
  );

  // 搜尋最愛路線（按名稱）
  const searchFavorites = useCallback(
    (query: string): FavoriteRoute[] => {
      if (!query.trim()) return favorites;
      const lowerQuery = query.toLowerCase();
      return favorites.filter((r) =>
        r.name.toLowerCase().includes(lowerQuery)
      );
    },
    [favorites]
  );

  // 按 ID 取得最愛路線
  const getFavoriteById = useCallback(
    (id: string): FavoriteRoute | null => {
      return favorites.find((r) => r.id === id) ?? null;
    },
    [favorites]
  );

  // 更新上次使用時間
  const updateLastUsed = useCallback(
    async (id: string) => {
      await updateFavorite(id, { lastUsed: Date.now() });
    },
    [updateFavorite]
  );

  if (isLoading) {
    return <>{children}</>;
  }

  return (
    <FavoritesContext.Provider
      value={{
        favorites,
        addFavorite,
        removeFavorite,
        updateFavorite,
        searchFavorites,
        getFavoriteById,
        updateLastUsed,
      }}
    >
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites(): FavoritesContextValue {
  const context = useContext(FavoritesContext);
  if (!context) {
    throw new Error("useFavorites must be used within FavoritesProvider");
  }
  return context;
}
