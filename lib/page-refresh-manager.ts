import { useState, useCallback, useRef } from 'react';

/**
 * 頁面刷新和下拉加載 Hook
 */
export function usePageRefresh<T>(
  fetcher: () => Promise<T[]>,
  options?: {
    initialData?: T[];
    pageSize?: number;
    onRefresh?: () => void;
    onLoadMore?: () => void;
  }
) {
  const [data, setData] = useState<T[]>(options?.initialData || []);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const pageSize = options?.pageSize || 20;
  const isFetchingRef = useRef(false);

  /**
   * 刷新數據
   */
  const onRefresh = useCallback(async () => {
    if (isFetchingRef.current) return;

    try {
      isFetchingRef.current = true;
      setRefreshing(true);
      setPage(1);

      const newData = await fetcher();
      setData(newData.slice(0, pageSize));
      setHasMore(newData.length > pageSize);

      options?.onRefresh?.();
    } catch (error) {
      console.error('Failed to refresh:', error);
    } finally {
      setRefreshing(false);
      isFetchingRef.current = false;
    }
  }, [fetcher, pageSize, options]);

  /**
   * 加載更多
   */
  const onLoadMore = useCallback(async () => {
    if (!hasMore || isFetchingRef.current || loading) return;

    try {
      isFetchingRef.current = true;
      setLoading(true);

      const allData = await fetcher();
      const nextPage = page + 1;
      const startIndex = page * pageSize;
      const endIndex = startIndex + pageSize;

      const newItems = allData.slice(startIndex, endIndex);

      if (newItems.length === 0) {
        setHasMore(false);
      } else {
        setData((prev) => [...prev, ...newItems]);
        setPage(nextPage);
      }

      options?.onLoadMore?.();
    } catch (error) {
      console.error('Failed to load more:', error);
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [fetcher, page, pageSize, hasMore, loading, options]);

  /**
   * 重置
   */
  const reset = useCallback(() => {
    setData(options?.initialData || []);
    setPage(1);
    setHasMore(true);
    setLoading(false);
    setRefreshing(false);
  }, [options?.initialData]);

  return {
    data,
    loading,
    refreshing,
    hasMore,
    onRefresh,
    onLoadMore,
    reset,
  };
}

/**
 * 分頁管理器
 */
export function usePagination<T>(
  items: T[],
  pageSize: number = 20
) {
  const [page, setPage] = useState(1);

  const paginatedItems = items.slice(
    (page - 1) * pageSize,
    page * pageSize
  );

  const totalPages = Math.ceil(items.length / pageSize);
  const hasNextPage = page < totalPages;
  const hasPreviousPage = page > 1;

  const nextPage = () => {
    if (hasNextPage) {
      setPage((p) => p + 1);
    }
  };

  const previousPage = () => {
    if (hasPreviousPage) {
      setPage((p) => p - 1);
    }
  };

  const goToPage = (pageNum: number) => {
    if (pageNum >= 1 && pageNum <= totalPages) {
      setPage(pageNum);
    }
  };

  return {
    paginatedItems,
    page,
    totalPages,
    hasNextPage,
    hasPreviousPage,
    nextPage,
    previousPage,
    goToPage,
  };
}
