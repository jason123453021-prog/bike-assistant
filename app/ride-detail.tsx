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
  Dimensions,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

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
import { SpeedCurveChart, type KeyMarker, type SpeedDataPoint } from "@/components/speed-curve-chart";
import { createGpxContent } from "@/lib/gpx-export";
import { writeLocalGpxBackup } from "@/lib/local-gpx-backup";
import { buildRideSplits } from "@/lib/ride-splits";
import { useSettings } from "@/lib/settings-context";
import { calibrateSweatRate } from "@/lib/supply-calibration";
import { writeLocalFitBackup } from "@/lib/local-fit-backup";
import { attachRidePhotos, loadRidePhotoTimeline, removeRidePhoto, type RidePhotoTimelineEntry } from "@/lib/local-ride-photos";
import * as ImagePicker from "expo-image-picker";


const { width: SCREEN_W } = Dimensions.get("window");
const STORAGE_KEY = "@bike_records";

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
  const { settings, updateSettings } = useSettings();
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

  // 分享卡片
  const [shareCardVisible, setShareCardVisible] = useState(false);
  const [calibrationVisible, setCalibrationVisible] = useState(false);
  const [confirmedFluidInput, setConfirmedFluidInput] = useState("");
  const [photoTimeline, setPhotoTimeline] = useState<RidePhotoTimelineEntry[]>([]);

  const rideSplits = useMemo(() => record ? buildRideSplits(record) : [], [record]);

  const handleApplySweatCalibration = useCallback(async () => {
    if (!record) return;
    const result = calibrateSweatRate({
      estimatedSweatMl: record.totalSweatMl,
      confirmedFluidMl: Number(confirmedFluidInput),
      currentMultiplier: settings.sweatRateCalibrationMultiplier,
      completedCalibrations: settings.sweatRateCalibrationCount,
    });
    if (!result.applied) {
      Alert.alert("無法套用校正", result.reason);
      return;
    }
    await updateSettings({
      sweatRateCalibrationMultiplier: result.nextMultiplier,
      sweatRateCalibrationCount: result.nextCount,
    });
    setCalibrationVisible(false);
    setConfirmedFluidInput("");
    Alert.alert("已套用本機校正", result.reason);
  }, [confirmedFluidInput, record, settings.sweatRateCalibrationCount, settings.sweatRateCalibrationMultiplier, updateSettings]);

  const storePickedPhotos = useCallback(async (assets: ImagePicker.ImagePickerAsset[]) => {
    if (!record || assets.length === 0) return;
    const timeline = await attachRidePhotos(record.id, assets.map((asset) => ({
      uri: asset.uri,
      fileName: asset.fileName,
      exif: asset.exif as Record<string, unknown> | null | undefined,
    })));
    setPhotoTimeline(timeline);
  }, [record]);

  useEffect(() => {
    if (!record) return;
    void loadRidePhotoTimeline(record.id).then(setPhotoTimeline);
  }, [record]);

  useEffect(() => {
    let active = true;
    void ImagePicker.getPendingResultAsync().then((result) => {
      if (active && result && "canceled" in result && !result.canceled) void storePickedPhotos(result.assets);
    }).catch(() => undefined);
    return () => { active = false; };
  }, [storePickedPhotos]);

  const handlePickRidePhotos = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: 10,
      exif: true,
      quality: 1,
    });
    if (!result.canceled) await storePickedPhotos(result.assets);
  }, [storePickedPhotos]);

  const handleRemoveRidePhoto = useCallback(async (photoId: string) => {
    if (!record) return;
    const timeline = await removeRidePhoto(record.id, photoId);
    setPhotoTimeline(timeline);
  }, [record]);

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
            bottom: 80,
            left: 40,
          },
          animated: true,
        });
      }, 600);
    }
  }, [mapReady, polylineCoords]);
  

  
  // 心率區間定義（5 個區間，包含 BPM 範圍）
  const HR_ZONES = [
    { name: "恢復", min: 0, max: 0.6, color: "#4FC3F7", minBpm: 60, maxBpm: 120 },
    { name: "有氧基礎", min: 0.6, max: 0.7, color: "#66BB6A", minBpm: 120, maxBpm: 140 },
    { name: "有氧耐力", min: 0.7, max: 0.8, color: "#FDD835", minBpm: 140, maxBpm: 160 },
    { name: "乳酸閾值", min: 0.8, max: 0.9, color: "#FB8C00", minBpm: 160, maxBpm: 180 },
    { name: "最大強度", min: 0.9, max: 1.0, color: "#E53935", minBpm: 180, maxBpm: 200 }
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
  
  // 心率區間顯示（包含 BPM 範圍）
  const getHeartRateZoneDisplay = (zone: any) => {
    return `${zone.name} (${zone.minBpm}-${zone.maxBpm} bpm)`;
  };
  
  // 計算速度曲線數據
  const speedCurveData = useMemo(() => {
    if (!record || !record.route) return [];
    return record.route.map((point, idx) => ({
      index: idx,
      speed: point.speed ? point.speed * 3.6 : 0,
      power: 0,
      heartRate: record.avgHeartRate || 0,
      timestamp: point.timestamp,
    }));
  }, [record]);
  
  // 計算關鍵點標記
  const keyMarkers = useMemo(() => {
    if (!record || speedCurveData.length === 0) return [];
    
    const markers: KeyMarker[] = [];
    
    if (record.maxSpeed > 0) {
      const maxSpeedIdx = speedCurveData.reduce((maxIdx, curr, idx) => 
        curr.speed > speedCurveData[maxIdx].speed ? idx : maxIdx, 0
      );
      markers.push({
        type: "maxSpeed",
        index: maxSpeedIdx,
        value: record.maxSpeed,
        label: `最高速 ${record.maxSpeed.toFixed(1)} km/h`,
        color: "#EF4444",
      });
    }
    
    if (record.maxPower > 0) {
      markers.push({
        type: "maxPower",
        index: Math.floor(speedCurveData.length * 0.5),
        value: record.maxPower,
        label: `最大功率 ${record.maxPower.toFixed(0)} W`,
        color: "#FF9500",
      });
    }
    
    if (record.maxHeartRate && record.maxHeartRate > 0) {
      markers.push({
        type: "maxHeartRate",
        index: Math.floor(speedCurveData.length * 0.7),
        value: record.maxHeartRate,
        label: `最高心率 ${record.maxHeartRate.toFixed(0)} bpm`,
        color: "#FF453A",
      });
    }
    
    return markers;
  }, [record, speedCurveData]);
  
  // 處理關鍵點點擊 (已移除)

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

  const handleExportGpx = useCallback(async () => {
    if (!record) return;
    try {
      const backup = await writeLocalGpxBackup(record);
      if (!backup) {
        Alert.alert("錯誤", "沒有軌跡數據，無法匯出");
        return;
      }
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(backup.uri, {
          mimeType: "application/gpx+xml",
          dialogTitle: "儲存或分享 GPX 備份",
          UTI: "com.topografix.gpx",
        });
      } else {
        Alert.alert("已建立本機備份", `${backup.filename}\n已保存至 App 的本機備份資料夾。`);
      }
    } catch (err) {
      console.error('[RideDetail] GPX export error:', err);
      Alert.alert("匯出失敗", "無法建立 GPX 本機備份，請確認此記錄包含至少兩個有效 GPS 軌跡點。");
    }
  }, [record]);

  const handleExportFit = useCallback(async () => {
    if (!record) return;
    try {
      const backup = await writeLocalFitBackup(record);
      if (!backup) {
        Alert.alert("無法匯出 FIT", "此記錄至少需要兩個有效 GPS 軌跡點才能建立標準 FIT 活動檔。");
        return;
      }
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(backup.uri, {
          mimeType: "application/octet-stream",
          dialogTitle: "儲存或分享 FIT 活動檔",
        });
      } else {
        Alert.alert("已建立本機 FIT", `${backup.filename}\n已保存至 App 本機快取資料夾。`);
      }
    } catch (error) {
      console.error("[RideDetail] FIT export error:", error);
      Alert.alert("FIT 匯出失敗", "無法建立本機 FIT 檔，請確認記錄中的 GPS 軌跡完整。");
    }
  }, [record]);

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
        const gpxContent = createGpxContent(record);
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
  }, [record, isFavorited, favorites, addFavorite, removeFavorite]);

  const handleShare = useCallback(async () => {
    if (!record) return;
    const distKm = (record.distance / 1000).toFixed(2);
    const date = new Date(record.date);
    const dateStr = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
    const movingTime = Math.max(0, record.duration - (record.totalPausedSec ?? 0));
    const avgSpeedMoving = ((record.distance / 1000) / (movingTime / 3600)).toFixed(1);
    const msg = [
      `🚴 ${record.name}`,
      `日期：${dateStr}`,
      ``,
      `📊 核心數據`,
      `距離：${distKm} km`,
      `總時間：${formatDuration(record.duration)}`,
      `有效騎乘：${formatDuration(movingTime)}`,
      `暫停時間：${formatDuration(record.totalPausedSec ?? 0)}`,
      ``,
      `⚡ 速度與功率`,
      `均速：${avgSpeedMoving} km/h`,
      `最高速：${record.maxSpeed.toFixed(1)} km/h`,
      `均功率：${record.avgPower} W`,
      `最大功率：${record.maxPower} W`,
      ``,
      `⛰️ 爬升與地形`,
      `爬升：${Math.round(record.totalAscent)} m`,
      `下降：${Math.round(record.totalDescent ?? 0)} m`,
      `最高海拔：${Math.round(record.maxElevation ?? 0)} m`,
      ``,
      `❤️ 訓練數據`,
      `平均心率：${record.avgHeartRate ?? 0} bpm`,
      `最大心率：${record.maxHeartRate ?? 0} bpm`,
      `平均踏頻：${record.avgCadence ?? 0} rpm`,
      ``,
      `🔥 身體數據`,
      `卡路里：${record.calories} kcal`,
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

  const movingDuration = Math.max(0, record.duration - (record.totalPausedSec ?? 0));
  const averageMovingSpeed = movingDuration > 0
    ? (record.distance / 1000) / (movingDuration / 3600)
    : 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.pageContent, { paddingBottom: insets.bottom + 28 }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.mapHero}>
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

      </View>

      {/* ── 本機活動摘要：向上滑動頁面可查看完整數據 ── */}
      <View style={styles.activityBody}>
        <Text style={styles.activityEyebrow}>本機騎乘摘要</Text>
        <Text style={styles.activityTitle}>{record.name}</Text>
        <Text style={styles.activityDate}>{dateStr}</Text>

        <View style={styles.summaryGrid}>
          <SummaryCell
            icon="location.fill"
            value={(record.distance / 1000).toFixed(2)}
            unit="km"
            label="距離"
            color="#00E676"
          />
          <SummaryCell
            icon="clock.fill"
            value={formatDuration(movingDuration)}
            unit=""
            label="移動時間"
            color="#fff"
          />
          <SummaryCell
            icon="flame.fill"
            value={`${Math.round(record.totalAscent)}`}
            unit="m"
            label="爬升海拔"
            color="#F59E0B"
          />
          <SummaryCell
            icon="location.fill"
            value={averageMovingSpeed.toFixed(1)}
            unit="km/h"
            label="平均速度"
            color="#60A5FA"
          />
          <SummaryCell
            icon="flame.fill"
            value={`${Math.round(record.calories)}`}
            unit="kcal"
            label="卡路里"
            color="#F97316"
          />
          <SummaryCell
            icon="clock.fill"
            value={`${Math.round(record.avgPower)}`}
            unit="W"
            label="平均功率"
            color="#A78BFA"
          />
        </View>

        {(record.personalBests?.length ?? 0) > 0 && (
          <View style={styles.localInsightCard}>
            <IconSymbol name="flame.fill" size={20} color="#F59E0B" />
            <View style={styles.localInsightText}>
              <Text style={styles.localInsightTitle}>本機個人紀錄</Text>
              <Text style={styles.localInsightCopy}>本次騎乘刷新 {record.personalBests?.map((best) => best.label).join("、")}</Text>
            </View>
          </View>
        )}

        <Text style={styles.moreDataHeading}>完整騎乘數據</Text>
        <Text style={styles.moreDataHint}>繼續上滑查看地形、訓練與補給詳情</Text>

        <View style={styles.expandedContent}>


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

            {/* 坡度分布詳細統計 */}
            {record && (record.gradeDistribution || [0, 0, 0, 0, 0, 0]).reduce((a: number, b: number) => a + b, 0) > 0 && (
              <View style={styles.gradeDistributionSection}>
                <Text style={styles.sectionTitle}>坡度分布統計</Text>
                
                {/* 距離分布表 */}
                <View style={styles.tableContainer}>
                  <Text style={styles.tableTitle}>距離分布</Text>
                  <View style={styles.tableHeader}>
                    <Text style={[styles.tableHeaderCell, { flex: 1 }]}>坡度</Text>
                    <Text style={[styles.tableHeaderCell, { flex: 1 }]}>距離</Text>
                    <Text style={[styles.tableHeaderCell, { flex: 1 }]}>百分比</Text>
                  </View>
                  {['1-5%', '6-10%', '11-15%', '16-20%', '21-25%', '26%+'].map((label, idx) => {
                    const dist = (record.gradeDistribution?.[idx] || 0) / 1000;
                    const totalDist = (record.gradeDistribution || [0, 0, 0, 0, 0, 0]).reduce((a: number, b: number) => a + b, 0);
                    const pct = totalDist > 0 ? ((record.gradeDistribution?.[idx] || 0) / totalDist * 100).toFixed(1) : '0';
                    const gradeColors = ['#34C759', '#FFD60A', '#FF9500', '#FF6B6B', '#FF453A', '#8B0000'];
                    return (
                      <View key={`dist-${idx}`} style={styles.tableRow}>
                        <View style={[styles.gradeCell, { backgroundColor: gradeColors[idx] + '33' }]}>
                          <Text style={[styles.gradeCellText, { color: gradeColors[idx] }]}>{label}</Text>
                        </View>
                        <Text style={[styles.tableCell, { flex: 1 }]}>{dist.toFixed(2)} km</Text>
                        <Text style={[styles.tableCell, { flex: 1 }]}>{pct}%</Text>
                      </View>
                    );
                  })}
                </View>
                
                {/* 爬升分布表 */}
                <View style={styles.tableContainer}>
                  <Text style={styles.tableTitle}>爬升分布</Text>
                  <View style={styles.tableHeader}>
                    <Text style={[styles.tableHeaderCell, { flex: 1 }]}>坡度</Text>
                    <Text style={[styles.tableHeaderCell, { flex: 1 }]}>爬升</Text>
                    <Text style={[styles.tableHeaderCell, { flex: 1 }]}>百分比</Text>
                  </View>
                  {['1-5%', '6-10%', '11-15%', '16-20%', '21-25%', '26%+'].map((label, idx) => {
                    const ascent = (record.gradeAscentDistribution?.[idx] || 0);
                    const totalAscent = (record.gradeAscentDistribution || [0, 0, 0, 0, 0, 0]).reduce((a: number, b: number) => a + b, 0);
                    const pct = totalAscent > 0 ? (ascent / totalAscent * 100).toFixed(1) : '0';
                    const gradeColors = ['#34C759', '#FFD60A', '#FF9500', '#FF6B6B', '#FF453A', '#8B0000'];
                    return (
                      <View key={`ascent-${idx}`} style={styles.tableRow}>
                        <View style={[styles.gradeCell, { backgroundColor: gradeColors[idx] + '33' }]}>
                          <Text style={[styles.gradeCellText, { color: gradeColors[idx] }]}>{label}</Text>
                        </View>
                        <Text style={[styles.tableCell, { flex: 1 }]}>{ascent.toFixed(0)} m</Text>
                        <Text style={[styles.tableCell, { flex: 1 }]}>{pct}%</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {rideSplits.length > 0 && (
              <View style={[styles.statsPanel, { borderColor: colors.border, marginTop: 12 }]}>
                <Text style={[styles.panelTitle, { color: colors.foreground }]}>每公里分段</Text>
                <Text style={[styles.panelHint, { color: colors.muted }]}>依已保存 GPS 軌跡重建；最後一段可能不足 1 km。</Text>
                <View style={styles.splitHeader}>
                  <Text style={styles.splitHeaderText}>段</Text>
                  <Text style={styles.splitHeaderText}>時間</Text>
                  <Text style={styles.splitHeaderText}>均速</Text>
                  <Text style={styles.splitHeaderText}>爬／降</Text>
                  <Text style={styles.splitHeaderText}>功率</Text>
                </View>
                {rideSplits.map((split) => (
                  <View key={split.index} style={styles.splitRow}>
                    <Text style={styles.splitCell}>{split.distanceM >= 950 ? `${split.index} km` : `${split.index} · ${(split.distanceM / 1000).toFixed(2)} km`}</Text>
                    <Text style={styles.splitCell}>{formatDuration(split.movingTimeSeconds)}</Text>
                    <Text style={styles.splitCell}>{split.averageSpeedKmh?.toFixed(1) ?? "--"}</Text>
                    <Text style={styles.splitCell}>{`${Math.round(split.ascentM)} / ${Math.round(split.descentM)}`}</Text>
                    <Text style={styles.splitCell}>{split.averagePowerW === undefined ? "--" : `${split.averagePowerW} W`}</Text>
                  </View>
                ))}
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
              <Text style={styles.shareBtnText}>離線備份 GPX</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.shareBtn, { opacity: pressed ? 0.85 : 1, backgroundColor: "rgba(94,92,230,0.85)" }]}
              onPress={handleExportFit}
            >
              <IconSymbol name="arrow.down.doc" size={16} color="#fff" />
              <Text style={styles.shareBtnText}>匯出標準 FIT</Text>
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
                <DetailCell label="平均速度" value={record.avgSpeed.toFixed(1)} unit="km/h" />
                <DetailCell label="最高速度" value={`${record.maxSpeed.toFixed(1)}`} unit="km/h" />
                <DetailCell label="消耗熱量" value={`${Math.round(record.calories)}`} unit="kcal" />
                <DetailCell label="有效騎乘" value={formatDuration(Math.max(0, record.duration - (record.totalPausedSec ?? 0)))} unit="" color="#4ADE80" />
                <DetailCell label="暫停時間" value={formatDuration(record.totalPausedSec ?? 0)} unit="" />
              </View>
            </View>

            {/* 爬升與地形數據面板 */}
            <View style={[styles.statsPanel, { borderColor: colors.border, marginTop: 12 }]}>
              <Text style={[styles.panelTitle, { color: colors.foreground }]}>爬升與地形</Text>
              <View style={styles.statsGrid}>
                <DetailCell label="總爬升高度" value={`${Math.round(record.totalAscent)}`} unit="m" color="#F59E0B" />
                <DetailCell label="總下降高度" value={record.totalDescent !== undefined ? `${Math.round(record.totalDescent)}` : "--"} unit="m" color="#4FC3F7" />
                <DetailCell label="最大海拔" value={record.maxElevation !== undefined ? `${Math.round(record.maxElevation)}` : "--"} unit="m" />
                <DetailCell label="最小海拔" value={record.minElevation !== undefined ? `${Math.round(record.minElevation)}` : "--"} unit="m" />
                <DetailCell label="平均坡度" value={record.averageGrade !== undefined ? record.averageGrade.toFixed(1) : "--"} unit="%" />
                <DetailCell label="最大坡度" value={record.maxGrade !== undefined ? record.maxGrade.toFixed(1) : "--"} unit="%" />
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
                <DetailCell label="標準化功率" value={record.normalizedPower !== undefined ? `${Math.round(record.normalizedPower)}` : "--"} unit="W" accent />
                <DetailCell label="平均踏頻" value={record.avgCadence ? `${record.avgCadence}` : "--"} unit="rpm" />
                <DetailCell label="最大踏頻" value={record.maxCadence ? `${record.maxCadence}` : "--"} unit="rpm" />
              </View>
            </View>

            {/* 表現指標面板 */}
            <View style={[styles.statsPanel, { borderColor: colors.border, marginTop: 12 }]}> 
              <Text style={[styles.panelTitle, { color: colors.foreground }]}>表現指標</Text>
              <View style={styles.statsGrid}>
                <DetailCell label="訓練壓力分數" value={record.tss !== undefined ? `${record.tss.toFixed(1)}` : "--"} unit="" color="#9C27B0" />
                <DetailCell label="強度係數" value={record.intensityFactor !== undefined ? `${record.intensityFactor.toFixed(2)}` : "--"} unit="" />
                <DetailCell label="標準化功率" value={record.normalizedPower !== undefined ? `${Math.round(record.normalizedPower)}` : "--"} unit="W" />
              </View>
            </View>

            {/* 僅比較此裝置歷史資料的個人最佳紀錄 */}
            {(record.personalBests?.length ?? 0) > 0 && (
              <View style={[styles.statsPanel, { borderColor: "#F59E0B66", marginTop: 12 }]}> 
                <Text style={[styles.panelTitle, { color: "#F59E0B" }]}>本機個人最佳</Text>
                <Text style={[styles.personalBestHint, { color: colors.muted }]}>僅與此裝置已儲存的歷史騎乘比較，不含雲端或排行榜資料。</Text>
                <View style={styles.statsGrid}>
                  {record.personalBests?.map((best) => (
                    <DetailCell
                      key={best.metric}
                      label={best.label}
                      value={best.unit === "m" ? `${Math.round(best.value)}` : best.value.toFixed(1)}
                      unit={best.unit}
                      color="#F59E0B"
                    />
                  ))}
                </View>
              </View>
            )}

            {/* 訓練負荷與恢復建議面板 */}
            {record.tss && (
              <View style={[styles.statsPanel, { borderColor: colors.border, marginTop: 12 }]}>
                <Text style={[styles.panelTitle, { color: colors.foreground }]}>訓練負荷與恢復</Text>
                <View style={styles.statsGrid}>
                  <DetailCell label="訓練負荷" value={`${Math.round(record.tss * 1.5)}`} unit="" color="#FF6F00" />
                  <DetailCell label="負荷等級" value={record.tss > 300 ? "高" : record.tss > 150 ? "中" : "低"} unit="" />
                  <DetailCell label="建議恢復" value={record.tss > 300 ? "36-48h" : record.tss > 150 ? "24h" : "12h"} unit="" />
                </View>
              </View>
            )}

            {/* 补給品記錄面板 */}
            <View style={[styles.statsPanel, { borderColor: colors.border, marginTop: 12 }]}> 
              <Text style={[styles.panelTitle, { color: colors.foreground }]}>补給品記錄</Text>
              <View style={styles.statsGrid}>
                <DetailCell label="水分流失" value={`${Math.round(record.totalSweatMl)}`} unit="ml" color="#4FC3F7" />
                <DetailCell label="補水次數" value={`${record.refillCount}`} unit="次" />
                <DetailCell label="GPS 點數" value={`${record.route.length}`} unit="點" />
              </View>
              <Pressable
                style={({ pressed }) => [styles.calibrationButton, { borderColor: colors.primary, opacity: pressed ? 0.72 : 1 }]}
                onPress={() => setCalibrationVisible(true)}
              >
                <IconSymbol name="drop.fill" size={16} color="#4FC3F7" />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.calibrationButtonTitle, { color: colors.foreground }]}>騎後校正汗率</Text>
                  <Text style={[styles.calibrationButtonHint, { color: colors.muted }]}>確認本次補水量後，保守調整未來的本機補水建議。</Text>
                </View>
                <IconSymbol name="chevron.right" size={16} color={colors.muted} />
              </Pressable>
            </View>

            {record.calculationProfile?.environment && (
              <View style={[styles.statsPanel, { borderColor: colors.border, marginTop: 12 }]}>
                <Text style={[styles.panelTitle, { color: colors.foreground }]}>本次環境與智慧補給</Text>
                <View style={styles.statsGrid}>
                  <DetailCell label="環境樣本" value={`${record.calculationProfile.environment.sampleCount}`} unit="筆" />
                  <DetailCell label="平均溫度" value={record.calculationProfile.environment.averageTemperatureC === undefined ? "--" : record.calculationProfile.environment.averageTemperatureC.toFixed(1)} unit="°C" color="#F97316" />
                  <DetailCell label="平均濕度" value={record.calculationProfile.environment.averageHumidityPct === undefined ? "--" : record.calculationProfile.environment.averageHumidityPct.toFixed(0)} unit="%" color="#60A5FA" />
                  <DetailCell label="平均風速" value={record.calculationProfile.environment.averageWindSpeedKmh === undefined ? "--" : record.calculationProfile.environment.averageWindSpeedKmh.toFixed(1)} unit="km/h" />
                  <DetailCell label="計算來源" value={record.calculationProfile.environment.source === "live-weather" ? "當日天氣" : "離線回退"} unit="" />
                </View>
                {(record.supplyConfirmations?.length ?? 0) > 0 && (
                  <View style={styles.confirmationList}>
                    <Text style={[styles.confirmationHeading, { color: colors.muted }]}>已確認補給</Text>
                    {record.supplyConfirmations?.slice(-4).map((entry, index) => (
                      <Text key={`${entry.timestamp}-${index}`} style={[styles.confirmationText, { color: colors.foreground }]}> 
                        {entry.type === "water"
                          ? `補水 ${entry.recommendedWaterMl ?? "--"} ml`
                          : `能量 ${entry.recommendedEnergyKcal ?? "--"} kcal／碳水 ${entry.recommendedCarbohydrateG ?? "--"} g`}
                        {entry.source ? ` · ${entry.source === "custom" ? "固定門檻" : entry.source === "smart" ? "智慧計算" : "離線回退"}` : ""}
                      </Text>
                    ))}
                  </View>
                )}
              </View>
            )}

            <View style={[styles.statsPanel, { borderColor: colors.border, marginTop: 12 }]}>
              <View style={styles.photoTimelineHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.panelTitle, { color: colors.foreground, marginBottom: 3 }]}>本機相片時間軸</Text>
                  <Text style={[styles.photoTimelineHint, { color: colors.muted }]}>只會加入您現在明確選取的相片，不讀取整個相簿，也不會上傳。</Text>
                </View>
                <Pressable style={({ pressed }) => [styles.photoAddButton, { backgroundColor: colors.primary, opacity: pressed ? 0.7 : 1 }]} onPress={() => void handlePickRidePhotos()}>
                  <Text style={styles.photoAddButtonText}>加入相片</Text>
                </Pressable>
              </View>
              {photoTimeline.length === 0 ? (
                <Text style={[styles.photoEmpty, { color: colors.muted }]}>尚未加入本次騎乘相片。</Text>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoTimelineList}>
                  {photoTimeline.map((photo) => (
                    <View key={photo.id} style={styles.photoCard}>
                      <Image source={{ uri: photo.uri }} style={styles.photoImage} />
                      <Text style={[styles.photoTime, { color: colors.muted }]}>{new Date(photo.capturedAt ?? photo.selectedAt).toLocaleString("zh-TW", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</Text>
                      <Pressable style={styles.photoRemoveButton} onPress={() => void handleRemoveRidePhoto(photo.id)}>
                        <Text style={styles.photoRemoveText}>移除</Text>
                      </Pressable>
                    </View>
                  ))}
                </ScrollView>
              )}
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
        </View>
      </View>

      {/* 分享卡片 Modal */}
      <ShareCardModal
        visible={shareCardVisible}
        ride={record}
        onClose={() => setShareCardVisible(false)}
      />
      <Modal
        visible={calibrationVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCalibrationVisible(false)}
      >
        <View style={styles.calibrationOverlay}>
          <View style={[styles.calibrationModal, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.calibrationModalTitle, { color: colors.foreground }]}>騎後汗率校正</Text>
            <Text style={[styles.calibrationModalCopy, { color: colors.muted }]}>請輸入本次騎乘期間與結束後補回的總補水量（ml）。系統只會保守調整未來建議，並可隨時在設定頁重設；此功能不作醫療判斷。</Text>
            <TextInput
              value={confirmedFluidInput}
              onChangeText={setConfirmedFluidInput}
              keyboardType="number-pad"
              placeholder="例如 900"
              placeholderTextColor={colors.muted}
              style={[styles.calibrationInput, { color: colors.foreground, borderColor: colors.border }]}
            />
            <View style={styles.calibrationActions}>
              <Pressable style={[styles.calibrationAction, { borderColor: colors.border }]} onPress={() => setCalibrationVisible(false)}>
                <Text style={[styles.calibrationActionText, { color: colors.muted }]}>取消</Text>
              </Pressable>
              <Pressable style={[styles.calibrationAction, { backgroundColor: colors.primary, borderColor: colors.primary }]} onPress={() => void handleApplySweatCalibration()}>
                <Text style={[styles.calibrationActionText, { color: "#fff" }]}>確認並套用</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
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
  pageContent: { backgroundColor: "#0d0d1a" },
  mapHero: { height: 360, width: SCREEN_W, position: "relative", overflow: "hidden" },
  map: { width: SCREEN_W, height: 360 },
  activityBody: {
    backgroundColor: "#0d0d1a",
    marginTop: -20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 22,
    paddingHorizontal: 20,
    minHeight: 520,
  },
  activityEyebrow: { color: "#00E676", fontSize: 12, fontWeight: "700", letterSpacing: 0.6, marginBottom: 5 },
  activityTitle: { color: "#fff", fontSize: 27, fontWeight: "800", lineHeight: 34 },
  activityDate: { color: "rgba(255,255,255,0.5)", fontSize: 12, marginTop: 5, marginBottom: 18 },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.055)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.1)",
    paddingVertical: 14,
  },
  localInsightCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 16,
    padding: 14,
    borderRadius: 14,
    backgroundColor: "rgba(245,158,11,0.12)",
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.28)",
  },
  localInsightText: { flex: 1 },
  localInsightTitle: { color: "#FCD34D", fontSize: 14, fontWeight: "800" },
  localInsightCopy: { color: "rgba(255,255,255,0.72)", fontSize: 12, lineHeight: 17, marginTop: 3 },
  moreDataHeading: { color: "#fff", fontSize: 19, fontWeight: "800", marginTop: 24 },
  moreDataHint: { color: "rgba(255,255,255,0.45)", fontSize: 12, marginTop: 4, marginBottom: 2 },

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

  expandedContent: { paddingTop: 2 },

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
  panelHint: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: -6,
    marginBottom: 8,
  },
  calibrationButton: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  calibrationButtonTitle: { fontSize: 13, fontWeight: "700" },
  calibrationButtonHint: { fontSize: 11, lineHeight: 16, marginTop: 2 },
  confirmationList: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
    gap: 5,
  },
  confirmationHeading: { fontSize: 11, fontWeight: "700" },
  confirmationText: { fontSize: 12, lineHeight: 17 },
  photoTimelineHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  photoTimelineHint: { fontSize: 11, lineHeight: 16 },
  photoAddButton: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  photoAddButtonText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  photoEmpty: { fontSize: 12, marginTop: 14 },
  photoTimelineList: { gap: 10, paddingTop: 14 },
  photoCard: { width: 142 },
  photoImage: { width: 142, height: 106, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.08)" },
  photoTime: { fontSize: 10, marginTop: 5 },
  photoRemoveButton: { alignSelf: "flex-start", marginTop: 5, paddingVertical: 3 },
  photoRemoveText: { color: "#FF6B6B", fontSize: 11, fontWeight: "700" },
  calibrationOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.58)",
    justifyContent: "center",
    padding: 24,
  },
  calibrationModal: { borderRadius: 16, borderWidth: 1, padding: 20 },
  calibrationModalTitle: { fontSize: 18, fontWeight: "800", marginBottom: 9 },
  calibrationModalCopy: { fontSize: 13, lineHeight: 19 },
  calibrationInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 13, paddingVertical: 11, fontSize: 17, marginTop: 16 },
  calibrationActions: { flexDirection: "row", gap: 10, marginTop: 16 },
  calibrationAction: { flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 11, alignItems: "center" },
  calibrationActionText: { fontSize: 14, fontWeight: "700" },
  splitHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.12)",
    paddingBottom: 7,
  },
  splitHeaderText: {
    flex: 1,
    color: "rgba(255,255,255,0.58)",
    fontSize: 10,
    fontWeight: "700",
    textAlign: "center",
  },
  splitRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
    paddingVertical: 9,
  },
  splitCell: {
    flex: 1,
    color: "rgba(255,255,255,0.84)",
    fontSize: 10,
    fontVariant: ["tabular-nums"],
    textAlign: "center",
  },
  personalBestHint: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: -2,
    marginBottom: 10,
  },

  gradeDistributionSection: {
    marginTop: 16,
    paddingHorizontal: 12,
  },
  tableContainer: {
    marginBottom: 16,
  },
  tableTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "rgba(255,255,255,0.6)",
    marginBottom: 8,
  },
  tableHeader: {
    flexDirection: "row",
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.1)",
    gap: 8,
  },
  tableHeaderCell: {
    fontSize: 11,
    fontWeight: "600",
    color: "rgba(255,255,255,0.6)",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
    gap: 8,
    alignItems: "center",
  },
  gradeCell: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignItems: "center",
  },
  gradeCellText: {
    fontSize: 11,
    fontWeight: "600",
  },
  tableCell: {
    fontSize: 12,
    color: "rgba(255,255,255,0.8)",
  },
});
