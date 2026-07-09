import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  FlatList,
} from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { PushNotificationService, NotificationPayload } from '@/lib/push-notification-service';

interface NotificationItem extends NotificationPayload {
  timestamp?: number;
  isRead?: boolean;
}

export default function NotificationsScreen() {
  const colors = useColors();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState<'all' | 'unread'>('all');

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const history = await PushNotificationService.getNotificationHistory();
      setNotifications(history as NotificationItem[]);
    } catch (error) {
      console.error('Failed to load notifications:', error);
      Alert.alert('錯誤', '無法載入通知');
    } finally {
      setLoading(false);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'achievement':
        return '🏆';
      case 'buddy':
        return '👥';
      case 'emergency':
        return '🚨';
      case 'weather':
        return '⚠️';
      case 'training':
        return '🏋️';
      default:
        return '📢';
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'achievement':
        return colors.success;
      case 'buddy':
        return colors.primary;
      case 'emergency':
        return colors.error;
      case 'weather':
        return colors.warning;
      case 'training':
        return colors.primary;
      default:
        return colors.muted;
    }
  };

  const handleMarkAsRead = (index: number) => {
    const updated = [...notifications];
    updated[index].isRead = true;
    setNotifications(updated);
  };

  const handleDelete = (index: number) => {
    const updated = notifications.filter((_, i) => i !== index);
    setNotifications(updated);
  };

  const handleClearAll = () => {
    Alert.alert('清除所有通知', '確定要清除所有通知嗎？', [
      { text: '取消', style: 'cancel' },
      {
        text: '清除',
        style: 'destructive',
        onPress: async () => {
          await PushNotificationService.clearNotificationHistory();
          setNotifications([]);
        },
      },
    ]);
  };

  const filteredNotifications =
    selectedTab === 'unread'
      ? notifications.filter((n) => !n.isRead)
      : notifications;

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  if (loading) {
    return (
      <ScreenContainer className="flex items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="bg-background">
      {/* 標題 */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.foreground }]}>通知</Text>
        {unreadCount > 0 && (
          <View style={[styles.badge, { backgroundColor: colors.error }]}>
            <Text style={styles.badgeText}>{unreadCount}</Text>
          </View>
        )}
      </View>

      {/* 標籤 */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          onPress={() => setSelectedTab('all')}
          style={[
            styles.tab,
            {
              borderBottomColor: selectedTab === 'all' ? colors.primary : 'transparent',
            },
          ]}
        >
          <Text
            style={[
              styles.tabText,
              {
                color: selectedTab === 'all' ? colors.primary : colors.muted,
                fontWeight: selectedTab === 'all' ? '600' : '400',
              },
            ]}
          >
            全部 ({notifications.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setSelectedTab('unread')}
          style={[
            styles.tab,
            {
              borderBottomColor: selectedTab === 'unread' ? colors.primary : 'transparent',
            },
          ]}
        >
          <Text
            style={[
              styles.tabText,
              {
                color: selectedTab === 'unread' ? colors.primary : colors.muted,
                fontWeight: selectedTab === 'unread' ? '600' : '400',
              },
            ]}
          >
            未讀 ({unreadCount})
          </Text>
        </TouchableOpacity>
      </View>

      {/* 通知列表 */}
      {filteredNotifications.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyIcon, { fontSize: 48 }]}>📭</Text>
          <Text style={[styles.emptyText, { color: colors.muted }]}>
            {selectedTab === 'unread' ? '沒有未讀通知' : '沒有通知'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredNotifications}
          keyExtractor={(_, index) => index.toString()}
          renderItem={({ item, index }) => (
            <View
              style={[
                styles.notificationItem,
                {
                  backgroundColor: item.isRead ? colors.background : colors.surface,
                  borderColor: colors.border,
                  borderLeftColor: getNotificationColor(item.type),
                },
              ]}
            >
              <View style={styles.notificationContent}>
                {/* 圖標和標題 */}
                <View style={styles.notificationHeader}>
                  <Text style={styles.notificationIcon}>
                    {getNotificationIcon(item.type)}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.notificationTitle,
                        {
                          color: colors.foreground,
                          fontWeight: item.isRead ? '400' : '600',
                        },
                      ]}
                    >
                      {item.title}
                    </Text>
                    {item.timestamp && (
                      <Text style={[styles.notificationTime, { color: colors.muted }]}>
                        {formatTime(item.timestamp)}
                      </Text>
                    )}
                  </View>
                </View>

                {/* 內容 */}
                <Text
                  style={[
                    styles.notificationBody,
                    {
                      color: colors.muted,
                    },
                  ]}
                  numberOfLines={2}
                >
                  {item.body}
                </Text>
              </View>

              {/* 操作按鈕 */}
              <View style={styles.notificationActions}>
                {!item.isRead && (
                  <TouchableOpacity
                    onPress={() => handleMarkAsRead(index)}
                    style={[styles.actionButton, { backgroundColor: colors.primary + '20' }]}
                  >
                    <Text style={[styles.actionButtonText, { color: colors.primary }]}>
                      標記已讀
                    </Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  onPress={() => handleDelete(index)}
                  style={[styles.actionButton, { backgroundColor: colors.error + '20' }]}
                >
                  <Text style={[styles.actionButtonText, { color: colors.error }]}>
                    刪除
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          scrollEnabled={false}
        />
      )}

      {/* 底部操作 */}
      {notifications.length > 0 && (
        <View style={styles.bottomActions}>
          <TouchableOpacity
            onPress={loadNotifications}
            style={[styles.actionButton, { backgroundColor: colors.primary + '20', flex: 1 }]}
          >
            <Text style={[styles.actionButtonText, { color: colors.primary }]}>
              🔄 刷新
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleClearAll}
            style={[styles.actionButton, { backgroundColor: colors.error + '20', flex: 1 }]}
          >
            <Text style={[styles.actionButtonText, { color: colors.error }]}>
              🗑️ 全部清除
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </ScreenContainer>
  );
}

/**
 * 格式化時間
 */
function formatTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return '剛剛';
  if (minutes < 60) return `${minutes} 分鐘前`;
  if (hours < 24) return `${hours} 小時前`;
  if (days < 7) return `${days} 天前`;

  const date = new Date(timestamp);
  return date.toLocaleDateString('zh-TW');
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  badge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
    paddingHorizontal: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    borderBottomWidth: 2,
    alignItems: 'center',
  },
  tabText: {
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
  },
  notificationItem: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderLeftWidth: 4,
  },
  notificationContent: {
    marginBottom: 8,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 6,
  },
  notificationIcon: {
    fontSize: 18,
    marginTop: 2,
  },
  notificationTitle: {
    fontSize: 13,
    marginBottom: 2,
  },
  notificationTime: {
    fontSize: 11,
  },
  notificationBody: {
    fontSize: 12,
    lineHeight: 16,
    marginLeft: 26,
  },
  notificationActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  bottomActions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
});
