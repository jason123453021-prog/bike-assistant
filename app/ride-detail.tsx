/**
 * 騎乘記錄詳細頁
 *
 * 功能：
 * - 全螢幕地圖顯示 GPS 軌跡（起點綠點、終點紅點）
 * - 路線命名（點擊標題可編輯）
 * - 底部面板：可上拉展開（完整統計）/ 下滑收縮（摘要）
 * - 完整統計：距離、時間、均速、最高速、爬升、卡路里、均功率、最大功率、水分流失、補水次數
 * - 功率分布圓餅圖
 * - 分享功能
 * - 刪除功能
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
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import LeafletMapView, { type LeafletMapHandle } from "@/components/leaflet-map";
import Svg, { G, Path } from "react-native-svg";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/use-colors";
import { useRide, type RideRecord, type RouteStats } from "@/lib/ride-context";
import { formatDuration, POWER_ZONE_NAMES, POWER_ZONE_COLORS } from "@/lib/power-calc";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useFavorites } from "@/lib/favorites-context";
import { ShareCardModal } from "@/components/share-card-modal";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const STORAGE_KEY = "@bike_records";

// 底部面板高度
const PANEL_COLLAPSED_H = 200;
const PANEL_EXPANDED_H = Math.min(SCREEN_H * 0.72, 560);

// 深色地圖樣式
const DARK_MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#1a1a2e" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8a8a9a" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#1a1a2e" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#2d2d44" }] },
  { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#373755" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#484870" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0d1b2a" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#1a2e1a" }] },
  { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
];

export default function RideDetailScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, dispatch, updateRecordName, getRouteStats } = useRide();
  const { favorites, addFavorite, removeFavorite } = useFavorites();
  const [isFavorited, setIsFavorited] = useState(false);
  const [routeStats, setRouteStats] = useState<RouteStats | null>(null);

  // 找到對應記錄
  const record = useMemo<RideRecord | null>(
    () => state.records.find((r) => r.id === id) ?? null,
    [state.records, id]
  );

  // 計算路線統計
  useEffect(() => {
    if (record) {
      const stats = getRouteStats(record.name);
      setRouteStats(stats);
    }
  }, [record, getRouteStats]);

  // 路線命名
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(record?.name ?? "");
  const nameInputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (record) setNameInput(record.name);
  }, [record]);

  const handleSaveName = useCallback(async () => {
    if (!record || !nameInput.trim()) return;
    setIsEditingName(false);
    const trimmed = nameInput.trim();
    await updateRecordName(record.id, trimmed);
    }, [record, nameInput, updateRecordName]);

  // 檢查是否已加入最愛
  useEffect(() => {
    if (record) {
      const isFav = favorites.some((f) => f.name === record.name);
      setIsFavorited(isFav);
    }
  }, [record, favorites]);

  // 加入/移除最愛 (generateGpxContent 定義後會設置)

  // 地圖 ref
  const mapRef = useRef<LeafletMapHandle>(null);

  // 低部面板
  const [panelExpanded, setPanelExpanded] = useState(false);
  const [shareCardVisible, setShareCardVisible] = useState(false);
  
  // 軌跡回放控制
  const [isPlayingTrail, setIsPlayingTrail] = useState(false);
  const [trailPlaybackSpeed, setTrailPlaybackSpeed] = useState(1);
  const [trailPlaybackIndex, setTrailPlaybackIndex] = useState(0);
  const playbackIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  // 動態計算收縮面板高度（與導航頁面一致）
  const CELL_H = 60;
  const HEADER_H = 80;
  const CTRL_H = 64;
  const dynamicCollapsedH = Math.min(
    HEADER_H + CTRL_H,
    PANEL_COLLAPSED_H
  );
  
  const panelAnim = useRef(new Animated.Value(dynamicCollapsedH)).current;
  const prevCollapsedH = useRef(dynamicCollapsedH);

  useEffect(() => {
    if (!panelExpanded && dynamicCollapsedH !== prevCollapsedH.current) {
      prevCollapsedH.current = dynamicCollapsedH;
      Animated.timing(panelAnim, {
        toValue: dynamicCollapsedH,
        duration: 200,
        useNativeDriver: false,
      }).start();
    }
  }, [dynamicCollapsedH, panelExpanded, panelAnim]);

  const togglePanel = useCallback((expand: boolean) => {
    setPanelExpanded(expand);
    Animated.timing(panelAnim, {
      toValue: expand ? PANEL_EXPANDED_H : dynamicCollapsedH,
      duration: 280,
      useNativeDriver: false,
    }).start();
  }, [panelAnim, dynamicCollapsedH]);

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
        const newHeight = dynamicCollapsedH + (-gs.dy);
        const clampedHeight = Math.max(dynamicCollapsedH, Math.min(PANEL_EXPANDED_H, newHeight));
        panelAnim.setValue(clampedHeight);
      },
      onPanResponderRelease: (_, gs) => {
        const currentHeight = (panelAnim as any)._value;
        const midpoint = (dynamicCollapsedH + PANEL_EXPANDED_H) / 2;
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

  // 地圖適配軌跡
  const polylineCoords = useMemo(() => {
    if (!record?.route || record.route.length === 0) return [];
    return record.route.map((p) => ({ latitude: p.latitude, longitude: p.longitude }));
  }, [record]);

  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    if (mapReady && polylineCoords.length > 1) {
      setTimeout(() => {
        mapRef.current?.fitToCoordinates(polylineCoords, {
          edgePadding: {
            top: insets.top + 80,
            right: 40,
            bottom: PANEL_COLLAPSED_H + 40,
            left: 40,
          },
          animated: true,
        });
      }, 600);
    }
  }, [mapReady, polylineCoords]);
  
  // 軌跡回放邏輯
  useEffect(() => {
    if (!isPlayingTrail || polylineCoords.length === 0) {
      if (playbackIntervalRef.current) {
        clearInterval(playbackIntervalRef.current);
        playbackIntervalRef.current = null;
      }
      return;
    }
    
    const interval = setInterval(() => {
      setTrailPlaybackIndex((prev) => {
        const next = prev + 1;
        if (next >= polylineCoords.length) {
          setIsPlayingTrail(false);
          return prev;
        }
        return next;
      });
    }, 100 / trailPlaybackSpeed);
    
    playbackIntervalRef.current = interval;
    return () => {
      if (playbackIntervalRef.current) {
        clearInterval(playbackIntervalRef.current);
      }
    };
  }, [isPlayingTrail, trailPlaybackSpeed, polylineCoords.length]);
  
  // 地圖自動跟隨回放位置
  useEffect(() => {
    if (trailPlaybackIndex > 0 && trailPlaybackIndex < polylineCoords.length && mapRef.current) {
      const currentCoord = polylineCoords[trailPlaybackIndex];
      (mapRef.current as any).setView([currentCoord.latitude, currentCoord.longitude], 15, { animate: true, duration: 0.3 });
    }
  }, [trailPlaybackIndex, polylineCoords]);
  
  // 計算當前回放位置的數據
  const currentPlaybackData = useMemo(() => {
    if (trailPlaybackIndex === 0 || !record) {
      return { distance: 0, time: 0, speed: 0, heartRate: 0, power: 0 };
    }
    const totalDistance = record.distance || 0;
    const totalDuration = record.duration || 0;
    const avgSpeed = record.avgSpeed || 0;
    const avgHeartRate = record.avgHeartRate || 0;
    const avgPower = record.avgPower || 0;
    
    return {
      distance: (totalDistance * trailPlaybackIndex) / polylineCoords.length,
      time: (totalDuration * trailPlaybackIndex) / polylineCoords.length,
      speed: avgSpeed,
      heartRate: avgHeartRate,
      power: avgPower,
    };
  }, [trailPlaybackIndex, polylineCoords.length, record]);
  
  const handlePlayTrail = () => {
    if (polylineCoords.length === 0) return;
    if (trailPlaybackIndex >= polylineCoords.length - 1) {
      setTrailPlaybackIndex(0);
    }
    setIsPlayingTrail(!isPlayingTrail);
  };
  
  const handleResetTrail = () => {
    setIsPlayingTrail(false);
    setTrailPlaybackIndex(0);
  };

  // 心率區間定義（5 個區間）
  const HR_ZONES = [
    { name: "恢復", min: 0, max: 0.6, color: "#4FC3F7" },      // 60% max
    { name: "有氧基礎", min: 0.6, max: 0.7, color: "#66BB6A" }, // 60-70% max
    { name: "有氧耐力", min: 0.7, max: 0.8, color: "#FDD835" }, // 70-80% max
    { name: "乳酸閾值", min: 0.8, max: 0.9, color: "#FB8C00" }, // 80-90% max
    { name: "最大強度", min: 0.9, max: 1.0, color: "#E53935" }  // 90-100% max
  ];

  // 計算心率區間分布（簡化版：基於平均心率估算）
  const calculateHeartRateZones = useCallback(() => {
    if (!record || !record.avgHeartRate || !record.maxHeartRate) return null;
    const maxHR = record.maxHeartRate || 200;
    const zones = [0, 0, 0, 0, 0];
    // 簡化處理：根據平均心率估算分布
    const avgPct = record.avgHeartRate / maxHR;
    if (avgPct <= 0.6) zones[0] = 100;
    else if (avgPct <= 0.7) { zones[0] = 50; zones[1] = 50; }
    else if (avgPct <= 0.8) { zones[1] = 50; zones[2] = 50; }
    else if (avgPct <= 0.9) { zones[2] = 50; zones[3] = 50; }
    else { zones[3] = 50; zones[4] = 50; }
    return zones;
  }, [record]);

  const heartRateZones = calculateHeartRateZones();

  // 功率分布圓餅圖
  const renderPie = useCallback(() => {
    if (!record) return null;
    const totalZones = record.powerZones.reduce((a, b) => a + b, 0);
    if (totalZones === 0) return null;
    const size = 100;
    const cx = size / 2;
    const cy = size / 2;
    const r = 38;
    let startAngle = -Math.PI / 2;
    const slices: { path: string; color: string }[] = [];

    record.powerZones.forEach((val, i) => {
      if (val === 0) return;
      const pct = val / totalZones;
      const angle = pct * 2 * Math.PI;
      const endAngle = startAngle + angle;
      const x1 = cx + r * Math.cos(startAngle);
      const y1 = cy + r * Math.sin(startAngle);
      const x2 = cx + r * Math.cos(endAngle);
      const y2 = cy + r * Math.sin(endAngle);
      const largeArc = angle > Math.PI ? 1 : 0;
      slices.push({
        path: `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`,
        color: POWER_ZONE_COLORS[i],
      });
      startAngle = endAngle;
    });

    return (
      <Svg width={size} height={size}>
        <G>{slices.map((s, i) => <Path key={i} d={s.path} fill={s.color} />)}</G>
      </Svg>
    );
  }, [record]);

  // 心率區間分布圓餅圖
  const renderHeartRatePie = useCallback(() => {
    if (!heartRateZones) return null;
    const totalZones = heartRateZones.reduce((a, b) => a + b, 0);
    if (totalZones === 0) return null;
    const size = 100;
    const cx = size / 2;
    const cy = size / 2;
    const r = 38;
    let startAngle = -Math.PI / 2;
    const slices: { path: string; color: string }[] = [];

    heartRateZones.forEach((val, i) => {
      if (val === 0) return;
      const pct = val / totalZones;
      const angle = pct * 2 * Math.PI;
      const endAngle = startAngle + angle;
      const x1 = cx + r * Math.cos(startAngle);
      const y1 = cy + r * Math.sin(startAngle);
      const x2 = cx + r * Math.cos(endAngle);
      const y2 = cy + r * Math.sin(endAngle);
      const largeArc = angle > Math.PI ? 1 : 0;
      slices.push({
        path: `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`,
        color: HR_ZONES[i].color,
      });
      startAngle = endAngle;
    });

    return (
      <Svg width={size} height={size}>
        <G>{slices.map((s, i) => <Path key={i} d={s.path} fill={s.color} />)}</G>
      </Svg>
    );
  }, [heartRateZones, HR_ZONES]);

  // 分享
  // GPX 匯出
  const generateGpxContent = useCallback((record: RideRecord): string => {
    if (!record.route || record.route.length === 0) return "";

    const distanceKm = (record.distance / 1000).toFixed(2);
    const durationHours = Math.floor(record.duration / 3600);
    const durationMinutes = Math.floor((record.duration % 3600) / 60);
    const durationStr = `${durationHours}:${String(durationMinutes).padStart(2, "0")}`;
    const minLat = Math.min(...record.route.map(p => p.latitude));
    const maxLat = Math.max(...record.route.map(p => p.latitude));
    const minLon = Math.min(...record.route.map(p => p.longitude));
    const maxLon = Math.max(...record.route.map(p => p.longitude));

    const gpxHeader = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Bike Assistant" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${record.name}</name>
    <desc>騎乘記錄 - ${new Date(record.date).toISOString()}</desc>
    <time>${new Date(record.date).toISOString()}</time>
    <author>Bike Assistant</author>
    <bounds minlat="${minLat}" minlon="${minLon}" maxlat="${maxLat}" maxlon="${maxLon}"/>
  </metadata>
  <trk>
    <name>${record.name}</name>
    <desc>騎乘統計: 距離 ${distanceKm}km | 時間 ${durationStr} | 平均速度 ${record.avgSpeed.toFixed(1)}km/h | 最高速度 ${record.maxSpeed.toFixed(1)}km/h | 爆升 ${record.totalAscent}m | 平均功率 ${Math.round(record.avgPower)}W | 最大功率 ${Math.round(record.maxPower)}W | 消費熱量 ${Math.round(record.calories)}kcal</desc>
    <extensions>
      <distance>${distanceKm}</distance>
      <duration>${record.duration}</duration>
      <avgSpeed>${record.avgSpeed.toFixed(1)}</avgSpeed>
      <maxSpeed>${record.maxSpeed.toFixed(1)}</maxSpeed>
      <totalAscent>${record.totalAscent}</totalAscent>
      <totalDescent>${record.totalDescent || 0}</totalDescent>
      <calories>${Math.round(record.calories)}</calories>
      <avgPower>${Math.round(record.avgPower)}</avgPower>
      <maxPower>${Math.round(record.maxPower)}</maxPower>
      <avgHeartRate>${Math.round(record.avgHeartRate || 0)}</avgHeartRate>
      <maxHeartRate>${Math.round(record.maxHeartRate || 0)}</maxHeartRate>
      <avgCadence>${Math.round(record.avgCadence || 0)}</avgCadence>
      <maxCadence>${Math.round(record.maxCadence || 0)}</maxCadence>
    </extensions>
    <trkseg>`;

    const trkpts = record.route
      .map(
        (pt) =>
          `      <trkpt lat="${pt.latitude}" lon="${pt.longitude}">
        <ele>${pt.altitude ?? 0}</ele>
        <time>${new Date(record.date + (pt.timestamp || 0)).toISOString()}</time>
      </trkpt>`
      )
      .join("\n");

    const gpxFooter = `
    </trkseg>
  </trk>
</gpx>`;

    return gpxHeader + "\n" + trkpts + gpxFooter;
  }, []);

  const handleExportGpx = useCallback(async () => {
    if (!record) return;
    try {
      const gpxContent = generateGpxContent(record);
      if (!gpxContent) {
        Alert.alert("錯誤", "沒有軌跡數據，無法匯出");
        return;
      }

      // 生成 .gpx 文件
      const filename = `${record.name || "騎乘"}-${new Date(record.date).getTime()}.gpx`;
      const filepath = `${FileSystem.documentDirectory}${filename}`;

      // 寫入 GPX 內容到文件
      await FileSystem.writeAsStringAsync(filepath, gpxContent, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      // 檢查是否支援分享
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        // 分享 GPX 文件
        await Sharing.shareAsync(filepath, {
          mimeType: "application/gpx+xml",
          dialogTitle: "分享 GPX 文件",
          UTI: "com.topografix.gpx",
        });
      } else {
        // 如果不支援分享，顯示文件已保存的提示
        Alert.alert("成功", `GPX 文件已保存：${filename}`);
      }
    } catch (err) {
      console.error('[RideDetail] GPX export error:', err);
      Alert.alert("錯誤", "匯出 GPX 失敗");
    }
  }, [record, generateGpxContent]);

  // 加入/移除最愛
  const handleToggleFavorite = useCallback(async () => {
    if (!record) return;
    try {
      if (isFavorited) {
        const fav = favorites.find((f) => f.name === record.name);
        if (fav) {
          await removeFavorite(fav.id);
          setIsFavorited(false);
          Alert.alert("成功", "已移除最愛");
        }
      } else {
        const gpxContent = generateGpxContent(record);
        if (gpxContent) {
          await addFavorite({
            name: record.name,
            gpxContent,
            distance: record.distance / 1000,
            estimatedTime: record.duration,
          });
          setIsFavorited(true);
          Alert.alert("成功", "已加入最愛");
        }
      }
    } catch (err) {
      Alert.alert("錯誤", isFavorited ? "移除最愛失敗" : "加入最愛失敗");
    }
  }, [record, isFavorited, favorites, addFavorite, removeFavorite, generateGpxContent]);

  const handleShare = useCallback(async () => {
    if (!record) return;
    const distKm = (record.distance / 1000).toFixed(2);
    const date = new Date(record.date);
    const dateStr = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
    const msg = [
      `🚴 ${record.name}`,
      `日期：${dateStr}`,
      `距離：${distKm} km`,
      `時間：${formatDuration(record.duration)}`,
      `有效騎乘：${formatDuration(Math.max(0, record.duration - (record.totalPausedSec ?? 0)))}`,
      `暫停時間：${formatDuration(record.totalPausedSec ?? 0)}`,
      `均速：${((record.distance / 1000) / ((record.duration - (record.totalPausedSec ?? 0)) / 3600)).toFixed(1)} km/h`,
      `最高速：${record.maxSpeed.toFixed(1)} km/h`,
      `爬升：${Math.round(record.totalAscent)} m`,
      `卡路里：${record.calories} kcal`,
      `暫停時間：${formatDuration(record.totalPausedSec ?? 0)}`,
      `均功率：${record.avgPower} W`,
      `水分流失：${Math.round(record.totalSweatMl)} ml`,
    ].join("\n");
    await Share.share({ message: msg });
  }, [record]);

  // 刪除
  const handleDelete = useCallback(() => {
    Alert.alert("刪除記錄", "確定要刪除這筆騎乘記錄嗎？", [
      { text: "取消", style: "cancel" },
      {
        text: "刪除",
        style: "destructive",
        onPress: async () => {
          if (!record) return;
          const updated = state.records.filter((r) => r.id !== record.id);
          dispatch({ type: "LOAD_RECORDS", records: updated });
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
          router.back();
        },
      },
    ]);
  }, [record, state.records, dispatch]);

  if (!record) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.errorState, { paddingTop: insets.top + 20 }]}>
          <Text style={[styles.errorText, { color: colors.muted }]}>找不到記錄</Text>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Text style={[styles.backBtnText, { color: colors.accent }]}>返回</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const date = new Date(record.date);
  const dateStr = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  const totalZones = record.powerZones.reduce((a, b) => a + b, 0);
  const zonePcts = record.powerZones.map((v) =>
    totalZones > 0 ? Math.round((v / totalZones) * 100) : 0
  );

  return (
    <View style={styles.container}>
      {/* ── 全螢幕地圖（Leaflet WebView） ── */}
      <LeafletMapView
        ref={mapRef}
        style={styles.map}
        initialRegion={{
          latitude: polylineCoords[0]?.latitude ?? 25.0478,
          longitude: polylineCoords[0]?.longitude ?? 121.5319,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
        onMapReady={() => setMapReady(true)}
        gpxPolyline={polylineCoords}
      />

      {/* ── 頂部導覽列 ── */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable
          style={({ pressed }) => [styles.topBarBtn, { opacity: pressed ? 0.6 : 1 }]}
          onPress={() => router.back()}
        >
          <IconSymbol name="chevron.right" size={20} color="#fff" style={{ transform: [{ rotate: "180deg" }] }} />
        </Pressable>

        {/* 路線名稱（可點擊編輯） */}
        {isEditingName ? (
          <TextInput
            ref={nameInputRef}
            style={styles.nameInput}
            value={nameInput}
            onChangeText={setNameInput}
            onBlur={handleSaveName}
            onSubmitEditing={handleSaveName}
            returnKeyType="done"
            autoFocus
            selectTextOnFocus
            maxLength={30}
          />
        ) : (
          <Pressable
            style={({ pressed }) => [styles.namePressable, { opacity: pressed ? 0.7 : 1 }]}
            onPress={() => {
              setIsEditingName(true);
              setTimeout(() => nameInputRef.current?.focus(), 100);
            }}
          >
            <Text style={styles.routeName} numberOfLines={1}>{record.name}</Text>
            <IconSymbol name="pencil" size={13} color="rgba(255,255,255,0.5)" />
          </Pressable>
        )}

        <Pressable
          style={({ pressed }) => [styles.topBarBtn, { opacity: pressed ? 0.6 : 1 }]}
          onPress={handleDelete}
        >
          <IconSymbol name="xmark.circle.fill" size={20} color="#FF3B30" />
        </Pressable>
      </View>

      {/* 無軌跡提示浮層 */}
      {polylineCoords.length === 0 && (
        <View style={styles.noTrailBadge}>
          <Text style={styles.noTrailText}>此記錄無 GPS 軌跡資料</Text>
        </View>
      )}

      {/* ── 底部面板 ── */}
      <Animated.View
        style={[styles.panel, { height: panelAnim, paddingBottom: insets.bottom + 8 }]}
      >
        {/* 拖拉把手 */}
        <View style={styles.handleArea} {...panResponder.panHandlers}>
          <View style={styles.panelHandle} />
          <Text style={styles.dateText}>{dateStr}</Text>
        </View>

        {/* 摘要（距離 + 時間） */}
        <View style={styles.summaryRow}>
          <SummaryCell
            icon="location.fill"
            value={(record.distance / 1000).toFixed(2)}
            unit="km"
            label="距離"
            color="#00E676"
          />
          <View style={styles.summaryDivider} />
          <SummaryCell
            icon="clock.fill"
            value={formatDuration(record.duration)}
            unit=""
            label="時間"
            color="#fff"
          />
          <View style={styles.summaryDivider} />
          <SummaryCell
            icon="flame.fill"
            value={`${record.calories}`}
            unit="kcal"
            label="卡路里"
            color="#F59E0B"
          />
        </View>

        {/* 展開後的詳細內容 */}
        {panelExpanded && (
          <ScrollView
            style={styles.expandedContent}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 20 }}
          >


            {/* 功率分布 */}
            {totalZones > 0 && (
              <View style={styles.zoneSection}>
                <Text style={styles.sectionTitle}>功率分布</Text>
                <View style={styles.zoneRow}>
                  {renderPie()}
                  <View style={styles.zoneLegend}>
                    {POWER_ZONE_NAMES.map((name, i) => (
                      <View key={i} style={styles.zoneLegendItem}>
                        <View style={[styles.zoneDot, { backgroundColor: POWER_ZONE_COLORS[i] }]} />
                        <Text style={styles.zoneName}>{name}</Text>
                        <Text style={styles.zonePct}>{zonePcts[i]}%</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            )}

            {/* 軌跡回放控制 */}
            {polylineCoords.length > 0 && (
              <View style={styles.trailPlaybackSection}>
                <Text style={styles.sectionTitle}>軌跡回放</Text>
                <View style={styles.playbackControls}>
                  <Pressable
                    style={({ pressed }) => [styles.playbackBtn, { opacity: pressed ? 0.7 : 1 }]}
                    onPress={handlePlayTrail}
                  >
                    <IconSymbol name={isPlayingTrail ? "pause.fill" : "play.fill"} size={20} color="#fff" />
                    <Text style={styles.playbackBtnText}>{isPlayingTrail ? "暫停" : "播放"}</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [styles.playbackBtn, { opacity: pressed ? 0.7 : 1 }]}
                    onPress={handleResetTrail}
                  >
                    <IconSymbol name="arrow.counterclockwise" size={20} color="#fff" />
                    <Text style={styles.playbackBtnText}>重置</Text>
                  </Pressable>
                  <View style={styles.speedControl}>
                    <Text style={styles.speedLabel}>速度: {trailPlaybackSpeed}x</Text>
                    <View style={styles.speedButtons}>
                      <Pressable
                        style={({ pressed }) => [styles.speedBtn, { opacity: pressed ? 0.7 : 1 }]}
                        onPress={() => setTrailPlaybackSpeed(Math.max(0.5, trailPlaybackSpeed - 0.5))}
                      >
                        <Text style={styles.speedBtnText}>-</Text>
                      </Pressable>
                      <Pressable
                        style={({ pressed }) => [styles.speedBtn, { opacity: pressed ? 0.7 : 1 }]}
                        onPress={() => setTrailPlaybackSpeed(Math.min(3, trailPlaybackSpeed + 0.5))}
                      >
                        <Text style={styles.speedBtnText}>+</Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
                <View style={styles.playbackProgress}>
                  <View style={styles.progressBar}>
                    <View
                      style={[
                        styles.progressBarFill,
                        { width: `${(trailPlaybackIndex / polylineCoords.length) * 100}%` },
                      ]}
                    />
                  </View>
                  <Text style={styles.progressText}>
                    {trailPlaybackIndex} / {polylineCoords.length} ({Math.round((trailPlaybackIndex / polylineCoords.length) * 100)}%)
                  </Text>
                </View>
              </View>
            )}

            {/* 心率區間分布 */}
            {heartRateZones && heartRateZones.reduce((a, b) => a + b, 0) > 0 && (
              <View style={styles.zoneSection}>
                <Text style={styles.sectionTitle}>心率區間分布</Text>
                <View style={styles.zoneRow}>
                  {renderHeartRatePie()}
                  <View style={styles.zoneLegend}>
                    {HR_ZONES.map((zone, i) => {
                      const total = heartRateZones.reduce((a, b) => a + b, 0);
                      const pct = total > 0 ? Math.round((heartRateZones[i] / total) * 100) : 0;
                      return (
                        <View key={i} style={styles.zoneLegendItem}>
                          <View style={[styles.zoneDot, { backgroundColor: zone.color }]} />
                          <Text style={styles.zoneName}>{zone.name}</Text>
                          <Text style={styles.zonePct}>{pct}%</Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              </View>
            )}

            {/* 分享按鈕 */}
            <Pressable
              style={({ pressed }) => [styles.shareBtn, { opacity: pressed ? 0.85 : 1 }]}
              onPress={handleShare}
            >
              <IconSymbol name="square.and.arrow.up" size={16} color="#fff" />
              <Text style={styles.shareBtnText}>分享記錄</Text>
            </Pressable>

            {/* GPX 匯出按鈕 */}
            <Pressable
              style={({ pressed }) => [styles.shareBtn, { opacity: pressed ? 0.85 : 1 }]}
              onPress={handleExportGpx}
            >
              <IconSymbol name="arrow.down.doc" size={16} color="#fff" />
              <Text style={styles.shareBtnText}>匯出 GPX</Text>
            </Pressable>

            {/* 加入最愛按鈕 */}
            <Pressable
              style={({ pressed }) => [styles.shareBtn, { opacity: pressed ? 0.85 : 1, backgroundColor: isFavorited ? colors.primary : "rgba(255,255,255,0.2)" }]}
              onPress={handleToggleFavorite}
            >
              <IconSymbol name={isFavorited ? "heart.fill" : "heart"} size={16} color="#fff" />
              <Text style={styles.shareBtnText}>{isFavorited ? "已最愛" : "加入最愛"}</Text>
            </Pressable>

            {/* 分享卡片按鈕 */}
            <Pressable
              style={({ pressed }) => [styles.shareBtn, { opacity: pressed ? 0.85 : 1, backgroundColor: "rgba(255,152,0,0.8)" }]}
              onPress={() => setShareCardVisible(true)}
            >
              <IconSymbol name="paperplane.fill" size={16} color="#fff" />
              <Text style={styles.shareBtnText}>分享卡片</Text>
            </Pressable>

            {/* 核心數據面板 */}
            <View style={[styles.statsPanel, { borderColor: colors.border }]}>
              <Text style={[styles.panelTitle, { color: colors.foreground }]}>核心數據</Text>
              <View style={styles.statsGrid}>
                <DetailCell label="距離" value={`${(record.distance / 1000).toFixed(2)}`} unit="km" />
                <DetailCell label="總時間" value={formatDuration(record.duration)} unit="" />
                <DetailCell label="移動時間" value={formatDuration(Math.max(0, record.duration - (record.totalPausedSec ?? 0)))} unit="" />
                <DetailCell label="平均速度" value={`${((record.distance / 1000) / ((record.duration - (record.totalPausedSec ?? 0)) / 3600)).toFixed(1)}`} unit="km/h" />
                <DetailCell label="最高速度" value={`${record.maxSpeed.toFixed(1)}`} unit="km/h" />
                <DetailCell label="消誨熱量" value={`${Math.round(record.calories)}`} unit="kcal" />
                <DetailCell label="有效騎乘" value={formatDuration(Math.max(0, record.duration - (record.totalPausedSec ?? 0)))} unit="" color="#4ADE80" />
                <DetailCell label="暫停時間" value={formatDuration(record.totalPausedSec ?? 0)} unit="" />
              </View>
            </View>

            {/* 爬升與地形數據面板 */}
            <View style={[styles.statsPanel, { borderColor: colors.border, marginTop: 12 }]}>
              <Text style={[styles.panelTitle, { color: colors.foreground }]}>爬升與地形</Text>
              <View style={styles.statsGrid}>
                <DetailCell label="總爬升高度" value={`${Math.round(record.totalAscent)}`} unit="m" color="#F59E0B" />
                <DetailCell label="總下降高度" value="0" unit="m" color="#4FC3F7" />
                <DetailCell label="最大海拔" value="0" unit="m" />
                <DetailCell label="最小海拔" value="0" unit="m" />
                <DetailCell label="平均坡度" value="0.0" unit="%" />
                <DetailCell label="最大坡度" value="0.0" unit="%" />
              </View>
            </View>

            {/* 進階訓練數據面板 */}
            <View style={[styles.statsPanel, { borderColor: colors.border, marginTop: 12 }]}>
              <Text style={[styles.panelTitle, { color: colors.foreground }]}>進階訓練數據</Text>
              <View style={styles.statsGrid}>
                <DetailCell label="平均心率" value={record.avgHeartRate ? `${record.avgHeartRate}` : "--"} unit="bpm" color="#EF4444" />
                <DetailCell label="最大心率" value={record.maxHeartRate ? `${record.maxHeartRate}` : "--"} unit="bpm" color="#EF4444" />
                <DetailCell label="平均功率" value={`${record.avgPower}`} unit="W" accent />
                <DetailCell label="最大功率" value={`${record.maxPower}`} unit="W" accent />
                <DetailCell label="標準化功率" value="--" unit="W" accent />
                <DetailCell label="平均踏頻" value={record.avgCadence ? `${record.avgCadence}` : "--"} unit="rpm" />
                <DetailCell label="最大踏頻" value={record.maxCadence ? `${record.maxCadence}` : "--"} unit="rpm" />
              </View>
            </View>

            {/* 表現指標面板 */}
            <View style={[styles.statsPanel, { borderColor: colors.border, marginTop: 12 }]}>
              <Text style={[styles.panelTitle, { color: colors.foreground }]}>表現指標</Text>
              <View style={styles.statsGrid}>
                <DetailCell label="訓練壓力分數" value="--" unit="" color="#9C27B0" />
                <DetailCell label="強度係數" value="--" unit="" />
                <DetailCell label="訓練效果" value="--" unit="" color="#00E676" />
              </View>
            </View>

            {/* 补給品記錄面板 */}
            <View style={[styles.statsPanel, { borderColor: colors.border, marginTop: 12 }]}>
              <Text style={[styles.panelTitle, { color: colors.foreground }]}>补給品記錄</Text>
              <View style={styles.statsGrid}>
                <DetailCell label="水分流失" value={`${Math.round(record.totalSweatMl)}`} unit="ml" color="#4FC3F7" />
                <DetailCell label="補水次數" value={`${record.refillCount}`} unit="次" />
                <DetailCell label="GPS 點數" value={`${record.route.length}`} unit="點" />
              </View>
            </View>

            {/* 路線統計面板 */}
            {routeStats && (
              <View style={[styles.statsPanel, { borderColor: colors.border, marginTop: 12 }]}>
                <Text style={[styles.panelTitle, { color: colors.foreground }]}>路線統計</Text>
                <View style={styles.statsGrid}>
                  <DetailCell label="騎乘次數" value={`${routeStats.rideCount}`} unit="次" />
                  <DetailCell label="平均速度" value={`${routeStats.avgSpeed.toFixed(1)}`} unit="km/h" />
                  <DetailCell label="最佳速度" value={`${routeStats.bestSpeed.toFixed(1)}`} unit="km/h" />
                  <DetailCell label="最佳時間" value={formatDuration(routeStats.bestTime)} unit="" />
                  <DetailCell label="總距離" value={`${routeStats.totalDistance.toFixed(1)}`} unit="km" />
                  <DetailCell label="總爬升" value={`${Math.round(routeStats.totalAscent)}`} unit="m" />
                </View>
              </View>
            )}
          </ScrollView>
        )}

        {/* 展開/收縮提示 */}
        {!panelExpanded && (
          <Pressable style={styles.expandHint} onPress={() => togglePanel(true)}>
            <Text style={styles.expandHintText}>上滑查看完整記錄</Text>
            <IconSymbol
              name="chevron.right"
              size={12}
              color="rgba(255,255,255,0.3)"
              style={{ transform: [{ rotate: "-90deg" }] }}
            />
          </Pressable>
        )}
      </Animated.View>

      {/* 分享卡片 Modal */}
      <ShareCardModal
        visible={shareCardVisible}
        ride={record}
        onClose={() => setShareCardVisible(false)}
      />
    </View>
  );
}

// ─── 子元件 ───────────────────────────────────────────────────────────────────

function SummaryCell({ icon, value, unit, label, color }: {
  icon: string; value: string; unit: string; label: string; color: string;
}) {
  return (
    <View style={summaryStyles.cell}>
      <IconSymbol name={icon as any} size={14} color={color} />
      <Text style={[summaryStyles.value, { color }]}>{value}</Text>
      {unit ? <Text style={summaryStyles.unit}>{unit}</Text> : null}
      <Text style={summaryStyles.label}>{label}</Text>
    </View>
  );
}

const summaryStyles = StyleSheet.create({
  cell: { flex: 1, alignItems: "center", gap: 2 },
  value: { fontSize: 20, fontWeight: "700", fontVariant: ["tabular-nums"] },
  unit: { fontSize: 10, color: "rgba(255,255,255,0.4)" },
  label: { fontSize: 10, color: "rgba(255,255,255,0.4)" },
});

function DetailCell({ label, value, unit, accent, color }: {
  label: string; value: string; unit: string; accent?: boolean; color?: string;
}) {
  const textColor = color ?? (accent ? "#00E676" : "#fff");
  return (
    <View style={detailStyles.cell}>
      <Text style={[detailStyles.value, { color: textColor }]}>{value}</Text>
      <Text style={detailStyles.unit}>{unit}</Text>
      <Text style={detailStyles.label}>{label}</Text>
    </View>
  );
}

const detailStyles = StyleSheet.create({
  cell: { width: "25%", alignItems: "center", paddingVertical: 10 },
  value: { fontSize: 16, fontWeight: "700", fontVariant: ["tabular-nums"] },
  unit: { fontSize: 9, color: "rgba(255,255,255,0.4)", marginTop: 1 },
  label: { fontSize: 9, color: "rgba(255,255,255,0.4)", marginTop: 2 },
});

// ─── 樣式 ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0d0d1a" },
  map: { width: SCREEN_W, height: SCREEN_H },

  topBar: {
    position: "absolute",
    top: 0, left: 0, right: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 10,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  topBarBtn: {
    width: 40, height: 40,
    alignItems: "center", justifyContent: "center",
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  namePressable: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    justifyContent: "center",
  },
  routeName: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
    flexShrink: 1,
  },
  nameInput: {
    flex: 1,
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },

  noTrailBadge: {
    position: "absolute",
    top: "40%",
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  noTrailText: { color: "rgba(255,255,255,0.6)", fontSize: 13 },

  // 底部面板
  panel: {
    position: "absolute",
    bottom: 0, left: 0, right: 0,
    backgroundColor: "#0d0d1a",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  handleArea: { alignItems: "center", paddingTop: 8, paddingBottom: 4 },
  panelHandle: {
    width: 36, height: 4,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 2,
    marginBottom: 6,
  },
  dateText: { color: "rgba(255,255,255,0.4)", fontSize: 11, marginBottom: 4 },

  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.08)",
    marginBottom: 8,
  },
  summaryDivider: { width: 1, height: 36, backgroundColor: "rgba(255,255,255,0.1)" },

  expandedContent: { flex: 1 },

  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.08)",
    paddingTop: 4,
    marginBottom: 12,
  },

  zoneSection: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  sectionTitle: { color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: "600", marginBottom: 10 },
  zoneRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  zoneLegend: { flex: 1, gap: 5 },
  zoneLegendItem: { flexDirection: "row", alignItems: "center", gap: 7 },
  zoneDot: { width: 8, height: 8, borderRadius: 4 },
  zoneName: { flex: 1, fontSize: 11, color: "rgba(255,255,255,0.5)" },
  zonePct: { fontSize: 12, fontWeight: "600", color: "#fff" },

  shareBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#007AFF",
    paddingVertical: 13,
    borderRadius: 12,
    marginTop: 4,
  },
  shareBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },

  expandHint: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingTop: 8,
  },
    expandHintText: { color: "rgba(255,255,255,0.3)", fontSize: 11 },
  errorState: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  errorText: { fontSize: 16 },
  backBtn: { paddingHorizontal: 20, paddingVertical: 10 },
  backBtnText: { fontSize: 16, fontWeight: "600" },
  statsPanel: {
    marginHorizontal: 12,
    marginTop: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  panelTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 12,
  },
  trailPlaybackSection: {
    marginHorizontal: 12,
    marginTop: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.05)",
  },

  playbackControls: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
    alignItems: "center",
  },
  playbackBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "rgba(0, 230, 118, 0.2)",
  },
  playbackBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#fff",
  },
  speedControl: {
    flex: 1,
    alignItems: "flex-end",
    gap: 6,
  },
  speedLabel: {
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
  },
  speedButtons: {
    flexDirection: "row",
    gap: 6,
  },
  speedBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  speedBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
  playbackProgress: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.05)",
    alignItems: "center",
    gap: 8,
  },
  progressBar: {
    width: "100%",
    height: 6,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#00E676",
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    color: "rgba(255,255,255,0.6)",
  },
});
