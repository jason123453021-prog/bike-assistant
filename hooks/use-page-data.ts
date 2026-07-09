import { useState, useEffect } from 'react';
import { LocalStorageManager } from '@/lib/local-storage-manager';

/**
 * 分析頁面數據 Hook
 */
export function useAnalyticsData() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const records = await LocalStorageManager.getAllRideRecords();
        setData({
          totalRides: records.length,
          totalDistance: records.reduce((s, r) => s + (r.distance || 0), 0),
          totalTime: records.reduce((s, r) => s + (r.duration || 0), 0) / 3600,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  return { data, loading, error };
}

/**
 * 隊友數據 Hook
 */
export function useBuddiesData() {
  const [buddies, setBuddies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadBuddies = async () => {
      try {
        // 從本地存儲加載隊友數據
        const data = await LocalStorageManager.getUserSettings();
        setBuddies(data?.buddies || []);
      } catch (err) {
        console.error('Failed to load buddies:', err);
      } finally {
        setLoading(false);
      }
    };
    loadBuddies();
  }, []);

  return { buddies, loading };
}

/**
 * 排行榜數據 Hook
 */
export function useLeaderboardData() {
  const [rankings, setRankings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadRankings = async () => {
      try {
        const records = await LocalStorageManager.getAllRideRecords();
        const grouped = records.reduce((acc: any, r: any) => {
          const user = r.userId || 'You';
          if (!acc[user]) acc[user] = { distance: 0, rides: 0 };
          acc[user].distance += r.distance || 0;
          acc[user].rides += 1;
          return acc;
        }, {});

        const sorted = Object.entries(grouped)
          .map(([name, data]: any) => ({ name, ...data }))
          .sort((a, b) => b.distance - a.distance);

        setRankings(sorted);
      } catch (err) {
        console.error('Failed to load rankings:', err);
      } finally {
        setLoading(false);
      }
    };
    loadRankings();
  }, []);

  return { rankings, loading };
}

/**
 * 通知數據 Hook
 */
export function useNotificationsData() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadNotifications = async () => {
      try {
        // 從本地存儲加載通知
        const data = await LocalStorageManager.getUserSettings();
        setNotifications(data?.notifications || []);
      } catch (err) {
        console.error('Failed to load notifications:', err);
      } finally {
        setLoading(false);
      }
    };
    loadNotifications();
  }, []);

  return { notifications, loading };
}
