import AsyncStorage from "@react-native-async-storage/async-storage";

export const RECENT_ADDRESS_SEARCHES_KEY = "@bike_assistant/recent_address_searches";
export const MAX_RECENT_ADDRESS_SEARCHES = 6;

export interface RecentAddressSearch {
  label: string;
  latitude: number;
  longitude: number;
  usedAt: number;
}

export function mergeRecentAddressSearches(
  existing: RecentAddressSearch[],
  next: RecentAddressSearch,
): RecentAddressSearch[] {
  const normalizedLabel = next.label.trim().toLocaleLowerCase();
  return [next, ...existing.filter((item) => (
    item.label.trim().toLocaleLowerCase() !== normalizedLabel
      && (Math.abs(item.latitude - next.latitude) > 0.00001 || Math.abs(item.longitude - next.longitude) > 0.00001)
  ))].slice(0, MAX_RECENT_ADDRESS_SEARCHES);
}

export async function loadRecentAddressSearches(): Promise<RecentAddressSearch[]> {
  try {
    const raw = await AsyncStorage.getItem(RECENT_ADDRESS_SEARCHES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is RecentAddressSearch => (
      typeof item?.label === "string"
      && Number.isFinite(item?.latitude)
      && Number.isFinite(item?.longitude)
      && Number.isFinite(item?.usedAt)
    )).slice(0, MAX_RECENT_ADDRESS_SEARCHES);
  } catch {
    return [];
  }
}

export async function saveRecentAddressSearches(searches: RecentAddressSearch[]): Promise<void> {
  try {
    await AsyncStorage.setItem(
      RECENT_ADDRESS_SEARCHES_KEY,
      JSON.stringify(searches.slice(0, MAX_RECENT_ADDRESS_SEARCHES)),
    );
  } catch {
    // 本機歷史僅是快捷入口；儲存失敗不可影響導航。
  }
}

export function formatNavigationDataFreshness(refreshedAt: number | null): string {
  if (!refreshedAt) return "路線將在計算時向線上服務重新請求道路資料";
  const minutes = Math.max(0, Math.floor((Date.now() - refreshedAt) / 60_000));
  return minutes === 0 ? "已剛向線上服務重新請求道路資料" : `${minutes} 分鐘前向線上服務重新請求道路資料`;
}
