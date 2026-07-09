import { useNavigation } from '@react-navigation/native';
import { useCallback } from 'react';

/**
 * 頁面導航管理器
 */
export function usePageNavigation() {
  const navigation = useNavigation<any>();

  const navigateToAnalytics = useCallback(() => {
    navigation.navigate('analytics');
  }, [navigation]);

  const navigateToChallenges = useCallback(() => {
    navigation.navigate('challenges');
  }, [navigation]);

  const navigateToTraining = useCallback(() => {
    navigation.navigate('training');
  }, [navigation]);

  const navigateToRecommendations = useCallback(() => {
    navigation.navigate('recommendations');
  }, [navigation]);

  const navigateToBuddies = useCallback(() => {
    navigation.navigate('buddies');
  }, [navigation]);

  const navigateToLeaderboard = useCallback(() => {
    navigation.navigate('leaderboard');
  }, [navigation]);

  const navigateToNotifications = useCallback(() => {
    navigation.navigate('notifications');
  }, [navigation]);

  const navigateToSettings = useCallback(() => {
    navigation.navigate('settings');
  }, [navigation]);

  const navigateToNavigation = useCallback(() => {
    navigation.navigate('navigation');
  }, [navigation]);

  const navigateToHistory = useCallback(() => {
    navigation.navigate('history');
  }, [navigation]);

  const navigateToFriends = useCallback(() => {
    navigation.navigate('friends');
  }, [navigation]);

  return {
    navigateToAnalytics,
    navigateToChallenges,
    navigateToTraining,
    navigateToRecommendations,
    navigateToBuddies,
    navigateToLeaderboard,
    navigateToNotifications,
    navigateToSettings,
    navigateToNavigation,
    navigateToHistory,
    navigateToFriends,
  };
}

/**
 * 深度鏈接處理
 */
export function handleDeepLink(url: string) {
  const urlObj = new URL(url);
  const pathname = urlObj.pathname;

  if (pathname.includes('analytics')) return 'analytics';
  if (pathname.includes('challenges')) return 'challenges';
  if (pathname.includes('training')) return 'training';
  if (pathname.includes('recommendations')) return 'recommendations';
  if (pathname.includes('buddies')) return 'buddies';
  if (pathname.includes('leaderboard')) return 'leaderboard';
  if (pathname.includes('notifications')) return 'notifications';
  if (pathname.includes('settings')) return 'settings';
  if (pathname.includes('navigation')) return 'navigation';
  if (pathname.includes('history')) return 'history';
  if (pathname.includes('friends')) return 'friends';

  return null;
}
