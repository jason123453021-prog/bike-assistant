/**
 * 頁面級別緩存管理器
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class PageCacheManager {
  private cache = new Map<string, CacheEntry<any>>();
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 分鐘

  /**
   * 設置緩存
   */
  set<T>(key: string, data: T, ttl: number = this.DEFAULT_TTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  /**
   * 獲取緩存
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    const isExpired = Date.now() - entry.timestamp > entry.ttl;

    if (isExpired) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * 清除特定緩存
   */
  clear(key: string): void {
    this.cache.delete(key);
  }

  /**
   * 清除所有緩存
   */
  clearAll(): void {
    this.cache.clear();
  }

  /**
   * 檢查緩存是否存在且未過期
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);

    if (!entry) {
      return false;
    }

    const isExpired = Date.now() - entry.timestamp > entry.ttl;

    if (isExpired) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * 獲取緩存大小
   */
  size(): number {
    return this.cache.size;
  }
}

export const pageCache = new PageCacheManager();

/**
 * 使用緩存的 Hook
 */
import { useState, useEffect, useCallback } from 'react';

export function useCachedData<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl?: number
) {
  const [data, setData] = useState<T | null>(() => pageCache.get<T>(key));
  const [loading, setLoading] = useState(!pageCache.has(key));
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await fetcher();
      pageCache.set(key, result, ttl);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [key, fetcher, ttl]);

  useEffect(() => {
    if (!pageCache.has(key)) {
      refetch();
    }
  }, [key, refetch]);

  return { data, loading, error, refetch };
}
