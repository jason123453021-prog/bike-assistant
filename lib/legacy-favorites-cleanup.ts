/**
 * 已移除的最愛路線功能在舊版留下的唯一 AsyncStorage 鍵。
 * 只移除此鍵，絕不清除其他本機騎乘資料、設定或 GPX 路線。
 */
export const LEGACY_FAVORITES_STORAGE_KEY = "@bike_assistant_favorites";

export interface LocalStorageRemover {
  removeItem(key: string): Promise<void>;
}

/** 可安全重複執行的舊版最愛路線快取清理程序。 */
export async function clearLegacyFavoritesCache(storage: LocalStorageRemover): Promise<void> {
  await storage.removeItem(LEGACY_FAVORITES_STORAGE_KEY);
}
