/**
 * 騎乘社群互動 Context
 *
 * 功能：
 * - 管理騎乘記錄的按讚、評論、分享數據
 * - 支援本地持久化（AsyncStorage）
 * - 支援後端同步（待實現）
 * - 支援多設備同步（待實現）
 */

import React, { createContext, useContext, useCallback, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface Comment {
  id: string;
  author: string;
  content: string;
  timestamp: number;
  authorId?: string; // 後端同步用
}

export interface RideInteraction {
  recordId: string;
  likes: number;
  isLiked: boolean;
  comments: Comment[];
  lastSyncTime?: number; // 最後同步時間戳
  syncStatus?: 'local' | 'syncing' | 'synced'; // 同步狀態
}

interface SocialContextValue {
  interactions: Map<string, RideInteraction>;
  getInteraction: (recordId: string) => RideInteraction;
  toggleLike: (recordId: string) => Promise<void>;
  addComment: (recordId: string, author: string, content: string) => Promise<void>;
  removeComment: (recordId: string, commentId: string) => Promise<void>;
  deleteAllInteractions: (recordId: string) => Promise<void>;
  syncToBackend?: (recordId: string) => Promise<void>; // 後端同步用
  isLoading: boolean;
}

const SocialContext = createContext<SocialContextValue | null>(null);

const STORAGE_KEY = "@bike_assistant_social_interactions";

export function SocialProvider({ children }: { children: React.ReactNode }) {
  const [interactions, setInteractions] = useState<Map<string, RideInteraction>>(new Map());
  const [isLoading, setIsLoading] = useState(true);

  // 從 AsyncStorage 載入社群互動數據
  useEffect(() => {
    (async () => {
      try {
        const data = await AsyncStorage.getItem(STORAGE_KEY);
        if (data) {
          const parsed = JSON.parse(data);
          // 將陣列轉換回 Map
          const map = new Map<string, RideInteraction>();
          if (Array.isArray(parsed)) {
            parsed.forEach((item: RideInteraction) => {
              map.set(item.recordId, item);
            });
          } else if (typeof parsed === 'object') {
            Object.entries(parsed).forEach(([key, value]) => {
              map.set(key, value as RideInteraction);
            });
          }
          setInteractions(map);
        }
      } catch (err) {
        console.error("[Social] 載入失敗:", err);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // 保存社群互動數據至 AsyncStorage
  const saveInteractions = useCallback(async (newMap: Map<string, RideInteraction>) => {
    try {
      // 將 Map 轉換為陣列以便序列化
      const array = Array.from(newMap.values());
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(array));
      setInteractions(newMap);
    } catch (err) {
      console.error("[Social] 保存失敗:", err);
      throw err;
    }
  }, []);

  // 取得或建立騎乘互動記錄
  const getInteraction = useCallback(
    (recordId: string): RideInteraction => {
      if (interactions.has(recordId)) {
        return interactions.get(recordId)!;
      }
      // 建立預設互動記錄
      return {
        recordId,
        likes: 0,
        isLiked: false,
        comments: [],
        syncStatus: 'local',
      };
    },
    [interactions]
  );

  // 切換按讚狀態
  const toggleLike = useCallback(
    async (recordId: string) => {
      const current = getInteraction(recordId);
      const updated: RideInteraction = {
        ...current,
        likes: current.isLiked ? current.likes - 1 : current.likes + 1,
        isLiked: !current.isLiked,
        syncStatus: 'local',
      };
      const newMap = new Map(interactions);
      newMap.set(recordId, updated);
      await saveInteractions(newMap);
    },
    [interactions, getInteraction, saveInteractions]
  );

  // 新增評論
  const addComment = useCallback(
    async (recordId: string, author: string, content: string) => {
      if (!content.trim()) return;
      const current = getInteraction(recordId);
      const newComment: Comment = {
        id: Date.now().toString(),
        author,
        content,
        timestamp: Date.now(),
      };
      const updated: RideInteraction = {
        ...current,
        comments: [...current.comments, newComment],
        syncStatus: 'local',
      };
      const newMap = new Map(interactions);
      newMap.set(recordId, updated);
      await saveInteractions(newMap);
    },
    [interactions, getInteraction, saveInteractions]
  );

  // 刪除評論
  const removeComment = useCallback(
    async (recordId: string, commentId: string) => {
      const current = getInteraction(recordId);
      const updated: RideInteraction = {
        ...current,
        comments: current.comments.filter(c => c.id !== commentId),
        syncStatus: 'local',
      };
      const newMap = new Map(interactions);
      newMap.set(recordId, updated);
      await saveInteractions(newMap);
    },
    [interactions, getInteraction, saveInteractions]
  );

  // 刪除騎乘的所有互動記錄
  const deleteAllInteractions = useCallback(
    async (recordId: string) => {
      const newMap = new Map(interactions);
      newMap.delete(recordId);
      await saveInteractions(newMap);
    },
    [interactions, saveInteractions]
  );

  return (
    <SocialContext.Provider
      value={{
        interactions,
        getInteraction,
        toggleLike,
        addComment,
        removeComment,
        deleteAllInteractions,
        isLoading,
      }}
    >
      {children}
    </SocialContext.Provider>
  );
}

export function useSocial(): SocialContextValue {
  const context = useContext(SocialContext);
  if (!context) {
    throw new Error("useSocial must be used within SocialProvider");
  }
  return context;
}
