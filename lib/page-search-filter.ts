import { useState, useCallback, useMemo } from 'react';

/**
 * 頁面搜索和過濾 Hook
 */
export function usePageSearch<T>(
  data: T[],
  searchFields: (keyof T)[],
  filterFn?: (item: T, filter: any) => boolean
) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<any>({});

  const filteredData = useMemo(() => {
    let result = data;

    // 應用搜索
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((item) =>
        searchFields.some((field) => {
          const value = item[field];
          return String(value).toLowerCase().includes(query);
        })
      );
    }

    // 應用自定義過濾
    if (filterFn) {
      result = result.filter((item) => filterFn(item, filters));
    }

    return result;
  }, [data, searchQuery, filters, searchFields, filterFn]);

  const updateFilter = useCallback((key: string, value: any) => {
    setFilters((prev: any) => ({
      ...prev,
      [key]: value,
    }));
  }, []);

  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setFilters({});
  }, []);

  return {
    searchQuery,
    setSearchQuery,
    filters,
    updateFilter,
    clearFilters,
    filteredData,
  };
}

/**
 * 排行榜搜索和過濾
 */
export function useLeaderboardSearch(rankings: any[]) {
  return usePageSearch(
    rankings,
    ['name'],
    (item, filters) => {
      if (filters.sortBy === 'distance') {
        return true;
      }
      if (filters.sortBy === 'rides') {
        return true;
      }
      return true;
    }
  );
}

/**
 * 隊友搜索和過濾
 */
export function useBuddiesSearch(buddies: any[]) {
  return usePageSearch(
    buddies,
    ['name', 'status'],
    (item, filters) => {
      if (filters.status && item.status !== filters.status) {
        return false;
      }
      return true;
    }
  );
}

/**
 * 通知搜索和過濾
 */
export function useNotificationsSearch(notifications: any[]) {
  return usePageSearch(
    notifications,
    ['title', 'desc'],
    (item, filters) => {
      if (filters.type && item.type !== filters.type) {
        return false;
      }
      if (filters.read !== undefined && item.read !== filters.read) {
        return false;
      }
      return true;
    }
  );
}

/**
 * 挑戰搜索和過濾
 */
export function useChallengesSearch(challenges: any[]) {
  return usePageSearch(
    challenges,
    ['name'],
    (item, filters) => {
      if (filters.status && item.status !== filters.status) {
        return false;
      }
      if (filters.minProgress !== undefined && item.progress < filters.minProgress) {
        return false;
      }
      return true;
    }
  );
}
