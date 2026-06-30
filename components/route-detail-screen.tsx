import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import {
  getRouteCommunityManager,
  type CommunityRoute,
  type RouteRating,
} from '@/lib/route-community-manager';
import { getRouteDifficultyClassifier } from '@/lib/route-difficulty-classifier';

export interface RouteDetailScreenProps {
  route: CommunityRoute;
  onBack?: () => void;
}

/**
 * 路線詳情屏幕
 */
export function RouteDetailScreen({ route, onBack }: RouteDetailScreenProps) {
  const [isLiked, setIsLiked] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [ratings, setRatings] = useState<RouteRating[]>([]);

  const difficultyClassifier = getRouteDifficultyClassifier();
  const difficultyColor = difficultyClassifier.getDifficultyColor(route.difficulty);
  const difficultyLabel = difficultyClassifier.getDifficultyLabel(route.difficulty);

  const handleLike = async () => {
    try {
      setIsLoading(true);
      const routeManager = getRouteCommunityManager();

      if (isLiked) {
        await routeManager.unlikeRoute(route.id);
      } else {
        await routeManager.likeRoute(route.id);
      }

      setIsLiked(!isLiked);
    } catch (error) {
      Alert.alert('錯誤', '操作失敗');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRate = async () => {
    if (rating === 0) {
      Alert.alert('提示', '請選擇評分');
      return;
    }

    try {
      setIsLoading(true);
      const routeManager = getRouteCommunityManager();
      await routeManager.rateRoute(route.id, rating, comment);
      Alert.alert('成功', '評分已提交');
      setRating(0);
      setComment('');
    } catch (error) {
      Alert.alert('錯誤', '評分失敗');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScreenContainer className="p-4">
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* 返回按鈕 */}
        <Pressable
          onPress={onBack}
          className="flex-row items-center gap-2 mb-4 active:opacity-70"
        >
          <Text className="text-primary text-lg">←</Text>
          <Text className="text-primary font-bold">返回</Text>
        </Pressable>

        {/* 路線標題 */}
        <View className="mb-4">
          <View className="flex-row items-start justify-between mb-2">
            <View className="flex-1">
              <Text className="text-2xl font-bold text-foreground">{route.name}</Text>
              <Text className="text-muted text-sm mt-1">由 {route.username} 分享</Text>
            </View>
            <View
              className="px-3 py-1 rounded-full"
              style={{ backgroundColor: `${difficultyColor}20` }}
            >
              <Text style={{ color: difficultyColor }} className="text-xs font-bold">
                {difficultyLabel}
              </Text>
            </View>
          </View>

          {/* 路線描述 */}
          {route.description && (
            <Text className="text-muted text-sm mt-3">{route.description}</Text>
          )}
        </View>

        {/* 路線統計 */}
        <View className="grid grid-cols-2 gap-3 mb-4">
          <View className="bg-surface rounded-lg p-4 border border-border">
            <Text className="text-muted text-xs mb-1">距離</Text>
            <Text className="text-foreground font-bold text-lg">
              {route.distance.toFixed(1)} km
            </Text>
          </View>

          <View className="bg-surface rounded-lg p-4 border border-border">
            <Text className="text-muted text-xs mb-1">爬升</Text>
            <Text className="text-foreground font-bold text-lg">
              {route.elevationGain.toFixed(0)} m
            </Text>
          </View>

          <View className="bg-surface rounded-lg p-4 border border-border">
            <Text className="text-muted text-xs mb-1">下降</Text>
            <Text className="text-foreground font-bold text-lg">
              {route.elevationLoss.toFixed(0)} m
            </Text>
          </View>

          <View className="bg-surface rounded-lg p-4 border border-border">
            <Text className="text-muted text-xs mb-1">騎乘次數</Text>
            <Text className="text-foreground font-bold text-lg">{route.rides}</Text>
          </View>
        </View>

        {/* 評分和點讚 */}
        <View className="flex-row gap-3 mb-4">
          <View className="flex-1 bg-surface rounded-lg p-4 border border-border">
            <Text className="text-muted text-xs mb-1">平均評分</Text>
            <View className="flex-row items-center gap-2">
              <Text className="text-foreground font-bold text-lg">
                {route.averageRating.toFixed(1)}
              </Text>
              <Text className="text-muted text-xs">({route.totalRatings} 評分)</Text>
            </View>
          </View>

          <Pressable
            onPress={handleLike}
            disabled={isLoading}
            className={`flex-1 rounded-lg p-4 border items-center justify-center ${
              isLiked
                ? 'bg-error/20 border-error'
                : 'bg-surface border-border'
            }`}
          >
            <Text className="text-2xl mb-1">{isLiked ? '❤️' : '🤍'}</Text>
            <Text
              className={`font-bold text-sm ${
                isLiked ? 'text-error' : 'text-foreground'
              }`}
            >
              {route.likes}
            </Text>
          </Pressable>
        </View>

        {/* 標籤 */}
        {route.tags && route.tags.length > 0 && (
          <View className="mb-4">
            <Text className="text-foreground font-bold mb-2">標籤</Text>
            <View className="flex-row flex-wrap gap-2">
              {route.tags.map((tag) => (
                <View
                  key={tag}
                  className="bg-primary/10 px-3 py-1 rounded-full border border-primary/20"
                >
                  <Text className="text-primary text-xs font-bold">#{tag}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* 評分表單 */}
        <View className="bg-surface rounded-lg p-4 border border-border mb-4">
          <Text className="text-foreground font-bold mb-3">評分此路線</Text>

          {/* 星級評分 */}
          <View className="flex-row gap-2 mb-4">
            {[1, 2, 3, 4, 5].map((star) => (
              <Pressable
                key={star}
                onPress={() => setRating(star)}
                className="active:opacity-70"
              >
                <Text className="text-2xl">
                  {star <= rating ? '⭐' : '☆'}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* 評論輸入框 */}
          <View className="bg-background rounded-lg p-3 mb-3 border border-border">
            <Text className="text-muted text-sm">分享您的騎乘體驗...</Text>
          </View>

          {/* 提交按鈕 */}
          <Pressable
            onPress={handleRate}
            disabled={isLoading || rating === 0}
            className={`bg-primary px-4 py-3 rounded-lg active:opacity-80 ${
              isLoading || rating === 0 ? 'opacity-50' : ''
            }`}
          >
            {isLoading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white text-center font-bold">提交評分</Text>
            )}
          </Pressable>
        </View>

        {/* 開始騎乘按鈕 */}
        <Pressable className="bg-success px-4 py-4 rounded-lg active:opacity-80 mb-4">
          <Text className="text-white text-center font-bold text-lg">
            🚴 開始騎乘此路線
          </Text>
        </Pressable>
      </ScrollView>
    </ScreenContainer>
  );
}
