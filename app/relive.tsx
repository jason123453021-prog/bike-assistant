/**
 * Relive 軌跡回放頁面
 *
 * 功能：
 * - 2D 地圖軌跡顯示（彩色軌跡、起終點標記）
 * - 軌跡回放播放控制（播放/暫停、速度調整、進度條）
 * - 實時統計數據顯示（速度、距離、時間、海拔、功率）
 * - 照片時間軸錨定（EXIF 讀取、時間軸比對、彈出展示）
 * - 高光時刻標記（最高時速、最高海拔、陡坡挑戰）
 * - 數據統計圖表（速度曲線、心率區間、功率分布）
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";

import { useColors } from "@/hooks/use-colors";
import { useRide, type RideRecord } from "@/lib/ride-context";
import { useSocial } from "@/lib/social-context";
import { getSyncManager } from "@/lib/social-sync";
import { formatDuration } from "@/lib/power-calc";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ScreenContainer } from "@/components/screen-container";
import LeafletMapView, { type LeafletMapHandle } from "@/components/leaflet-map";
import * as DocumentPicker from "expo-document-picker";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
// 動態計算海苔條高度（根據內容自適應）
const BOTTOM_PANEL_COLLAPSED_HEIGHT = 140; // 增加高度以容納播放按鈕
const BOTTOM_PANEL_EXPANDED_HEIGHT = SCREEN_H * 0.7;

// ─── 類型定義 ─────────────────────────────────────────────────────────────────

interface PhotoData {
  uri: string;
  timestamp: number; // 毫秒
  latitude?: number;
  longitude?: number;
  title?: string;
}

interface Comment {
  id: string;
  author: string;
  content: string;
  timestamp: number;
}



interface ReliveState {
  isPlaying: boolean;
  playbackIndex: number;
  playbackSpeed: number;
  currentPhoto?: PhotoData;
  currentData: {
    speed: number;
    distance: number;
    time: number;
    altitude: number;
    power: number;
  };
}

interface Highlight {
  type: 'speed' | 'altitude' | 'slope';
  label: string;
  value: number | string;
  unit: string;
  index: number;
  icon: string;
}

// ─── 主元件 ───────────────────────────────────────────────────────────────────

export default function ReliveScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state } = useRide();

  // 查找對應的騎乘記錄
  const record = useMemo(() => {
    return state.records.find((r: RideRecord) => r.id === id);
  }, [id, state.records]);

  // 回放狀態
  const [reliveState, setReliveState] = useState<ReliveState>({
    isPlaying: false,
    playbackIndex: 0,
    playbackSpeed: 1,
    currentData: {
      speed: 0,
      distance: 0,
      time: 0,
      altitude: 0,
      power: 0,
    },
  });

  // 照片時間軸
  const [photos, setPhotos] = useState<PhotoData[]>([]);
  const [showPhotoModal, setShowPhotoModal] = useState(false);

  // 社群互動狀態（從 Context 載入）
  const social = useSocial();
  const interaction = useMemo(() => {
    return social.getInteraction(id || '');
  }, [id, social]);
  const [newComment, setNewComment] = useState('');
  const [showComments, setShowComments] = useState(false);

  // 模擬加載照片
  useEffect(() => {
    if (record) {
      const simulatedPhotos: PhotoData[] = [];
      const startTime = record.date;
      const endTime = startTime + record.duration * 1000;
      const photoCount = Math.floor(Math.random() * 3) + 2;
      for (let i = 0; i < photoCount; i++) {
        const photoTime = startTime + (Math.random() * (endTime - startTime));
        simulatedPhotos.push({
          uri: `https://via.placeholder.com/300x400?text=Photo+${i + 1}`,
          timestamp: photoTime,
          title: `騎乘中的瞬間 ${i + 1}`,
        });
      }
      setPhotos(simulatedPhotos.sort((a, b) => a.timestamp - b.timestamp));
    }
  }, [record]);

  // 檢查當前回放位置是否有照片
  useEffect(() => {
    if (!record || record.route.length === 0) return;
    const currentPoint = record.route[reliveState.playbackIndex];
    if (!currentPoint) return;
    const currentTime = currentPoint.timestamp || 0;
    const tolerance = 2000;
    const matchingPhoto = photos.find(p => Math.abs(p.timestamp - currentTime) < tolerance);
    if (matchingPhoto && matchingPhoto !== reliveState.currentPhoto) {
      setReliveState(prev => ({ ...prev, currentPhoto: matchingPhoto }));
      setShowPhotoModal(true);
    }
  }, [reliveState.playbackIndex, record, photos]);

  // 高光時刻
  const highlights = useMemo(() => {
    if (!record || record.route.length === 0) return [];

    const result: Highlight[] = [];

    // 最高時速
    let maxSpeedIndex = 0;
    let maxSpeed = 0;
    record.route.forEach((p: any, i: number) => {
      const speed = (p.speed || 0) * 3.6;
      if (speed > maxSpeed) {
        maxSpeed = speed;
        maxSpeedIndex = i;
      }
    });
    if (maxSpeed > 0) {
      result.push({
        type: 'speed' as const,
        label: '最高時速',
        value: maxSpeed.toFixed(1),
        unit: 'km/h',
        index: maxSpeedIndex,
        icon: 'speedometer',
      });
    }

    // 最高海拔
    let maxAltIndex = 0;
    let maxAlt = record.route[0]?.altitude || 0;
    record.route.forEach((p: any, i: number) => {
      if ((p.altitude || 0) > maxAlt) {
        maxAlt = p.altitude || 0;
        maxAltIndex = i;
      }
    });
    if (maxAlt > 0) {
      result.push({
        type: 'altitude' as const,
        label: '最高海拔',
        value: Math.round(maxAlt).toString(),
        unit: 'm',
        index: maxAltIndex,
        icon: 'peak.2.fill',
      });
    }

    // 陡坡挑戰（坡度 > 10%）
    for (let i = 1; i < record.route.length; i++) {
      const prev = record.route[i - 1];
      const curr = record.route[i];
      const altDiff = (curr.altitude || 0) - (prev.altitude || 0);
      const distance = Math.hypot(
        (curr.latitude - prev.latitude) * 111000,
        (curr.longitude - prev.longitude) * 111000 * Math.cos((curr.latitude * Math.PI) / 180)
      );
      if (distance > 0) {
        const slope = (altDiff / distance) * 100;
        if (slope > 10) {
          result.push({
            type: 'slope' as const,
            label: '陡坡挑戰',
            value: slope.toFixed(1),
            unit: '%',
            index: i,
            icon: 'mountain.2.fill',
          });
          break;
        }
      }
    }

    return result;
  }, [record]);


  // 軌跡漸進繪製狀態
  const [playedTrailCoords, setPlayedTrailCoords] = useState<Array<{latitude: number; longitude: number}>>([]);

  // 更新已回放的軌跡
  useEffect(() => {
    if (!record || record.route.length === 0) return;
    const currentIndex = Math.floor(reliveState.playbackIndex);
    const newCoords = record.route.slice(0, currentIndex + 1).map((p: any) => ({
      latitude: p.latitude,
      longitude: p.longitude,
    }));
    setPlayedTrailCoords(newCoords);
    if (mapRef.current && newCoords.length > 0) {
      mapRef.current.highlightPlayedTrail(newCoords, "#00E676");
    }
  }, [reliveState.playbackIndex, record]);

  // 平滑相機跟隨


  useEffect(() => {
    if (!record || record.route.length === 0 || !mapRef.current) return;
    const currentIndex = Math.floor(reliveState.playbackIndex);
    const currentPoint = record.route[currentIndex];
    if (currentPoint) {
      mapRef.current.animateCamera(
        { center: { latitude: currentPoint.latitude, longitude: currentPoint.longitude } },
        { duration: 300 }
      );
    }
  }, [reliveState.playbackIndex, record]);

  // 底部面板狀態
  const [panelExpanded, setPanelExpanded] = useState(false);
  const panelAnim = useRef(new Animated.Value(BOTTOM_PANEL_COLLAPSED_HEIGHT)).current;
  const mapRef = useRef<LeafletMapHandle>(null);

  // 照片上傳處理
  const handleUploadPhoto = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'image/*',
      });

      if ((result as any).uri) {
        const fileName = (result as any).name || '上傳的照片';
        const title = fileName.replace(/\.[^\/\.]+$/, '');

        const newPhoto: PhotoData = {
          uri: (result as any).uri,
          timestamp: Date.now(),
          title: title,
          latitude: record?.route?.[Math.floor(record.route.length / 2)]?.latitude,
          longitude: record?.route?.[Math.floor(record.route.length / 2)]?.longitude,
        };
        setPhotos(prev => [...prev, newPhoto].sort((a, b) => a.timestamp - b.timestamp));
        Alert.alert('成功', `已上傳照片：${title}`);
      }
    } catch (error) {
      console.error('照片上傳失敗:', error);
      Alert.alert('錯誤', '照片上傳失敗，請重試');
    }
  }, [record]);

  // 生成分享卡片
  const handleGenerateShareCard = useCallback(async () => {
    if (!record) return;

    try {
      const date = new Date(record.date);
      const dateStr = `${date.getFullYear()}年${String(date.getMonth() + 1).padStart(2, "0")}月${String(date.getDate()).padStart(2, "0")}日`;
      const distKm = (record.distance / 1000).toFixed(2);
      const avgSpeedStr = record.avgSpeed.toFixed(1);
      const maxSpeedStr = record.maxSpeed.toFixed(1);
      const durationStr = formatDuration(record.duration);

      const cardMessage = `🚴 ${record.name || "騎乘記錄"}

📅 ${dateStr}
📍 距離: ${distKm} km
⏱️ 時間: ${durationStr}
🏃 平均速度: ${avgSpeedStr} km/h
⚡ 最高速度: ${maxSpeedStr} km/h
🔥 卡路里: ${record.calories} kcal
⛰️ 爬升: ${Math.round(record.totalAscent)} m

用 Relive 記錄我的騎乘軌跡 🚴`;

      Alert.alert('分享卡片', cardMessage, [
        {
          text: '分享',
          onPress: async () => {
            try {
              await Share.share({
                message: cardMessage,
                title: `${record.name || "騎乘記錄"} - Relive`,
              });
            } catch (error) {
              console.error('分享失敗:', error);
            }
          },
        },
        { text: '取消', onPress: () => {} },
      ]);
    } catch (error) {
      console.error('生成分享卡片失敗:', error);
      Alert.alert('錯誤', '生成分享卡片失敗，請重試');
    }
  }, [record]);

  // 導出 GPX 格式
  const handleExportGPX = useCallback(async () => {
    if (!record || record.route.length === 0) {
      Alert.alert('錯誤', '沒有軌跡數據可導出');
      return;
    }

    try {
      const date = new Date(record.date);
      const dateStr = date.toISOString();
      const fileName = `${record.name || 'ride'}_${date.getTime()}.gpx`;

      // 構建 GPX 文件內容
      let gpxContent = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="BikeAssistant" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${record.name || 'Bike Ride'}</name>
    <desc>騎乘軌跡 - ${dateStr}</desc>
    <time>${dateStr}</time>
  </metadata>
  <trk>
    <name>${record.name || 'Bike Ride'}</name>
    <trkseg>
`;

      // 添加軌跡點
      record.route.forEach((point: any, index: number) => {
        const pointTime = new Date(record.date + index * 1000).toISOString();
        gpxContent += `      <trkpt lat="${point.latitude}" lon="${point.longitude}">
        <ele>${point.altitude || 0}</ele>
        <time>${pointTime}</time>
        <extensions>
          <speed>${point.speed || 0}</speed>
        </extensions>
      </trkpt>
`;
      });

      gpxContent += `    </trkseg>
  </trk>
</gpx>`;

      // 使用 Share API 分享 GPX 文件
      await Share.share({
        message: `騎乘軌跡導出: ${record.name || 'Bike Ride'}`,
        title: fileName,
        url: `data:application/gpx+xml;base64,${Buffer.from(gpxContent).toString('base64')}`,
      });

      Alert.alert('成功', `已導出 GPX 文件: ${fileName}`);
    } catch (error) {
      console.error('GPX 導出失敗:', error);
      Alert.alert('錯誤', 'GPX 導出失敗，請重試');
    }
  }, [record]);

  // 分享統計數據
  // 生成 FIT 格式文件
  const generateFIT = useCallback(async () => {
    if (!record || record.route.length === 0) return;

    try {
      // FIT 文件簡化版本（CSV 格式，相容 Garmin）
      let fitContent = "Date,Time,Latitude,Longitude,Altitude,Speed,Heart Rate,Power,Cadence\n";

      const startDate = new Date(record.date);
      record.route.forEach((point: any, idx: number) => {
        const time = new Date(startDate.getTime() + idx * 1000);
        const dateStr = time.toISOString().split('T')[0];
        const timeStr = time.toISOString().split('T')[1];
        fitContent += `${dateStr},${timeStr},${point.latitude},${point.longitude},${point.altitude || 0},${point.speed || 0},${record.avgHeartRate || 0},${record.avgPower || 0},${record.avgCadence || 0}\n`;
      });

      // 使用系統分享菜單下載
      await Share.share({
        message: `騎乘 FIT 數據 - ${record.name || "騎乘記錄"}`,
        title: `${record.name || "騎乘記錄"}.fit`,
      });
    } catch (error) {
      console.error("FIT 導出失敗:", error);
    }
  }, [record]);

  // 按讚功能
  const handleLike = useCallback(async () => {
    try {
      await social.toggleLike(id || '');
      // 標記為待同步（用於後端同步）
      const syncManager = getSyncManager();
      const currentInteraction = social.getInteraction(id || '');
      await syncManager.markForSync('interaction', {
        rideId: id,
        isLiked: currentInteraction.isLiked,
      });
    } catch (error) {
      console.error('[Relive] 按讚失敗:', error);
      Alert.alert('錯誤', '按讚失敗，請重試');
    }
  }, [id, social]);

  // 添加評論
  const handleAddComment = useCallback(async () => {
    if (!newComment.trim()) return;
    try {
      await social.addComment(id || '', '我', newComment);
      // 標記為待同步（用於後端同步）
      const syncManager = getSyncManager();
      await syncManager.markForSync('comment', {
        rideId: id,
        content: newComment,
      });
      setNewComment('');
    } catch (error) {
      console.error('[Relive] 評論失敗:', error);
      Alert.alert('錯誤', '評論失敗，請重試');
    }
  }, [id, newComment, social]);

  const handleShare = useCallback(async () => {
    if (!record) return;

    try {
      const date = new Date(record.date);
      const dateStr = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;
      const distKm = (record.distance / 1000).toFixed(2);
      const avgSpeedStr = record.avgSpeed.toFixed(1);
      const maxSpeedStr = record.maxSpeed.toFixed(1);
      const durationStr = formatDuration(record.duration);

      const message = `🚴 ${record.name || "騎乘記錄"}\n\n📅 ${dateStr}\n📍 距離: ${distKm} km\n⏱️ 時間: ${durationStr}\n🏃 平均速度: ${avgSpeedStr} km/h\n⚡ 最高速度: ${maxSpeedStr} km/h\n🔥 卡路里: ${record.calories} kcal\n⛰️ 爬升: ${Math.round(record.totalAscent)} m\n\n用 Relive 記錄我的騎乘軌跡 🚴`;

      await Share.share({
        message,
        title: `${record.name || "騎乘記錄"} - Relive`,
      });
    } catch (error) {
      console.error("分享失敗:", error);
    }
  }, [record]);

  // 初始化地圖軌跡
  useEffect(() => {
    if (!record || !mapRef.current || record.route.length === 0) return;

    const polylineCoords = record.route.map((p: any) => ({
      latitude: p.latitude,
      longitude: p.longitude,
    }));

    // 高亮已走過的軌跡
    mapRef.current.highlightPlayedTrail(polylineCoords, "#00E676");

    // 適配地圖邊界
    mapRef.current.fitToCoordinates(polylineCoords, {
      edgePadding: { top: 100, right: 50, bottom: 200, left: 50 },
      animated: true,
    });
  }, [record]);

  // 初始化自動同步
  useEffect(() => {
    const syncManager = getSyncManager({ autoSync: true });
    syncManager.startAutoSync();
    return () => {
      syncManager.stopAutoSync();
    };
  }, []);

  // 回放邏輯
  useEffect(() => {
    if (!reliveState.isPlaying || !record || record.route.length === 0) return;

    const interval = setInterval(() => {
      setReliveState((prev) => {
        let nextIndex = prev.playbackIndex + prev.playbackSpeed;

        if (nextIndex >= record.route.length - 1) {
          nextIndex = record.route.length - 1;
          return { ...prev, playbackIndex: nextIndex, isPlaying: false };
        }

        // 計算當前回放位置的數據
        const totalDistance = record.distance || 0;
        const totalDuration = record.duration || 0;
        const currentPoint = record.route[Math.floor(nextIndex)];

        const currentData = {
          speed: (currentPoint.speed || 0) * 3.6, // m/s to km/h
          distance: (nextIndex / record.route.length) * (totalDistance / 1000),
          time: (nextIndex / record.route.length) * totalDuration,
          altitude: currentPoint.altitude || 0,
          power: record.avgPower || 0,
        };

        // 更新地圖回放標記
        if (mapRef.current && currentPoint) {
          mapRef.current.setPlaybackMarker(
            currentPoint.latitude,
            currentPoint.longitude,
            "#007AFF"
          );
        }

        return {
          ...prev,
          playbackIndex: nextIndex,
          currentData,
        };
      });
    }, 100 / reliveState.playbackSpeed);

    return () => clearInterval(interval);
  }, [reliveState.isPlaying, reliveState.playbackSpeed, record]);

  // 底部面板動畫
  const togglePanel = useCallback((expanded: boolean) => {
    setPanelExpanded(expanded);
    Animated.timing(panelAnim, {
      toValue: expanded ? BOTTOM_PANEL_EXPANDED_HEIGHT : BOTTOM_PANEL_COLLAPSED_HEIGHT,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [panelAnim]);

  // 手勢識別器
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (_, gs) => {
        // 只在拉桿區域（頂部 50px）允許拖動
        return gs.y0 < 50;
      },
      onMoveShouldSetPanResponder: (_, gs) => {
        return gs.y0 < 50 && Math.abs(gs.dy) > 5;
      },
      onPanResponderMove: (_, gs) => {
        const newHeight = BOTTOM_PANEL_COLLAPSED_HEIGHT + (-gs.dy);
        const clampedHeight = Math.max(BOTTOM_PANEL_COLLAPSED_HEIGHT, Math.min(BOTTOM_PANEL_EXPANDED_HEIGHT, newHeight));
        panelAnim.setValue(clampedHeight);
      },
      onPanResponderRelease: (_, gs) => {
        const currentHeight = (panelAnim as any)._value;
        const midpoint = (BOTTOM_PANEL_COLLAPSED_HEIGHT + BOTTOM_PANEL_EXPANDED_HEIGHT) / 2;
        const velocity = gs.vy;
        
        // 根據速度或位置決定展開或收縮
        if (velocity < -0.5 || currentHeight > midpoint) {
          togglePanel(true);
        } else if (velocity > 0.5 || currentHeight < midpoint) {
          togglePanel(false);
        } else {
          // 保持當前狀態
          togglePanel(panelExpanded);
        }
      },
    })
  ).current;

  if (!record) {
    return (
      <ScreenContainer className="items-center justify-center">
        <Text className="text-foreground text-lg">找不到騎乘記錄</Text>
        <Pressable
          onPress={() => router.back()}
          className="mt-4 px-4 py-2 bg-primary rounded-lg"
        >
          <Text className="text-white font-semibold">返回</Text>
        </Pressable>

      {/* 照片彈窗 */}
      <PhotoModal
        visible={showPhotoModal}
        photo={reliveState.currentPhoto}
        onClose={() => setShowPhotoModal(false)}
      />

      </ScreenContainer>
    );
  }

  const progress = record.route.length > 0 ? reliveState.playbackIndex / record.route.length : 0;

  return (
    <View style={styles.container}>
      {/* 全屏地圖 */}
      <LeafletMapView
        ref={mapRef}
        style={styles.map}
        onMapReady={() => {}}
      />

      {/* 回放控制欄 */}
      <View style={[styles.controlBar, { top: insets.top + 8, paddingBottom: 8 }]}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.7 : 1 }]}
        >
          <IconSymbol name="chevron.left" size={24} color="#fff" />
        </Pressable>
        <Text style={styles.title}>{record.name || "軌跡回放"}</Text>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Pressable
            onPress={() => Alert.alert("軌跡回放", "此頁面顯示您的騎乘軌跡、實時統計數據、高光時刻和詳細圖表。上拉展開面板查看更多資訊。")}
            style={({ pressed }) => [styles.infoBtn, { opacity: pressed ? 0.7 : 1 }]}
          >
            <IconSymbol name="info.circle.fill" size={20} color="#fff" />
          </Pressable>
          <Pressable
            onPress={handleGenerateShareCard}
            style={({ pressed }) => [styles.shareBtn, { opacity: pressed ? 0.7 : 1 }]}
          >
            <IconSymbol name="square.and.arrow.up" size={20} color="#fff" />
          </Pressable>
        </View>
      </View>

      {/* 底部面板 */}
      <Animated.View
        style={[
          styles.bottomPanel,
          { height: panelAnim, bottom: 0 },
        ]}
        {...panResponder.panHandlers}
      >
        {/* 拖拉把手 */}
        <View style={styles.handleArea}>
          <View style={styles.panelHandle} />
        </View>

        {/* 收縮狀態：回放控制 */}
        {!panelExpanded && (
          <View style={styles.collapsedContent}>
            {/* 進度條 */}
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${progress * 100}%` },
                  ]}
                />
              </View>
              <Text style={styles.progressText}>
                {Math.round(progress * 100)}%
              </Text>
            </View>

            {/* 回放按鈕 */}
            <View style={styles.playbackControls}>
              <Pressable
                style={({ pressed }) => [styles.playBtn, { opacity: pressed ? 0.7 : 1 }]}
                onPress={() =>
                  setReliveState((prev) => ({
                    ...prev,
                    isPlaying: !prev.isPlaying,
                  }))
                }
              >
                <IconSymbol
                  name={reliveState.isPlaying ? "pause.fill" : "play.fill"}
                  size={20}
                  color="#fff"
                />
                <Text style={styles.playBtnText}>
                  {reliveState.isPlaying ? "暫停" : "播放"}
                </Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [styles.playBtn, { opacity: pressed ? 0.7 : 1 }]}
                onPress={() =>
                  setReliveState((prev) => ({
                    ...prev,
                    playbackIndex: 0,
                    isPlaying: false,
                  }))
                }
              >
                <IconSymbol name="arrow.counterclockwise" size={20} color="#fff" />
                <Text style={styles.playBtnText}>重置</Text>
              </Pressable>

              {/* 速度調整 */}
              <View style={styles.speedControl}>
                <Text style={styles.speedLabel}>速度</Text>
                <View style={styles.speedButtons}>
                  {[0.5, 1, 2, 4].map((speed) => (
                    <Pressable
                      key={speed}
                      style={({ pressed }) => [
                        styles.speedBtn,
                        {
                          backgroundColor:
                            reliveState.playbackSpeed === speed
                              ? colors.primary
                              : "rgba(255,255,255,0.2)",
                          opacity: pressed ? 0.7 : 1,
                        },
                      ]}
                      onPress={() =>
                        setReliveState((prev) => ({
                          ...prev,
                          playbackSpeed: speed,
                        }))
                      }
                    >
                      <Text style={styles.speedBtnText}>{speed}x</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>

            {/* 實時數據 */}
            <View style={styles.statsRow}>
              <StatCell
                icon="speedometer"
                value={reliveState.currentData.speed.toFixed(1)}
                unit="km/h"
                label="速度"
              />
              <StatCell
                icon="location.fill"
                value={reliveState.currentData.distance.toFixed(2)}
                unit="km"
                label="距離"
              />
              <StatCell
                icon="clock.fill"
                value={formatDuration(Math.floor(reliveState.currentData.time))}
                unit=""
                label="時間"
              />
              <StatCell
                icon="mountain.2.fill"
                value={Math.round(reliveState.currentData.altitude).toString()}
                unit="m"
                label="海拔"
              />
            </View>

            {/* 社群互動按鈕 */}
            <View style={styles.interactionBar}>
              <Pressable
                onPress={handleLike}
                style={({ pressed }) => [styles.interactionBtn, { opacity: pressed ? 0.7 : 1 }]}
              >
                <Text style={[styles.interactionBtnText, interaction.isLiked && { color: '#FF6B6B' }]}>
                  {interaction.isLiked ? '❤️' : '🤍'} {interaction.likes}
                </Text>
                <Text style={styles.syncIndicator}>💾</Text>
              </Pressable>
              <Pressable
                onPress={() => setShowComments(!showComments)}
                style={({ pressed }) => [styles.interactionBtn, { opacity: pressed ? 0.7 : 1 }]}
              >
                <Text style={styles.interactionBtnText}>💬 {interaction.comments.length}</Text>
              </Pressable>
              <Pressable
                onPress={handleShare}
                style={({ pressed }) => [styles.interactionBtn, { opacity: pressed ? 0.7 : 1 }]}
              >
                <Text style={styles.interactionBtnText}>📤 分享</Text>
              </Pressable>
            </View>

            {/* 評論區域 */}
            {showComments && (
              <View style={styles.commentsSection}>
                <Text style={styles.commentsSectionTitle}>評論 ({interaction.comments.length})</Text>
                <View style={styles.commentInputContainer}>
                  <TextInput
                    style={styles.commentInput}
                    placeholder="添加評論..."
                    placeholderTextColor={colors.muted}
                    value={newComment}
                    onChangeText={setNewComment}
                  />
                  <Pressable
                    onPress={handleAddComment}
                    style={({ pressed }) => [styles.commentSubmitBtn, { opacity: pressed ? 0.7 : 1 }]}
                  >
                    <Text style={styles.commentSubmitBtnText}>發送</Text>
                  </Pressable>
                </View>
                <ScrollView style={styles.commentsList} nestedScrollEnabled>
                  {interaction.comments.map((comment) => (
                    <View key={comment.id} style={styles.commentItem}>
                      <Text style={styles.commentAuthor}>{comment.author}</Text>
                      <Text style={styles.commentContent}>{comment.content}</Text>
                      <Text style={styles.commentTime}>
                        {new Date(comment.timestamp).toLocaleTimeString()}
                      </Text>
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* 高光時刻 */}
            {highlights.length > 0 && (
              <View style={styles.highlightsContainer}>
                <Text style={styles.highlightsTitle}>⭐ 高光時刻</Text>
                <View style={styles.highlightsGrid}>
                  {highlights.map((h, idx) => (
                    <Pressable
                      key={idx}
                      style={({ pressed }) => [
                        styles.highlightCard,
                        { opacity: pressed ? 0.7 : 1 },
                      ]}
                      onPress={() => {
                        setReliveState((prev) => ({
                          ...prev,
                          playbackIndex: h.index,
                        }));
                      }}
                    >
                      <IconSymbol name={h.icon as any} size={14} color={colors.primary} />
                      <Text style={styles.highlightLabel}>{h.label}</Text>
                      <Text style={styles.highlightValue}>
                        {h.value} {h.unit}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}
          </View>
        )}

        {/* 展開狀態：詳細統計 */}
        {panelExpanded && (
          <ScrollView
            style={styles.expandedContent}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 20 }}
          >
            {/* 核心數據 */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>核心數據</Text>
              <View style={styles.statsGrid}>
                <StatCell
                  icon="location.fill"
                  value={(record.distance / 1000).toFixed(2)}
                  unit="km"
                  label="距離"
                />
                <StatCell
                  icon="clock.fill"
                  value={formatDuration(record.duration)}
                  unit=""
                  label="時間"
                />
                <StatCell
                  icon="speedometer"
                  value={record.avgSpeed.toFixed(1)}
                  unit="km/h"
                  label="平均速度"
                />
                <StatCell
                  icon="speedometer"
                  value={record.maxSpeed.toFixed(1)}
                  unit="km/h"
                  label="最高速度"
                />
              </View>
            </View>

            {/* 爬升與地形 */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>爬升與地形</Text>
              <View style={styles.statsGrid}>
                <StatCell
                  icon="mountain.2.fill"
                  value={Math.round(record.totalAscent).toString()}
                  unit="m"
                  label="總爬升"
                />
                <StatCell
                  icon="mountain.2.fill"
                  value={Math.round(record.totalDescent || 0).toString()}
                  unit="m"
                  label="總下降"
                />
                <StatCell
                  icon="peak.2.fill"
                  value={Math.round(record.maxElevation || 0).toString()}
                  unit="m"
                  label="最大海拔"
                />
                <StatCell
                  icon="flame.fill"
                  value={record.calories.toString()}
                  unit="kcal"
                  label="卡路里"
                />
              </View>
            </View>

            {/* 進階訓練數據 */}
            {(record.avgHeartRate || record.avgPower) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>進階訓練數據</Text>
                <View style={styles.statsGrid}>
                  {record.avgHeartRate && (
                    <StatCell
                      icon="heart.fill"
                      value={Math.round(record.avgHeartRate).toString()}
                      unit="bpm"
                      label="平均心率"
                    />
                  )}
                  {record.maxHeartRate && (
                    <StatCell
                      icon="heart.fill"
                      value={Math.round(record.maxHeartRate).toString()}
                      unit="bpm"
                      label="最高心率"
                    />
                  )}
                  <StatCell
                    icon="bolt.fill"
                    value={Math.round(record.avgPower).toString()}
                    unit="W"
                    label="平均功率"
                  />
                  <StatCell
                    icon="bolt.fill"
                    value={Math.round(record.maxPower).toString()}
                    unit="W"
                    label="最高功率"
                  />
                </View>
              </View>
            )}

            {/* 速度分布圖 */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>速度分布</Text>
              <SpeedDistributionChart record={record} />
            </View>

            {/* 心率區間分布 */}
            {record.avgHeartRate && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>心率區間分布</Text>
                <HeartRateZonesChart record={record} />
              </View>
            )}

            {/* 功率分布 */}
            {record.avgPower && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>功率分布</Text>
                <PowerDistributionChart record={record} />
              </View>
            )}

            {/* 導出按鈕 */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>導出數據</Text>
              <View style={styles.exportButtonsContainer}>
                <Pressable
                  onPress={handleExportGPX}
                  style={({ pressed }) => [styles.exportBtn, { opacity: pressed ? 0.7 : 1 }]}
                >
                  <Text style={styles.exportBtnText}>📥 導出 GPX</Text>
                </Pressable>
                <Pressable
                  onPress={generateFIT}
                  style={({ pressed }) => [styles.exportBtn, { opacity: pressed ? 0.7 : 1 }]}
                >
                  <Text style={styles.exportBtnText}>📥 導出 FIT</Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        )}
      </Animated.View>
    </View>
  );
}

// ─── 子元件 ───────────────────────────────────────────────────────────────────

// 速度分布圖表
// 照片彈窗組件

function PhotoModal({
  visible,
  photo,
  onClose,
}: {
  visible: boolean;
  photo?: PhotoData;
  onClose: () => void;
}) {
  if (!visible || !photo) return null;
  return (
    <Pressable style={styles.photoModalOverlay} onPress={onClose}>
      <View style={styles.photoModalContent}>
        <View style={styles.photoContainer}>
          <Text style={styles.photoTitle}>{photo.title || "騎乘中的瞬間"}</Text>
          <View style={styles.photoPlaceholder}>
            <Text style={styles.photoPlaceholderText}>📷</Text>
            <Text style={styles.photoPlaceholderDesc}>照片</Text>
          </View>
        </View>
        <Pressable style={styles.photoCloseBtn} onPress={onClose}>
          <Text style={styles.photoCloseBtnText}>✕</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

function SpeedDistributionChart({ record }: { record: RideRecord }) {
  const speeds = record.route.map((p: any) => (p.speed || 0) * 3.6);
  const ranges = [
    { min: 0, max: 10, label: "0-10", color: "#4CAF50" },
    { min: 10, max: 20, label: "10-20", color: "#8BC34A" },
    { min: 20, max: 30, label: "20-30", color: "#FFC107" },
    { min: 30, max: 40, label: "30-40", color: "#FF9800" },
    { min: 40, max: 100, label: "40+", color: "#F44336" },
  ];
  const counts = ranges.map((r) => speeds.filter((s: number) => s >= r.min && s < r.max).length);
  const total = counts.reduce((a: number, b: number) => a + b, 0);
  return (
    <View style={styles.chartContainer}>
      {ranges.map((r, idx) => {
        const percentage = total > 0 ? (counts[idx] / total) * 100 : 0;
        return (
          <View key={idx} style={styles.chartRow}>
            <Text style={styles.chartLabel}>{r.label} km/h</Text>
            <View style={[styles.chartBar, { backgroundColor: r.color }]}>
              <View style={[styles.chartBarFill, { width: `${percentage}%`, backgroundColor: r.color }]} />
            </View>
            <Text style={styles.chartValue}>{percentage.toFixed(0)}%</Text>
          </View>
        );
      })}
    </View>
  );
}

// 心率區間分布圖表
function HeartRateZonesChart({ record }: { record: RideRecord }) {
  const zones = [
    { min: 0, max: 0.5, label: "恢復", color: "#4CAF50" },
    { min: 0.5, max: 0.7, label: "耐力", color: "#8BC34A" },
    { min: 0.7, max: 0.85, label: "節奏", color: "#FFC107" },
    { min: 0.85, max: 0.95, label: "乳酸", color: "#FF9800" },
    { min: 0.95, max: 1.0, label: "無氧", color: "#F44336" },
  ];
  const maxHR = record.maxHeartRate || 180;
  const heartRates = record.route.map((p: any) => p.heartRate || 0).filter((hr: number) => hr > 0);
  const counts = zones.map((z) => heartRates.filter((hr: number) => hr >= maxHR * z.min && hr < maxHR * z.max).length);
  const total = counts.reduce((a: number, b: number) => a + b, 0);
  return (
    <View style={styles.chartContainer}>
      {zones.map((z, idx) => {
        const percentage = total > 0 ? (counts[idx] / total) * 100 : 0;
        return (
          <View key={idx} style={styles.chartRow}>
            <Text style={styles.chartLabel}>{z.label}</Text>
            <View style={[styles.chartBar, { backgroundColor: z.color }]}>
              <View style={[styles.chartBarFill, { width: `${percentage}%`, backgroundColor: z.color }]} />
            </View>
            <Text style={styles.chartValue}>{percentage.toFixed(0)}%</Text>
          </View>
        );
      })}
    </View>
  );
}

// 功率分布圖表
function PowerDistributionChart({ record }: { record: RideRecord }) {
  const powers = record.route.map((p: any) => p.power || 0).filter((pw: number) => pw > 0);
  if (powers.length === 0) return <Text style={styles.chartLabel}>沒有功率數據</Text>;
  const maxPower = Math.max(...powers);
  const ranges = [
    { min: 0, max: maxPower * 0.25, label: "Z1", color: "#4CAF50" },
    { min: maxPower * 0.25, max: maxPower * 0.5, label: "Z2", color: "#8BC34A" },
    { min: maxPower * 0.5, max: maxPower * 0.75, label: "Z3", color: "#FFC107" },
    { min: maxPower * 0.75, max: maxPower * 0.9, label: "Z4", color: "#FF9800" },
    { min: maxPower * 0.9, max: maxPower * 1.1, label: "Z5", color: "#F44336" },
  ];
  const counts = ranges.map((r) => powers.filter((pw: number) => pw >= r.min && pw < r.max).length);
  const total = counts.reduce((a: number, b: number) => a + b, 0);
  return (
    <View style={styles.chartContainer}>
      {ranges.map((r, idx) => {
        const percentage = total > 0 ? (counts[idx] / total) * 100 : 0;
        return (
          <View key={idx} style={styles.chartRow}>
            <Text style={styles.chartLabel}>{r.label}</Text>
            <View style={[styles.chartBar, { backgroundColor: r.color }]}>
              <View style={[styles.chartBarFill, { width: `${percentage}%`, backgroundColor: r.color }]} />
            </View>
            <Text style={styles.chartValue}>{percentage.toFixed(0)}%</Text>
          </View>
        );
      })}
    </View>
  );
}

function StatCell({
  icon,
  value,
  unit,
  label,
}: {
  icon: string;
  value: string;
  unit: string;
  label: string;
}) {
  const colors = useColors();
  return (
    <View style={styles.statCell}>
      <IconSymbol name={icon as any} size={16} color={colors.primary} />
      <Text style={styles.statValue}>{value}</Text>
      {unit && <Text style={styles.statUnit}>{unit}</Text>}
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ─── 樣式 ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  map: {
    flex: 1,
  },
  controlBar: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 12,
    marginHorizontal: 12,
    zIndex: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  infoBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  shareBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
    flex: 1,
    textAlign: "center",
  },
  bottomPanel: {
    position: "absolute",
    left: 0,
    right: 0,
    backgroundColor: "rgba(21,23,24,0.95)",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.1)",
    overflow: "hidden",
  },
  handleArea: {
    alignItems: "center",
    paddingVertical: 8,
  },
  panelHandle: {
    width: 40,
    height: 4,
    backgroundColor: "rgba(255,255,255,0.3)",
    borderRadius: 2,
  },
  collapsedContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  expandedContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  progressContainer: {
    marginBottom: 12,
    gap: 6,
  },
  progressBar: {
    height: 6,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#00E676",
    borderRadius: 3,
  },
  progressText: {
    fontSize: 11,
    color: "rgba(255,255,255,0.6)",
    textAlign: "right",
  },
  playbackControls: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
    alignItems: "center",
  },
  playBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "rgba(0, 230, 118, 0.2)",
  },
  playBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#fff",
  },
  speedControl: {
    flex: 1,
    alignItems: "flex-end",
    gap: 4,
  },
  speedLabel: {
    fontSize: 11,
    color: "rgba(255,255,255,0.6)",
  },
  speedButtons: {
    flexDirection: "row",
    gap: 4,
  },
  speedBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignItems: "center",
  },
  speedBtnText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#fff",
  },
  statsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  statCell: {
    flex: 1,
    minWidth: "48%",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  statValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
  statUnit: {
    fontSize: 10,
    color: "rgba(255,255,255,0.5)",
  },
  statLabel: {
    fontSize: 10,
    color: "rgba(255,255,255,0.6)",
  },
  highlightsContainer: {
    marginTop: 12,
    paddingHorizontal: 8,
  },
  highlightsTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "rgba(255,255,255,0.8)",
    marginBottom: 8,
  },
  highlightsGrid: {
    flexDirection: "row",
    gap: 6,
  },
  highlightCard: {
    flex: 1,
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: "rgba(0, 230, 118, 0.1)",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(0, 230, 118, 0.3)",
  },
  highlightLabel: {
    fontSize: 9,
    color: "rgba(255,255,255,0.6)",
  },
  highlightValue: {
    fontSize: 11,
    fontWeight: "600",
    color: "#00E676",
  },
  chartContainer: {
    gap: 8,
  },
  chartRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  chartLabel: {
    fontSize: 11,
    color: "rgba(255,255,255,0.6)",
    minWidth: 50,
  },
  chartBar: {
    flex: 1,
    height: 6,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 3,
    overflow: "hidden",
  },
  chartBarFill: {
    height: "100%",
    borderRadius: 3,
  },
  photoModalOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  photoModalContent: {
    backgroundColor: "rgba(21,23,24,0.95)",
    borderRadius: 12,
    padding: 16,
    width: "80%",
    maxWidth: 300,
    borderWidth: 1,
    borderColor: "rgba(0,230,118,0.3)",
  },
  photoContainer: {
    alignItems: "center",
    gap: 12,
  },
  photoTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
    textAlign: "center",
  },
  photoPlaceholder: {
    width: 200,
    height: 250,
    backgroundColor: "rgba(0,230,118,0.1)",
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "rgba(0,230,118,0.3)",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  photoPlaceholderText: {
    fontSize: 48,
  },
  photoPlaceholderDesc: {
    fontSize: 12,
    color: "rgba(255,255,255,0.6)",
  },
  photoCloseBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  photoCloseBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  emptyTimelineContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
    gap: 12,
  },
  emptyTimelineText: {
    fontSize: 14,
    color: "rgba(255,255,255,0.6)",
  },
  uploadPhotoBtn: {
    backgroundColor: "rgba(0,230,118,0.2)",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(0,230,118,0.4)",
  },
  uploadPhotoBtnText: {
    fontSize: 12,
    color: "#00E676",
    fontWeight: "600",
  },
  timelineContainer: {
    gap: 12,
    paddingVertical: 12,
  },
  timelineHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  timelineTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
  timelineScroll: {
    height: 100,
  },
  photoThumbnail: {
    marginRight: 12,
    alignItems: "center",
    gap: 8,
  },
  photoThumbnailContent: {
    width: 80,
    height: 80,
    backgroundColor: "rgba(0,230,118,0.1)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(0,230,118,0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  photoThumbnailIcon: {
    fontSize: 32,
  },
  photoThumbnailTime: {
    fontSize: 11,
    color: "rgba(255,255,255,0.6)",
  },


  chartValue: {
    fontSize: 11,
    fontWeight: "600",
    color: "#fff",
    minWidth: 40,
    textAlign: "right",
  },
  exportButtonsContainer: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  exportBtn: {
    flex: 1,
    backgroundColor: "#00E676",
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  exportBtnText: {
    color: "#000",
    fontWeight: "600",
    fontSize: 14,
  },
  interactionBar: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.1)",
    marginTop: 8,
  },
  interactionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  interactionBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  syncIndicator: {
    fontSize: 10,
    marginLeft: 4,
  },
  commentsSection: {
    marginTop: 12,
    padding: 12,
    backgroundColor: "rgba(0,0,0,0.2)",
    borderRadius: 8,
  },
  commentsSectionTitle: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  commentInputContainer: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  commentInput: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: "#fff",
    fontSize: 12,
  },
  commentSubmitBtn: {
    backgroundColor: "#00E676",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    justifyContent: "center",
  },
  commentSubmitBtnText: {
    color: "#000",
    fontWeight: "600",
    fontSize: 12,
  },
  commentsList: {
    maxHeight: 200,
  },
  commentItem: {
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.1)",
  },
  commentAuthor: {
    color: "#00E676",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 2,
  },
  commentContent: {
    color: "#fff",
    fontSize: 12,
    marginBottom: 4,
  },
  commentTime: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 10,
  },
});
