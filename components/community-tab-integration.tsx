import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { AuthScreen } from '@/components/auth-screen';
import { UserProfileScreen } from '@/components/user-profile-screen';
import { FriendsListScreen } from '@/components/friends-list-screen';
import { RouteDiscoveryScreen } from '@/components/route-discovery-screen';
import { RouteDetailScreen } from '@/components/route-detail-screen';
import { getUserAccountManager } from '@/lib/user-account-manager';
import { type CommunityRoute } from '@/lib/route-community-manager';

type CommunityView =
  | 'auth'
  | 'profile'
  | 'friends'
  | 'discovery'
  | 'route-detail';

export interface CommunityTabIntegrationProps {
  onLogout?: () => void;
}

/**
 * 社群標籤頁集成組件
 * 管理所有社群相關的屏幕和導航
 */
export function CommunityTabIntegration({
  onLogout,
}: CommunityTabIntegrationProps) {
  const [currentView, setCurrentView] = useState<CommunityView>('discovery');
  const [selectedRoute, setSelectedRoute] = useState<CommunityRoute | null>(null);
  const userManager = getUserAccountManager();
  const isLoggedIn = userManager.isLoggedIn();

  const handleAuthSuccess = () => {
    setCurrentView('profile');
  };

  const handleLogout = () => {
    setCurrentView('discovery');
    onLogout?.();
  };

  const handleRouteSelect = (route: CommunityRoute) => {
    setSelectedRoute(route);
    setCurrentView('route-detail');
  };

  const handleBackFromDetail = () => {
    setCurrentView('discovery');
    setSelectedRoute(null);
  };

  // 未登入時顯示登入屏幕
  if (!isLoggedIn) {
    return <AuthScreen onAuthSuccess={handleAuthSuccess} />;
  }

  // 根據當前視圖渲染相應的屏幕
  switch (currentView) {
    case 'auth':
      return <AuthScreen onAuthSuccess={handleAuthSuccess} />;

    case 'profile':
      return <UserProfileScreen onLogout={handleLogout} />;

    case 'friends':
      return <FriendsListScreen />;

    case 'discovery':
      return <RouteDiscoveryScreen onRouteSelect={handleRouteSelect} />;

    case 'route-detail':
      return selectedRoute ? (
        <RouteDetailScreen route={selectedRoute} onBack={handleBackFromDetail} />
      ) : (
        <RouteDiscoveryScreen onRouteSelect={handleRouteSelect} />
      );

    default:
      return (
        <View className="flex-1 items-center justify-center bg-background">
          <Text className="text-foreground text-lg">未知的視圖</Text>
        </View>
      );
  }
}

/**
 * 社群標籤欄導航組件
 * 用於在不同社群屏幕之間切換
 */
export function CommunityTabBar({
  currentView,
  onViewChange,
}: {
  currentView: CommunityView;
  onViewChange: (view: CommunityView) => void;
}) {
  const tabs: Array<{ id: CommunityView; label: string; icon: string }> = [
    { id: 'discovery', label: '探索', icon: '🔍' },
    { id: 'friends', label: '好友', icon: '👥' },
    { id: 'profile', label: '我的', icon: '👤' },
  ];

  return (
    <View className="flex-row bg-surface border-t border-border">
      {tabs.map((tab) => (
        <View key={tab.id} className="flex-1">
          <View
            className={`py-3 items-center border-t-2 ${
              currentView === tab.id
                ? 'border-primary bg-primary/5'
                : 'border-transparent'
            }`}
          >
            <Text className="text-xl mb-1">{tab.icon}</Text>
            <Text
              className={`text-xs font-bold ${
                currentView === tab.id
                  ? 'text-primary'
                  : 'text-muted'
              }`}
            >
              {tab.label}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

/**
 * 完整的社群標籤頁組件
 * 包含標籤欄導航和內容區域
 */
export function CommunityTabScreen({
  onLogout,
}: CommunityTabIntegrationProps) {
  const [currentView, setCurrentView] = useState<CommunityView>('discovery');

  return (
    <View className="flex-1">
      <CommunityTabIntegration
        onLogout={onLogout}
      />
      <CommunityTabBar
        currentView={currentView}
        onViewChange={setCurrentView}
      />
    </View>
  );
}
