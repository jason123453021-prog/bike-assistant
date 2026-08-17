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
  Image,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import * as Sharing from "expo-sharing";
import LeafletMapView, { type LeafletMapHandle, type PhotoMapMarker } from "@/components/leaflet-map";
import Svg, { G, Path } from "react-native-svg";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/use-colors";
import { useRide, type RideRecord, type RouteStats } from "@/lib/ride-context";
import { formatDuration, POWER_ZONE_NAMES, POWER_ZONE_COLORS } from "@/lib/power-calc";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ShareCardModal } from "@/components/share-card-modal";
import { SpeedCurveChart, type KeyMarker, type SpeedDataPoint } from "@/components/speed-curve-chart";
import { ActivityElevationChart } from "@/components/activity-elevation-chart";
import { buildActivitySensorAnalysis } from "@/lib/activity-sensor-estimates";
import { deriveLocalEstimationCalibration } from "@/lib/activity-estimation-calibration";
import { writeLocalGpxBackup } from "@/lib/local-gpx-backup";
import { buildRideSplits } from "@/lib/ride-splits";
import { buildElevationBands } from "@/lib/elevation-bands";
import { buildPhotoRouteMarkers } from "@/lib/photo-route-markers";
import { compareLocalSplitPersonalBests } from "@/lib/local-split-personal-bests";
import { buildLocalActivityHighlights, calculateBestPowerEfforts } from "@/lib/local-activity-insights";
import { buildActivityStatistics } from "@/lib/activity-statistics";
import { useSettings } from "@/lib/settings-context";
import { writeLocalFitBackup } from "@/lib/local-fit-backup";
import { attachRidePhotos, loadRidePhotoTimeline, removeRidePhoto, type RidePhotoTimelineEntry } from "@/lib/local-ride-photos";
import { persistRideMedia } from "@/lib/local-ride-media";
import { ZoomableActivityPhoto } from "@/components/zoomable-activity-photo";
import { resolveActivityCoverPhotoUri } from "@/lib/activity-media";
import { calculateGapPaceSecPerKm, formatPaceFromKmh, formatPaceSeconds, SPORT_META, type SportType } from "@/lib/sport-metrics";
import { sampleActivityMapPolyline } from "@/lib/activity-map-presentation";
import * as ImagePicker from "expo-image-picker";


const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const ACTIVITY_SUMMARY_HORIZONTAL_PADDING = 20;
const ACTIVITY_SUMMARY_CONTENT_TOP = 22;
const ACTIVITY_SUMMARY_CONTENT_BOTTOM = 20;
const ACTIVITY_VIEWER_DRAWER_COLLAPSED_HEIGHT = Math.min(Math.round(SCREEN_H * 0.46), 360);
const ACTIVITY_VIEWER_DRAWER_EXPANDED_HEIGHT = Math.min(Math.round(SCREEN_H * 0.78), 620);
const ACTIVITY_VIEWER_STAGE_COLLAPSED_HEIGHT = SCREEN_H - ACTIVITY_VIEWER_DRAWER_COLLAPSED_HEIGHT;
const ACTIVITY_VIEWER_STAGE_EXPANDED_HEIGHT = SCREEN_H - ACTIVITY_VIEWER_DRAWER_EXPANDED_HEIGHT;
const ACTIVITY_DETAIL_MAIN_HERO_HEIGHT = ACTIVITY_VIEWER_STAGE_COLLAPSED_HEIGHT + 20;

function buildStoredActivityStatistics(record: RideRecord) {
  const movingTimeSec = record.movingTime ?? Math.max(0, record.duration - (record.totalPausedSec ?? 0));
  const powerSampleDurationSec = record.avgPower > 0 ? movingTimeSec : 0;
  const powerWorkJ = (record.totalWorkKj ?? ((record.avgPower * movingTimeSec) / 1000)) * 1000;
  return buildActivityStatistics({
    distanceM: record.distance,
    movingTimeSec,
    pausedTimeSec: record.totalPausedSec ?? 0,
    totalAscentM: record.totalAscent,
    totalDescentM: record.totalDescent ?? 0,
    minElevationM: record.minElevation,
    maxElevationM: record.maxElevation,
    maxSpeedKmh: record.maxSpeed,
    maxPowerW: record.maxPower,
    powerWorkJ,
    powerSampleDurationSec,
    caloriesKcal: record.calories,
    powerSource: record.powerSource ?? "unavailable",
    caloriesSource: record.caloriesSource ?? "unavailable",
  });
}

function clampActivityViewerDrawerHeight(value: number): number {
  return Math.min(ACTIVITY_VIEWER_DRAWER_EXPANDED_HEIGHT, Math.max(ACTIVITY_VIEWER_DRAWER_COLLAPSED_HEIGHT, value));
}
const ACTIVITY_TYPES = [
  { value: "road", label: "公路" },
  { value: "gravel", label: "礫石" },
  { value: "mountain", label: "登山" },
  { value: "commute", label: "通勤" },
  { value: "indoor", label: "室內" },
] as const;

function activityTypeLabel(value: RideRecord["activityType"]): string {
  return ACTIVITY_TYPES.find((item) => item.value === value)?.label ?? "其他騎乘";
}

function isVideoMedia(uri: string): boolean {
  return /\.(mp4|mov|m4v|webm)(\?|$)/i.test(uri);
}

function formatPowerInterval(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return remainder ? `${minutes}m${remainder}s` : `${minutes}m`;
}

export default function RideDetailScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, updateRecordName, updateRideActivity, getRouteStats } = useRide();
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [editDescInput, setEditDescInput] = useState("");
  const [editNameInput, setEditNameInput] = useState("");
  const [localMedia, setLocalMedia] = useState<string[]>([]);
  const [editCoverPhotoUri, setEditCoverPhotoUri] = useState<string | undefined>(undefined);
  const [editActivityType, setEditActivityType] = useState<RideRecord["activityType"]>("road");
  const [editEquipmentInput, setEditEquipmentInput] = useState("");
  const [editRpe, setEditRpe] = useState<number | undefined>(undefined);

  const handlePickMedia = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsMultipleSelection: true,
        quality: 0.8,
      });
      if (!result.canceled && result.assets) {
        if (!record) return;
        const newUris = await persistRideMedia(record.id, result.assets);
        setLocalMedia((prev) => [...prev, ...newUris]);
      }
    } catch {
      Alert.alert("提示", "無法存取媒體庫");
    }
  };

  const handleSaveActivityEdit = async () => {
    if (!record) return;
    const persistedCoverPhotoUri = resolveActivityCoverPhotoUri(
      editCoverPhotoUri,
      coverPhotoChoices.map((photo) => photo.uri),
    );
    await updateRideActivity(record.id, {
      name: editNameInput.trim() || record.name,
      description: editDescInput.trim(),
      mediaItems: localMedia,
      coverPhotoUri: persistedCoverPhotoUri ?? null,
      activityType: editActivityType ?? "road",
      equipment: editEquipmentInput.trim(),
      perceivedExertion: editRpe,
      perceivedExertionSource: "manual",
    });
    setIsEditModalVisible(false);
    Alert.alert("成功", "已儲存活動編輯");
  };
  const { settings } = useSettings();
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
    if (record) {
      setNameInput(record.name);
      setEditNameInput(record.name);
      setEditDescInput(record.description ?? "");
      setLocalMedia(record.mediaItems ?? []);
      setEditCoverPhotoUri(record.coverPhotoUri);
      setEditActivityType(record.activityType ?? "road");
      setEditEquipmentInput(record.equipment ?? "");
      setEditRpe(record.perceivedExertion);
    }
  }, [record]);

  const handleSaveName = useCallback(async () => {
    if (!record || !nameInput.trim()) return;
    setIsEditingName(false);
    const trimmed = nameInput.trim();
    await updateRecordName(record.id, trimmed);
    }, [record, nameInput, updateRecordName]);

  // 地圖 ref
  const mapRef = useRef<LeafletMapHandle>(null);

  // 分享卡片
  const [shareCardVisible, setShareCardVisible] = useState(false);
  const [photoTimeline, setPhotoTimeline] = useState<RidePhotoTimelineEntry[]>([]);
  const [isActivityViewerVisible, setIsActivityViewerVisible] = useState(false);
  const [, setActivityViewerIndex] = useState(0);
  const [activityViewerMode, setActivityViewerMode] = useState<"route" | "photos">("route");
  const activityViewerRef = useRef<ScrollView>(null);
  const activityViewerDrawerHeight = useRef(new Animated.Value(ACTIVITY_VIEWER_DRAWER_COLLAPSED_HEIGHT)).current;
  const activityViewerDrawerExpandedRef = useRef(false);
  const activityViewerDrawerDragStartHeight = useRef(ACTIVITY_VIEWER_DRAWER_COLLAPSED_HEIGHT);

  const rideSplits = useMemo(() => record ? buildRideSplits(record) : [], [record]);
  const sportType = record?.sportType ?? "cycling";
  const elevationBands = useMemo(() => record && (sportType === "hiking" || sportType === "trail_running") ? buildElevationBands(record) : [], [record, sportType]);

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
    const removedPhoto = photoTimeline.find((photo) => photo.id === photoId);
    const timeline = await removeRidePhoto(record.id, photoId);
    setPhotoTimeline(timeline);
    if (removedPhoto?.uri === record.coverPhotoUri) {
      setEditCoverPhotoUri(undefined);
      await updateRideActivity(record.id, { coverPhotoUri: null });
    }
  }, [photoTimeline, record, updateRideActivity]);

  // 地圖適配軌跡
  const polylineCoords = useMemo(() => {
    if (!record?.route || record.route.length === 0) return [];
    return record.route.map((p) => ({
      latitude: p.latitude,
      longitude: p.longitude,
      segmentStart: p.segmentStart,
    }));
  }, [record]);
  const activityMapPolyline = useMemo(
    () => sampleActivityMapPolyline(polylineCoords),
    [polylineCoords],
  );
  const activityMapInitialRegion = useMemo(() => ({
    latitude: polylineCoords[0]?.latitude ?? 25.0478,
    longitude: polylineCoords[0]?.longitude ?? 121.5319,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  }), [polylineCoords]);
  const photoRouteMarkers = useMemo<PhotoMapMarker[]>(() => buildPhotoRouteMarkers(photoTimeline, record?.route ?? []).map((marker) => ({
    id: marker.id,
    lat: marker.latitude,
    lon: marker.longitude,
    altitude: marker.altitude,
    label: marker.label,
    source: marker.source,
  })), [photoTimeline, record?.route]);
  const activityPhotos = useMemo(() => {
    const timelinePhotos = photoTimeline.map((photo) => ({ id: photo.id, uri: photo.uri }));
    const knownUris = new Set(timelinePhotos.map((photo) => photo.uri));
    const storedPhotos = (record?.mediaItems ?? [])
      .filter((uri) => !isVideoMedia(uri) && !knownUris.has(uri))
      .map((uri, index) => ({ id: `stored-media-${index}-${uri}`, uri }));
    return [...timelinePhotos, ...storedPhotos];
  }, [photoTimeline, record?.mediaItems]);
  const coverPhotoChoices = useMemo(() => {
    const timelineChoices = photoTimeline.map((photo) => ({ id: photo.id, uri: photo.uri }));
    const knownUris = new Set(timelineChoices.map((photo) => photo.uri));
    const mediaChoices = localMedia
      .filter((uri) => !isVideoMedia(uri) && !knownUris.has(uri))
      .map((uri, index) => ({ id: `edit-media-${index}-${uri}`, uri }));
    return [...timelineChoices, ...mediaChoices];
  }, [localMedia, photoTimeline]);
  const coverPhotoUri = useMemo(
    () => resolveActivityCoverPhotoUri(record?.coverPhotoUri, activityPhotos.map((photo) => photo.uri)),
    [activityPhotos, record?.coverPhotoUri],
  );
  const localSplitPersonalBests = useMemo(
    () => record ? compareLocalSplitPersonalBests(record, state.records) : [],
    [record, state.records],
  );
  const setActivityViewerDrawer = useCallback((expanded: boolean) => {
    activityViewerDrawerExpandedRef.current = expanded;
    Animated.timing(activityViewerDrawerHeight, {
      toValue: expanded ? ACTIVITY_VIEWER_DRAWER_EXPANDED_HEIGHT : ACTIVITY_VIEWER_DRAWER_COLLAPSED_HEIGHT,
      duration: 240,
      useNativeDriver: false,
    }).start();
  }, [activityViewerDrawerHeight]);
  const activityViewerDrawerResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_event, gestureState) => !activityViewerDrawerExpandedRef.current && Math.abs(gestureState.dy) > 5,
      onPanResponderGrant: () => {
        activityViewerDrawerHeight.stopAnimation((value) => {
          activityViewerDrawerDragStartHeight.current = value;
        });
      },
      onPanResponderMove: (_event, gestureState) => {
        const nextHeight = clampActivityViewerDrawerHeight(activityViewerDrawerDragStartHeight.current - gestureState.dy);
        activityViewerDrawerHeight.setValue(nextHeight);
      },
      onPanResponderRelease: (_event, gestureState) => {
        const travel = ACTIVITY_VIEWER_DRAWER_EXPANDED_HEIGHT - ACTIVITY_VIEWER_DRAWER_COLLAPSED_HEIGHT;
        const expanded = gestureState.vy < -0.2
          || (gestureState.vy <= 0.2 && activityViewerDrawerDragStartHeight.current - gestureState.dy > ACTIVITY_VIEWER_DRAWER_COLLAPSED_HEIGHT + travel * 0.45);
        setActivityViewerDrawer(expanded);
      },
    }),
  ).current;
  const closeActivityViewer = useCallback(() => {
    setIsActivityViewerVisible(false);
    setActivityViewerDrawer(false);
  }, [setActivityViewerDrawer]);
  const openActivityViewer = useCallback((index: number) => {
    const safeIndex = Math.max(0, Math.min(index, activityPhotos.length));
    setActivityViewerIndex(safeIndex);
    setActivityViewerMode(safeIndex === 0 ? "route" : "photos");
    setActivityViewerDrawer(false);
    setIsActivityViewerVisible(true);
    if (safeIndex > 0) {
      setTimeout(() => activityViewerRef.current?.scrollTo({ x: (safeIndex - 1) * SCREEN_W, animated: false }), 80);
    }
  }, [activityPhotos.length, setActivityViewerDrawer]);
  const openPhotoFromMarker = useCallback((photoId: string) => {
    const index = activityPhotos.findIndex((photo) => photo.id === photoId);
    if (index >= 0) openActivityViewer(index + 1);
  }, [activityPhotos, openActivityViewer]);
  const handleActivityMapReady = useCallback(() => setMapReady(true), []);
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
  }, [insets.top, mapReady, polylineCoords]);

  // 心率區間定義（5 個區間，包含 BPM 範圍）
  const HR_ZONES = useMemo(() => [
    { name: "恢復", min: 0, max: 0.6, color: "#4FC3F7", minBpm: 60, maxBpm: 120 },
    { name: "有氧基礎", min: 0.6, max: 0.7, color: "#66BB6A", minBpm: 120, maxBpm: 140 },
    { name: "有氧耐力", min: 0.7, max: 0.8, color: "#FDD835", minBpm: 140, maxBpm: 160 },
    { name: "乳酸閾值", min: 0.8, max: 0.9, color: "#FB8C00", minBpm: 160, maxBpm: 180 },
    { name: "最大強度", min: 0.9, max: 1.0, color: "#E53935", minBpm: 180, maxBpm: 200 }
  ], []);

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
  
  const estimationCalibration = useMemo(
    () => deriveLocalEstimationCalibration(state.records, settings.ftp),
    [settings.ftp, state.records],
  );

  // 活動曲線：未保存感測器資料時，以本次騎乘的 GPS、坡度、FTP 與環境摘要建立明確標示的本機估算。
  const activitySensorAnalysis = useMemo(() => {
    if (!record?.route?.length) return null;
    const routeLength = Math.max(1, record.route.length - 1);
    return buildActivitySensorAnalysis(record.route.map((point, index) => ({
      timestamp: point.timestamp,
      speedKmh: Math.max(0, (point.speed ?? 0) * 3.6),
      powerW: point.power ?? record.powerHistory?.[Math.min(record.powerHistory.length - 1, Math.floor((index / routeLength) * Math.max(0, record.powerHistory.length - 1)))],
      heartRate: point.heartRate,
      cadence: point.cadence,
      gradePct: point.slope,
    })), {
      ftpW: record.calculationProfile?.ftpW ?? settings.ftp,
      age: settings.age,
      maxHeartRate: settings.maxHeartRate,
      restingHeartRate: settings.restingHeartRate,
      temperatureC: record.calculationProfile?.environment?.averageTemperatureC,
      humidityPct: record.calculationProfile?.environment?.averageHumidityPct,
      headwindMs: record.calculationProfile?.environment?.averageHeadwindMs,
      intensityAdjustment: estimationCalibration.intensityAdjustment,
      confidence: estimationCalibration.confidence,
      calibrationSampleCount: estimationCalibration.rpeSampleCount,
    });
  }, [estimationCalibration.confidence, estimationCalibration.intensityAdjustment, estimationCalibration.rpeSampleCount, record, settings.age, settings.ftp, settings.maxHeartRate, settings.restingHeartRate]);

  const speedCurveData = useMemo<SpeedDataPoint[]>(() => {
    if (!record || !activitySensorAnalysis) return [];
    const routeLength = Math.max(1, record.route.length - 1);
    return activitySensorAnalysis.points.map((point, index) => ({
      index,
      speed: point.speedKmh,
      power: point.powerW,
      heartRate: point.heartRate,
      cadence: point.cadence,
      timestamp: point.timestamp,
      distanceKm: (record.distance / 1000) * (index / routeLength),
      gradePct: point.gradePct,
    }));
  }, [activitySensorAnalysis, record]);
  
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

  const handleShare = useCallback(async () => {
    if (!record) return;
    const activityStats = buildStoredActivityStatistics(record);
    const distKm = (activityStats.distanceM / 1000).toFixed(2);
    const date = new Date(record.date);
    const dateStr = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
    const powerSourceLabel = activityStats.powerSource === "measured" ? "功率計量測" : activityStats.powerSource === "estimated" ? "本機估算" : "資料不足";
    const msg = [
      `🚴 ${record.name}`,
      `日期：${dateStr}`,
      ``,
      `📊 核心數據`,
      `距離：${distKm} km`,
      `活動時間：${formatDuration(activityStats.elapsedTimeSec)}`,
      `移動時間：${formatDuration(activityStats.movingTimeSec)}`,
      `暫停時間：${formatDuration(activityStats.pausedTimeSec)}`,
      ``,
      `⚡ 速度與功率`,
      `均速：${activityStats.averageSpeedKmh.toFixed(1)} km/h`,
      `最高速：${activityStats.maxSpeedKmh.toFixed(1)} km/h`,
      `均功率：${Math.round(activityStats.averagePowerW ?? 0)} W（${powerSourceLabel}）`,
      `最大功率：${Math.round(activityStats.maxPowerW)} W`,
      `機械工作量：${activityStats.totalWorkKj === undefined ? "--" : Math.round(activityStats.totalWorkKj)} kJ`,
      ``,
      `⛰️ 爬升與地形`,
      `爬升：${Math.round(activityStats.totalAscentM)} m`,
      `下降：${Math.round(activityStats.totalDescentM)} m`,
      `最高海拔：${activityStats.maxElevationM === undefined ? "--" : Math.round(activityStats.maxElevationM)} m`,
      ``,
      `❤️ 訓練數據`,
      `平均心率：${record.avgHeartRate ?? 0} bpm`,
      `最大心率：${record.maxHeartRate ?? 0} bpm`,
      `平均踏頻：${record.avgCadence ?? 0} rpm`,
      ``,
      `🔥 身體數據`,
      `卡路里：${Math.round(activityStats.caloriesKcal)} kcal（本機估算）`,
      `水分流失：${Math.round(record.totalSweatMl)} ml`,
    ].join("\n");
    await Share.share({ message: msg });
  }, [record]);

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

  const activityStats = buildStoredActivityStatistics(record);
  const movingDuration = activityStats.movingTimeSec;
  const averageMovingSpeed = activityStats.averageSpeedKmh;
  const activityHighlights = buildLocalActivityHighlights(record, state.records);
  const bestPowerEfforts = calculateBestPowerEfforts(record);

  return (
    <View style={styles.container}>
      <View style={styles.mapHero}>
      {/* ── 全螢幕地圖（Leaflet WebView） ── */}
      <LeafletMapView
        ref={mapRef}
        style={styles.map}
        initialRegion={activityMapInitialRegion}
        onMapReady={handleActivityMapReady}
        gpxPolyline={activityMapPolyline}
        photoMarkers={photoRouteMarkers}
        onPhotoMarkerPress={openPhotoFromMarker}
      />
      {coverPhotoUri ? (
        <Pressable
          style={({ pressed }) => [styles.activityCoverPhoto, { opacity: pressed ? 0.86 : 1 }]}
          onPress={() => {
            const index = activityPhotos.findIndex((photo) => photo.uri === coverPhotoUri);
            if (index >= 0) openActivityViewer(index + 1);
          }}
        >
          <Image source={{ uri: coverPhotoUri }} style={styles.activityCoverImage} />
          <View style={styles.activityCoverShade}>
            <Text style={styles.activityCoverEyebrow}>活動封面</Text>
            <Text style={styles.activityCoverCopy}>點擊全螢幕查看與縮放</Text>
          </View>
        </Pressable>
      ) : null}
      {!coverPhotoUri && polylineCoords.length > 1 ? (
        <Pressable
          style={({ pressed }) => [styles.activityRouteExpandButton, { opacity: pressed ? 0.72 : 1 }]}
          accessibilityRole="button"
          accessibilityLabel="全螢幕檢視路線軌跡"
          onPress={() => openActivityViewer(0)}
        >
          <Text style={styles.activityRouteExpandButtonText}>全螢幕路線</Text>
        </Pressable>
      ) : null}

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
          onPress={handleShare}
        >
          <IconSymbol name="paperplane.fill" size={17} color="#fff" />
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.topBarBtn, { opacity: pressed ? 0.6 : 1, backgroundColor: "rgba(0,230,118,0.2)" }]}
          onPress={() => {
            setEditNameInput(record.name);
            setEditDescInput(record.description ?? "");
            setLocalMedia(record.mediaItems ?? []);
            setEditCoverPhotoUri(record.coverPhotoUri);
            setIsEditModalVisible(true);
          }}
        >
          <IconSymbol name="pencil" size={17} color="#00E676" />
        </Pressable>
      </View>

      {/* 無軌跡提示浮層 */}
      {polylineCoords.length === 0 && (
        <View style={styles.noTrailBadge}>
          <Text style={styles.noTrailText}>此記錄無 GPS 軌跡資料</Text>
        </View>
      )}

      {activityPhotos.length > 0 && (
        <Pressable style={({ pressed }) => [styles.routeMapPhotoThumbButton, { opacity: pressed ? 0.78 : 1 }]} onPress={() => openActivityViewer(1)}>
          <Image source={{ uri: activityPhotos[0].uri }} style={styles.routeMapPhotoThumbImage} />
          <View style={styles.routeMapPhotoThumbBadge}>
            <IconSymbol name="photo.fill" size={13} color="#fff" />
            <Text style={styles.routeMapPhotoThumbCount}>{activityPhotos.length}</Text>
          </View>
        </Pressable>
      )}

      </View>

      {/* ── 本機活動摘要：向上滑動頁面可查看完整數據 ── */}
      <ScrollView
        style={styles.activityDetailScroll}
        contentContainerStyle={[styles.pageContent, { paddingBottom: insets.bottom + 28 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.activityBody}>
        <View style={styles.activityInitialSummary}>
          <ActivitySummaryHeader
            title={record.name}
            subtitle={`${dateStr} · ${SPORT_META[record.sportType ?? "cycling"].label}`}
          />
          <CoreActivitySummaryGrid
            distanceKm={activityStats.distanceM / 1000}
            ascentM={activityStats.totalAscentM}
            movingDuration={movingDuration}
            averagePowerW={activityStats.averagePowerW ?? 0}
            averageSpeedKmh={averageMovingSpeed}
            calories={activityStats.caloriesKcal}
            sportType={record.sportType ?? "cycling"}
            averageGrade={record.averageGrade ?? 0}
            altitudeM={record.maxElevation ?? 0}
          />
        </View>

        <View style={styles.activityDetailsAfterInitial}>
          <Text style={styles.activityEyebrow}>活動詳情</Text>
          <View style={styles.activityMetaRow}>
            <View style={styles.activityMetaChip}>
              <Text style={styles.activityMetaChipText}>{activityTypeLabel(record.activityType)}</Text>
            </View>
            {record.perceivedExertion !== undefined && (
              <View style={[styles.activityMetaChip, styles.activityMetaRpeChip]}>
                <Text style={styles.activityMetaRpeText}>{record.perceivedExertionSource === "app-estimate" ? "App 推定 " : ""}RPE {record.perceivedExertion}/10</Text>
              </View>
            )}
            {record.equipment ? <Text style={styles.activityEquipment}>{record.equipment}</Text> : null}
          </View>
        </View>

        {activityHighlights.length > 0 && (
          <View style={styles.activityHighlightsCard}>
            <Text style={styles.activityHighlightsTitle}>本機成果</Text>
            {activityHighlights.map((highlight) => {
              const color = highlight.accent === "gold" ? "#F6C445" : highlight.accent === "green" ? "#00E676" : "#60A5FA";
              return (
                <View key={`${highlight.kind}-${highlight.title}`} style={styles.activityHighlightRow}>
                  <View style={[styles.activityHighlightDot, { backgroundColor: color }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.activityHighlightTitleText}>{highlight.title}</Text>
                    <Text style={styles.activityHighlightDetail}>{highlight.detail}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        <View style={styles.activityAnalysisCard}>
          <Text style={styles.activityAnalysisTitle}>活動分析</Text>
          <Text style={styles.activityAnalysisHint}>拖曳曲線查看位置讀值；僅使用本次騎乘收集的資料</Text>
          {speedCurveData.length > 1 ? (
            <SpeedCurveChart
              data={speedCurveData}
              currentIndex={0}
              markers={keyMarkers}
              sources={activitySensorAnalysis?.sources ?? { speed: "measured", power: "estimated", heartRate: "estimated", cadence: "estimated" }}
              confidence={activitySensorAnalysis?.confidence}
              confidenceFactors={activitySensorAnalysis?.factors}
            />
          ) : <Text style={styles.activityAnalysisEmpty}>此活動沒有足夠的 GPS 取樣資料可繪製速度曲線。</Text>}
          <ActivityElevationChart route={record.route} />
          {bestPowerEfforts.length > 0 && (
            <View style={styles.bestPowerBlock}>
              <Text style={styles.bestPowerTitle}>最佳平均功率</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bestPowerRow}>
                {bestPowerEfforts.map((effort) => (
                  <View key={effort.seconds} style={styles.bestPowerChip}>
                    <Text style={styles.bestPowerDuration}>{formatPowerInterval(effort.seconds)}</Text>
                    <Text style={styles.bestPowerWatts}>{effort.watts} W</Text>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}
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
                  <Text style={styles.splitHeaderText}>{sportType === "running" || sportType === "trail_running" ? "配速" : "均速"}</Text>
                  <Text style={styles.splitHeaderText}>爬／降</Text>
                  <Text style={styles.splitHeaderText}>{sportType === "trail_running" ? "GAP" : sportType === "hiking" ? "VAM" : "功率"}</Text>
                </View>
                {rideSplits.map((split) => (
                  <View key={split.index} style={styles.splitRow}>
                    <Text style={styles.splitCell}>{split.distanceM >= 950 ? `${split.index} km` : `${split.index} · ${(split.distanceM / 1000).toFixed(2)} km`}</Text>
                    <Text style={styles.splitCell}>{formatDuration(split.movingTimeSeconds)}</Text>
                    <Text style={styles.splitCell}>{sportType === "running" || sportType === "trail_running" ? formatPaceSeconds(split.paceSecondsPerKm ?? 0) : split.averageSpeedKmh?.toFixed(1) ?? "--"}</Text>
                    <Text style={styles.splitCell}>{`${Math.round(split.ascentM)} / ${Math.round(split.descentM)}`}</Text>
                    <Text style={styles.splitCell}>{sportType === "trail_running" ? formatPaceSeconds(calculateGapPaceSecPerKm(split.paceSecondsPerKm ?? 0, record.averageGrade ?? 0)) : sportType === "hiking" ? `${split.movingTimeSeconds > 0 ? Math.round((split.ascentM / split.movingTimeSeconds) * 3600) : 0}` : split.averagePowerW === undefined ? "--" : `${split.averagePowerW} W`}</Text>
                  </View>
                ))}
              </View>
            )}

            {elevationBands.length > 0 && (
              <View style={[styles.statsPanel, { borderColor: colors.border, marginTop: 12 }]}> 
                <Text style={[styles.panelTitle, { color: colors.foreground }]}>海拔區間分布</Text>
                <Text style={[styles.panelHint, { color: colors.muted }]}>依本次儲存的 GPS 海拔與軌跡距離建立，不使用外部地形資料。</Text>
                <View style={styles.splitHeader}>
                  <Text style={styles.splitHeaderText}>海拔</Text>
                  <Text style={styles.splitHeaderText}>距離</Text>
                  <Text style={styles.splitHeaderText}>停留</Text>
                  <Text style={styles.splitHeaderText}>爬升</Text>
                </View>
                {elevationBands.map((band) => (
                  <View key={band.label} style={styles.splitRow}>
                    <Text style={styles.splitCell}>{band.label}</Text>
                    <Text style={styles.splitCell}>{(band.distanceM / 1000).toFixed(2)} km</Text>
                    <Text style={styles.splitCell}>{formatDuration(band.movingTimeSeconds)}</Text>
                    <Text style={styles.splitCell}>{Math.round(band.ascentM)} m</Text>
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
                <DetailCell label="距離" value={`${(activityStats.distanceM / 1000).toFixed(2)}`} unit="km" />
                <DetailCell label="活動時間" value={formatDuration(activityStats.elapsedTimeSec)} unit="" />
                <DetailCell label="移動時間" value={formatDuration(activityStats.movingTimeSec)} unit="" />
                <DetailCell label="平均速度" value={activityStats.averageSpeedKmh.toFixed(1)} unit="km/h" />
                <DetailCell label="最高速度" value={`${activityStats.maxSpeedKmh.toFixed(1)}`} unit="km/h" />
                <DetailCell label="消耗熱量" value={`${Math.round(activityStats.caloriesKcal)}`} unit="kcal（估算）" />
                <DetailCell label="暫停時間" value={formatDuration(activityStats.pausedTimeSec)} unit="" />
              </View>
            </View>

            {/* 爬升與地形數據面板 */}
            <View style={[styles.statsPanel, { borderColor: colors.border, marginTop: 12 }]}>
              <Text style={[styles.panelTitle, { color: colors.foreground }]}>爬升與地形</Text>
              <View style={styles.statsGrid}>
                <DetailCell label="總爬升高度" value={`${Math.round(activityStats.totalAscentM)}`} unit="m" color="#F59E0B" />
                <DetailCell label="總下降高度" value={`${Math.round(activityStats.totalDescentM)}`} unit="m" color="#4FC3F7" />
                <DetailCell label="最大海拔" value={activityStats.maxElevationM === undefined ? "--" : `${Math.round(activityStats.maxElevationM)}`} unit="m" />
                <DetailCell label="最小海拔" value={activityStats.minElevationM === undefined ? "--" : `${Math.round(activityStats.minElevationM)}`} unit="m" />
                <DetailCell label="平均坡度" value={activityStats.averageGradePct === undefined ? "--" : activityStats.averageGradePct.toFixed(1)} unit="%" />
                <DetailCell label="最大坡度" value={record.maxGrade !== undefined ? record.maxGrade.toFixed(1) : "--"} unit="%" />
              </View>
            </View>

            {/* 進階訓練數據面板 */}
            <View style={[styles.statsPanel, { borderColor: colors.border, marginTop: 12 }]}>
              <Text style={[styles.panelTitle, { color: colors.foreground }]}>進階訓練數據</Text>
              <View style={styles.statsGrid}>
                <DetailCell label="平均心率" value={record.avgHeartRate ? `${record.avgHeartRate}` : "--"} unit="bpm" color="#EF4444" />
                <DetailCell label="最大心率" value={record.maxHeartRate ? `${record.maxHeartRate}` : "--"} unit="bpm" color="#EF4444" />
                <DetailCell label="平均功率" value={activityStats.averagePowerW === undefined ? "--" : `${Math.round(activityStats.averagePowerW)}`} unit="W（估算）" accent />
                <DetailCell label="最大功率" value={`${Math.round(activityStats.maxPowerW)}`} unit="W（估算）" accent />
                <DetailCell label="機械工作量" value={activityStats.totalWorkKj === undefined ? "--" : `${Math.round(activityStats.totalWorkKj)}`} unit="kJ" accent />
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

            {rideSplits.length > 0 && (
              <View style={[styles.statsPanel, { borderColor: colors.border, marginTop: 12 }]}> 
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <Text style={[styles.panelTitle, { color: colors.foreground }]}>本機分段功率表現</Text>
                  <Text style={{ fontSize: 12, color: colors.muted }}>由 GPS 軌跡重建</Text>
                </View>
                {rideSplits.slice(0, 4).map((split) => (
                  <View key={`power-${split.index}`} style={[styles.segmentCard, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                      <Text style={[styles.segmentTitle, { color: colors.foreground }]}>{split.distanceM >= 950 ? `${split.index} km 分段` : `第 ${split.index} 段`}</Text>
                      <Text style={{ fontSize: 12, color: colors.muted }}>{(split.distanceM / 1000).toFixed(2)} 公里</Text>
                    </View>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                      <Text style={{ fontSize: 18, fontWeight: "bold", color: colors.foreground }}>{formatDuration(split.movingTimeSeconds)}</Text>
                      <View style={{ flexDirection: "row", gap: 12 }}>
                        <Text style={{ fontSize: 13, color: colors.muted }}>{split.averageSpeedKmh?.toFixed(1) ?? "--"} 公里/小時</Text>
                        <Text style={{ fontSize: 13, fontWeight: "600", color: "#FF9500" }}>{split.averagePowerW === undefined ? "--" : `${split.averagePowerW} 瓦`}</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {localSplitPersonalBests.length > 0 && (
              <View style={[styles.statsPanel, { borderColor: "#F59E0B66", marginTop: 12 }]}> 
                <Text style={[styles.panelTitle, { color: "#FCD34D" }]}>本機 1 km 個人最佳比較</Text>
                <Text style={[styles.personalBestHint, { color: colors.muted }]}>僅比較此裝置較早活動的完整 1 km GPS 努力，不會將不同道路誤稱為同一雲端路段。</Text>
                {localSplitPersonalBests.slice(0, 4).map(({ split, priorBestSeconds, isPersonalBest, comparedEffortCount }) => (
                  <View key={`local-best-${split.index}`} style={[styles.segmentCard, { backgroundColor: colors.surface, borderColor: isPersonalBest ? "#F59E0B88" : colors.border }]}> 
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <Text style={[styles.segmentTitle, { color: colors.foreground }]}>第 {split.index} 個 1 km</Text>
                      <Text style={{ color: isPersonalBest ? "#FCD34D" : colors.muted, fontSize: 11, fontWeight: "800" }}>{isPersonalBest ? "本機最佳" : `${comparedEffortCount} 次可比努力`}</Text>
                    </View>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                      <Text style={{ color: colors.foreground, fontSize: 17, fontWeight: "800" }}>{formatDuration(split.movingTimeSeconds)}</Text>
                      <Text style={{ color: colors.muted, fontSize: 12 }}>{priorBestSeconds === undefined ? "尚無較早可比資料" : `歷史最佳 ${formatDuration(priorBestSeconds)}`}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

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
            {record.tss !== undefined && record.tss > 0 && (
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
                  <Text style={[styles.photoAddButtonText, { color: colors.onAccent }]}>加入相片</Text>
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
      </ScrollView>

      {/* 分享卡片 Modal */}
      <ShareCardModal
        visible={shareCardVisible}
        ride={record}
        onClose={() => setShareCardVisible(false)}
      />

      <Modal visible={isActivityViewerVisible} animationType="fade" onRequestClose={closeActivityViewer}>
        <View style={styles.mediaViewer}>
          <Animated.View
            style={[
              styles.activityViewerStage,
              {
                height: activityViewerDrawerHeight.interpolate({
                  inputRange: [ACTIVITY_VIEWER_DRAWER_COLLAPSED_HEIGHT, ACTIVITY_VIEWER_DRAWER_EXPANDED_HEIGHT],
                  outputRange: [ACTIVITY_VIEWER_STAGE_COLLAPSED_HEIGHT, ACTIVITY_VIEWER_STAGE_EXPANDED_HEIGHT],
                  extrapolate: "clamp",
                }),
              },
            ]}
          >
            {activityViewerMode === "route" ? (
              <LeafletMapView
                style={styles.activityViewerRouteMap}
                initialRegion={activityMapInitialRegion}
                gpxPolyline={activityMapPolyline}
                photoMarkers={photoRouteMarkers}
                onPhotoMarkerPress={openPhotoFromMarker}
              />
            ) : (
              <ScrollView
                ref={activityViewerRef}
                style={styles.activityViewerPhotoPager}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.activityViewerPhotoPagerContent}
                onMomentumScrollEnd={(event) => setActivityViewerIndex(Math.round(event.nativeEvent.contentOffset.x / SCREEN_W) + 1)}
              >
                {activityPhotos.map((photo) => (
                  <View key={photo.id} style={styles.mediaViewerPage}>
                    <ZoomableActivityPhoto uri={photo.uri} resetKey={photo.id} fillContainer />
                  </View>
                ))}
              </ScrollView>
            )}
          </Animated.View>

          <Pressable style={styles.mediaViewerClose} onPress={closeActivityViewer}>
            <IconSymbol name="xmark" size={20} color="#fff" />
          </Pressable>

          <Animated.View style={[styles.activityViewerDrawer, { height: activityViewerDrawerHeight }]} {...activityViewerDrawerResponder.panHandlers}>
            <ActivitySummaryHeader
              title={record.name}
              subtitle={`${dateStr} · ${SPORT_META[record.sportType ?? "cycling"].label}`}
            />

            <CoreActivitySummaryGrid
              distanceKm={record.distance / 1000}
              ascentM={record.totalAscent}
              movingDuration={movingDuration}
              averagePowerW={record.avgPower}
              averageSpeedKmh={averageMovingSpeed}
              calories={record.calories}
              sportType={record.sportType ?? "cycling"}
              averageGrade={record.averageGrade ?? 0}
              altitudeM={record.maxElevation ?? 0}
            />
          </Animated.View>
        </View>
      </Modal>

      {/* 編輯活動 Modal (名稱、心得描述、相片與影片新增) */}
      <Modal visible={isEditModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>編輯活動</Text>
            <ScrollView style={{ maxHeight: 400 }} contentContainerStyle={{ gap: 12 }}>
              <View>
                <Text style={[styles.label, { color: colors.muted }]}>活動名稱</Text>
                <TextInput
                  value={editNameInput}
                  onChangeText={setEditNameInput}
                  style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.surface }]}
                />
              </View>
              <View>
                <Text style={[styles.label, { color: colors.muted }]}>活動類型</Text>
                <View style={styles.activityTypePicker}>
                  {ACTIVITY_TYPES.map((item) => {
                    const selected = editActivityType === item.value;
                    return (
                      <Pressable
                        key={item.value}
                        onPress={() => setEditActivityType(item.value)}
                        style={[styles.activityTypeOption, { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? `${colors.primary}22` : colors.surface }]}
                      >
                        <Text style={{ color: selected ? colors.primary : colors.muted, fontSize: 12, fontWeight: "700" }}>{item.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
              <View>
                <Text style={[styles.label, { color: colors.muted }]}>裝備備註</Text>
                <TextInput
                  value={editEquipmentInput}
                  onChangeText={setEditEquipmentInput}
                  placeholder="例如：公路車、32 mm 胎、備用燈"
                  placeholderTextColor={colors.muted}
                  maxLength={80}
                  style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.surface }]}
                />
              </View>
              <View>
                <Text style={[styles.label, { color: colors.muted }]}>RPE（App 已自動推定，可選手動調整）</Text>
                <View style={styles.rpePicker}>
                  {Array.from({ length: 10 }, (_, index) => index + 1).map((value) => {
                    const selected = editRpe === value;
                    return (
                      <Pressable key={value} onPress={() => setEditRpe(selected ? undefined : value)} style={[styles.rpeOption, { borderColor: selected ? "#F59E0B" : colors.border, backgroundColor: selected ? "rgba(245,158,11,0.18)" : colors.surface }]}>
                        <Text style={{ color: selected ? "#FCD34D" : colors.muted, fontSize: 12, fontWeight: "800" }}>{value}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
              <View>
                <Text style={[styles.label, { color: colors.muted }]}>私人備註</Text>
                <TextInput
                  value={editDescInput}
                  onChangeText={setEditDescInput}
                  placeholder="只保存在此裝置，例如路況、感受與下次調整…"
                  placeholderTextColor={colors.muted}
                  multiline
                  numberOfLines={3}
                  style={[styles.input, { height: 80, textAlignVertical: "top", color: colors.foreground, borderColor: colors.border, backgroundColor: colors.surface }]}
                />
              </View>
              <View>
                <Text style={[styles.label, { color: colors.muted }]}>活動封面照片</Text>
                <Text style={[styles.coverPickerHint, { color: colors.muted }]}>選擇本機照片作為活動主視覺；未設定時會顯示完整路線。</Text>
                {coverPhotoChoices.length > 0 ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.coverPickerRail}>
                    {coverPhotoChoices.map((photo) => {
                      const selected = editCoverPhotoUri === photo.uri;
                      return (
                        <Pressable key={photo.id} style={[styles.coverPickerOption, { borderColor: selected ? colors.primary : colors.border }]} onPress={() => setEditCoverPhotoUri(photo.uri)}>
                          <Image source={{ uri: photo.uri }} style={styles.coverPickerImage} />
                          {selected ? <View style={[styles.coverPickerSelected, { backgroundColor: colors.primary }]}><Text style={[styles.coverPickerSelectedText, { color: colors.onAccent }]}>封面</Text></View> : null}
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                ) : <Text style={[styles.coverPickerEmpty, { color: colors.muted }]}>請先於下方加入本機相片，再選擇活動封面。</Text>}
                {editCoverPhotoUri ? (
                  <Pressable style={styles.clearCoverButton} onPress={() => setEditCoverPhotoUri(undefined)}>
                    <Text style={styles.clearCoverButtonText}>清除活動封面，改回路線視覺</Text>
                  </Pressable>
                ) : null}
              </View>
              <View>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={[styles.label, { color: colors.muted }]}>本機媒體（相片或影片）</Text>
                  <Pressable onPress={handlePickMedia} style={[styles.mediaAddBtn, { backgroundColor: colors.primary }]}>
                    <Text style={{ color: colors.onAccent, fontSize: 12, fontWeight: "bold" }}>+ 新增媒體</Text>
                  </Pressable>
                </View>
                {localMedia.length > 0 ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                    {localMedia.map((uri, index) => (
                      <View key={index} style={{ marginRight: 8, position: "relative" }}>
                        <Image source={{ uri }} style={{ width: 70, height: 70, borderRadius: 8 }} />
                        <Pressable
                          onPress={() => setLocalMedia((prev: string[]) => prev.filter((_: string, i: number) => i !== index))}
                          style={styles.mediaRemoveBadge}
                        >
                          <Text style={{ color: "#fff", fontSize: 10, fontWeight: "bold" }}>×</Text>
                        </Pressable>
                      </View>
                    ))}
                  </ScrollView>
                ) : (
                  <Text style={{ fontSize: 13, color: colors.muted, marginTop: 4 }}>尚未附加相片或影片</Text>
                )}
              </View>
            </ScrollView>
            <View style={{ flexDirection: "row", gap: 12, marginTop: 16 }}>
              <Pressable
                onPress={() => setIsEditModalVisible(false)}
                style={[styles.modalBtn, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]}
              >
                <Text style={{ color: colors.foreground, fontWeight: "600" }}>取消</Text>
              </Pressable>
              <Pressable
                onPress={handleSaveActivityEdit}
                style={[styles.modalBtn, { backgroundColor: colors.primary }]}
              >
                <Text style={{ color: colors.onAccent, fontWeight: "600" }}>儲存活動</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── 子元件 ───────────────────────────────────────────────────────────────────

function CoreActivitySummaryGrid({
  distanceKm,
  ascentM,
  movingDuration,
  averagePowerW,
  averageSpeedKmh,
  calories,
  sportType,
  averageGrade,
  altitudeM,
}: {
  distanceKm: number;
  ascentM: number;
  movingDuration: number;
  averagePowerW: number;
  averageSpeedKmh: number;
  calories: number;
  sportType: SportType;
  averageGrade: number;
  altitudeM: number;
}) {
  const pace = formatPaceFromKmh(averageSpeedKmh);
  const gap = formatPaceSeconds(calculateGapPaceSecPerKm(averageSpeedKmh > 0 ? 3600 / averageSpeedKmh : 0, averageGrade));
  const vam = movingDuration > 0 ? (ascentM / movingDuration) * 3600 : 0;
  const entries = sportType === "running"
    ? [["距離", `${distanceKm.toFixed(2)} 公里`], ["總爬升", `${Math.round(ascentM)} 公尺`], ["移動時間", formatDuration(movingDuration)], ["平均配速", `${pace} /公里`], ["平均速度", `${averageSpeedKmh.toFixed(1)} 公里/小時`], ["卡路里", `${Math.round(calories)} 卡`]] as const
    : sportType === "hiking"
      ? [["距離", `${distanceKm.toFixed(2)} 公里`], ["總爬升", `${Math.round(ascentM)} 公尺`], ["移動時間", formatDuration(movingDuration)], ["爬升速度", `${Math.round(vam)} 公尺/小時`], ["最高海拔", `${Math.round(altitudeM)} 公尺`], ["卡路里", `${Math.round(calories)} 卡`]] as const
      : sportType === "trail_running"
        ? [["距離", `${distanceKm.toFixed(2)} 公里`], ["總爬升", `${Math.round(ascentM)} 公尺`], ["移動時間", formatDuration(movingDuration)], ["平均配速", `${pace} /公里`], ["GAP", `${gap} /公里`], ["卡路里", `${Math.round(calories)} 卡`]] as const
        : [["距離", `${distanceKm.toFixed(2)} 公里`], ["爬升海拔", `${Math.round(ascentM).toLocaleString()} 公尺`], ["移動時間", formatDuration(movingDuration)], ["平均功率", `${Math.round(averagePowerW)} 瓦`], ["平均速度", `${averageSpeedKmh.toFixed(1)} 公里/小時`], ["卡路里", `${Math.round(calories).toLocaleString()} 卡`]] as const;

  return (
    <View style={styles.coreActivitySummaryGrid}>
      {entries.map(([label, value]) => (
        <View key={label} style={styles.coreActivitySummaryMetric}>
          <Text style={styles.coreActivitySummaryLabel}>{label}</Text>
          <Text style={styles.coreActivitySummaryValue}>{value}</Text>
        </View>
      ))}
    </View>
  );
}

function ActivitySummaryHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={styles.activitySummaryHeader}>
      <Text style={styles.activitySummaryEyebrow}>活動摘要</Text>
      <Text style={styles.activitySummaryTitle} numberOfLines={1}>{title}</Text>
      <Text style={styles.activitySummarySubtitle} numberOfLines={2}>{subtitle}</Text>
    </View>
  );
}

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
  activityDetailScroll: { flex: 1, backgroundColor: "#0d0d1a" },
  mapHero: { height: ACTIVITY_DETAIL_MAIN_HERO_HEIGHT, width: SCREEN_W, position: "relative", overflow: "hidden" },
  map: { width: SCREEN_W, height: ACTIVITY_DETAIL_MAIN_HERO_HEIGHT },
  activityBody: {
    backgroundColor: "#0d0d1a",
    marginTop: -20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 0,
    paddingHorizontal: ACTIVITY_SUMMARY_HORIZONTAL_PADDING,
    minHeight: 0,
  },
  activityEyebrow: { color: "#00E676", fontSize: 12, fontWeight: "700", letterSpacing: 0.6, marginBottom: 5 },
  activitySummaryHeader: { width: "100%" },
  activitySummaryEyebrow: { color: "#00E676", fontSize: 11, fontWeight: "800", letterSpacing: 0.7 },
  activitySummaryTitle: { color: "#fff", fontSize: 21, fontWeight: "800", marginTop: 3 },
  activitySummarySubtitle: { color: "rgba(255,255,255,0.62)", fontSize: 12, lineHeight: 17, marginTop: 5 },
  activityMetaRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 7, marginTop: -10, marginBottom: 16 },
  activityMetaChip: { borderRadius: 99, backgroundColor: "rgba(96,165,250,0.14)", paddingHorizontal: 9, paddingVertical: 5 },
  activityMetaChipText: { color: "#93C5FD", fontSize: 11, fontWeight: "800" },
  activityMetaRpeChip: { backgroundColor: "rgba(245,158,11,0.14)" },
  activityMetaRpeText: { color: "#FCD34D", fontSize: 11, fontWeight: "800" },
  activityEquipment: { color: "rgba(255,255,255,0.55)", fontSize: 11, flexShrink: 1 },
  activityInitialSummary: { paddingTop: ACTIVITY_SUMMARY_CONTENT_TOP, paddingBottom: ACTIVITY_SUMMARY_CONTENT_BOTTOM },
  activityDetailsAfterInitial: { paddingTop: 18 },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.055)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.1)",
    paddingVertical: 14,
  },
  performanceRow: { flexDirection: "row", marginTop: 10, borderRadius: 13, backgroundColor: "rgba(255,255,255,0.035)", borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.08)" },
  performanceMetric: { flex: 1, alignItems: "center", paddingVertical: 11 },
  performanceMetricValue: { color: "rgba(255,255,255,0.93)", fontSize: 12, fontWeight: "800", fontVariant: ["tabular-nums"] },
  performanceMetricLabel: { color: "rgba(255,255,255,0.46)", fontSize: 10, marginTop: 3 },
  topMediaSection: { marginTop: 18 },
  topMediaHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 9 },
  topMediaTitle: { color: "#fff", fontSize: 16, fontWeight: "800" },
  topMediaCount: { color: "rgba(255,255,255,0.48)", fontSize: 11, fontWeight: "700" },
  topMediaRail: { gap: 10, paddingRight: 4 },
  topMediaThumbWrap: { width: 132, height: 94, borderRadius: 12, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.08)" },
  topMediaThumb: { width: "100%", height: "100%" },
  topMediaPrimaryBadge: { position: "absolute", left: 7, bottom: 7, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 7, backgroundColor: "rgba(0,0,0,0.62)" },
  topMediaPrimaryText: { color: "#fff", fontSize: 9, fontWeight: "800" },
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
  goalProgressItem: { gap: 6 },
  goalProgressLabelRow: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  goalProgressLabel: { color: "rgba(255,255,255,0.72)", fontSize: 12 },
  goalProgressValue: { color: "#fff", fontSize: 12, fontWeight: "700", fontVariant: ["tabular-nums"] },
  goalProgressTrack: { height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.12)", overflow: "hidden" },
  goalProgressFill: { height: "100%", borderRadius: 3 },
  activityHighlightsCard: { marginTop: 16, padding: 16, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.045)", borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.1)", gap: 12 },
  activityHighlightsTitle: { color: "#fff", fontSize: 16, fontWeight: "800" },
  activityHighlightRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  activityHighlightDot: { width: 9, height: 9, borderRadius: 5 },
  activityHighlightTitleText: { color: "rgba(255,255,255,0.9)", fontSize: 13, fontWeight: "700" },
  activityHighlightDetail: { color: "rgba(255,255,255,0.5)", fontSize: 11, marginTop: 2 },
  activityAnalysisCard: { marginTop: 16, padding: 16, borderRadius: 16, backgroundColor: "rgba(96,165,250,0.07)", borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(96,165,250,0.22)" },
  activityAnalysisTitle: { color: "#fff", fontSize: 16, fontWeight: "800" },
  activityAnalysisHint: { color: "rgba(255,255,255,0.48)", fontSize: 11, lineHeight: 16, marginTop: 4 },
  activityAnalysisEmpty: { color: "rgba(255,255,255,0.58)", fontSize: 12, lineHeight: 18, marginTop: 14 },
  bestPowerBlock: { marginTop: 10 },
  bestPowerTitle: { color: "rgba(255,255,255,0.76)", fontSize: 12, fontWeight: "700", marginBottom: 8 },
  bestPowerRow: { gap: 8, paddingRight: 8 },
  bestPowerChip: { minWidth: 66, borderRadius: 10, backgroundColor: "rgba(167,139,250,0.16)", paddingHorizontal: 10, paddingVertical: 9 },
  bestPowerDuration: { color: "rgba(255,255,255,0.62)", fontSize: 10, fontWeight: "700" },
  bestPowerWatts: { color: "#C4B5FD", fontSize: 14, fontWeight: "800", marginTop: 2 },
  activityTypePicker: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  activityTypeOption: { minHeight: 36, paddingHorizontal: 12, justifyContent: "center", alignItems: "center", borderRadius: 10, borderWidth: 1 },
  rpePicker: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 4 },
  rpeOption: { width: 34, height: 34, justifyContent: "center", alignItems: "center", borderRadius: 17, borderWidth: 1 },
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
    zIndex: 3,
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

  activityCoverPhoto: { position: "absolute", inset: 0, zIndex: 1, backgroundColor: "#08110D" },
  activityCoverImage: { width: "100%", height: "100%" },
  activityCoverShade: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 18, paddingTop: 32, paddingBottom: 18, backgroundColor: "rgba(0,0,0,0.42)" },
  activityCoverEyebrow: { color: "#00E676", fontSize: 11, fontWeight: "800", letterSpacing: 0.8 },
  activityCoverCopy: { color: "rgba(255,255,255,0.88)", fontSize: 12, marginTop: 4, fontWeight: "700" },
  activityRouteExpandButton: { position: "absolute", right: 14, bottom: 14, zIndex: 3, borderRadius: 10, paddingHorizontal: 11, paddingVertical: 8, backgroundColor: "rgba(7,18,14,0.78)", borderWidth: 1, borderColor: "rgba(255,255,255,0.22)" },
  activityRouteExpandButtonText: { color: "#fff", fontSize: 11, fontWeight: "800" },

  noTrailBadge: {
    position: "absolute",
    top: "40%",
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    zIndex: 2,
  },
  noTrailText: { color: "rgba(255,255,255,0.6)", fontSize: 13 },
  routeMapPhotoThumbButton: { position: "absolute", left: 14, bottom: 14, width: 76, height: 76, borderRadius: 12, overflow: "hidden", backgroundColor: "#101010", borderWidth: 2, borderColor: "rgba(255,255,255,0.86)", zIndex: 2, boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.22)" },
  routeMapPhotoThumbImage: { width: "100%", height: "100%" },
  routeMapPhotoThumbBadge: { position: "absolute", left: 5, bottom: 5, minWidth: 28, height: 23, paddingHorizontal: 5, flexDirection: "row", gap: 3, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: "rgba(0,0,0,0.72)" },
  routeMapPhotoThumbCount: { color: "#fff", fontSize: 11, fontWeight: "800" },

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
  stravaBanner: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.1)",
  },
  stravaDescText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#fff",
    marginBottom: 8,
  },
  mediaScroll: {
    flexDirection: "row",
    marginTop: 4,
  },
  mediaThumb: {
    width: 64,
    height: 64,
    borderRadius: 8,
    marginRight: 8,
  },
  segmentCard: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
  },
  prBadge: {
    backgroundColor: "#F59E0B",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  prBadgeText: {
    color: "#000",
    fontSize: 10,
    fontWeight: "bold",
  },
  segmentTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    padding: 20,
  },
  modalContent: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  mediaAddBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  mediaRemoveBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "rgba(0,0,0,0.7)",
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  coverPickerHint: { fontSize: 11, lineHeight: 16, marginTop: -2 },
  coverPickerRail: { gap: 9, paddingTop: 9, paddingRight: 4 },
  coverPickerOption: { width: 92, height: 74, borderRadius: 9, borderWidth: 2, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.06)" },
  coverPickerImage: { width: "100%", height: "100%" },
  coverPickerSelected: { position: "absolute", left: 5, bottom: 5, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6 },
  coverPickerSelectedText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  coverPickerEmpty: { fontSize: 12, lineHeight: 18, marginTop: 8 },
  clearCoverButton: { alignSelf: "flex-start", marginTop: 8, paddingVertical: 4 },
  clearCoverButtonText: { color: "#FF6B6B", fontSize: 12, fontWeight: "700" },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },

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
  mediaViewer: { flex: 1, backgroundColor: "#050505", justifyContent: "flex-start" },
  mediaViewerClose: { position: "absolute", top: 56, left: 18, zIndex: 2, width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.58)" },
  activityViewerStage: { width: "100%", overflow: "hidden", backgroundColor: "#050505" },
  mediaViewerPage: { width: SCREEN_W, height: SCREEN_H, justifyContent: "flex-start", alignItems: "center" },
  activityViewerPhotoPager: { width: SCREEN_W, height: "100%" },
  activityViewerPhotoPagerContent: { height: "100%" },
  mediaViewerImage: { width: SCREEN_W, height: "82%" },
  activityViewerRoutePage: { backgroundColor: "#08110D" },
  activityViewerRouteMap: { width: SCREEN_W, flex: 1 },
  activityViewerDrawer: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: ACTIVITY_SUMMARY_HORIZONTAL_PADDING, paddingTop: ACTIVITY_SUMMARY_CONTENT_TOP, paddingBottom: ACTIVITY_SUMMARY_CONTENT_BOTTOM, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: "#101012", borderTopWidth: 1, borderColor: "rgba(255,255,255,0.13)", overflow: "hidden" },
  coreActivitySummaryGrid: { flexDirection: "row", flexWrap: "wrap", marginTop: 22, rowGap: 24 },
  coreActivitySummaryMetric: { width: "50%", alignItems: "center", paddingHorizontal: 6 },
  coreActivitySummaryLabel: { color: "rgba(255,255,255,0.72)", fontSize: 13, fontWeight: "700", marginBottom: 5 },
  coreActivitySummaryValue: { color: "#fff", fontSize: 23, fontWeight: "800", fontVariant: ["tabular-nums"], textAlign: "center" },
  activityViewerDrawerMetrics: { flexDirection: "row", marginTop: 15, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.06)", paddingVertical: 11 },
  activityViewerDrawerMetricsSecondary: { marginTop: 10 },
  activityViewerDrawerMetric: { flex: 1, alignItems: "center" },
  activityViewerDrawerMetricValue: { color: "#fff", fontSize: 16, fontWeight: "800", fontVariant: ["tabular-nums"] },
  activityViewerDrawerMetricLabel: { color: "rgba(255,255,255,0.55)", fontSize: 10, marginTop: 3 },
  activityViewerRouteInfo: { position: "absolute", left: 18, right: 18, bottom: 82, padding: 14, borderRadius: 16, backgroundColor: "rgba(7,18,14,0.9)", borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.16)" },
  activityViewerRouteTitle: { color: "#fff", fontSize: 17, fontWeight: "800" },
  activityViewerRouteCopy: { color: "rgba(255,255,255,0.68)", fontSize: 12, marginTop: 4 },
  activityViewerRoutePhotoRail: { gap: 9, paddingTop: 12, paddingRight: 4 },
  activityViewerRoutePhotoCard: { width: 130, padding: 5, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.09)", borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.17)" },
  activityViewerRoutePhotoThumb: { width: "100%", height: 70, borderRadius: 7, backgroundColor: "rgba(255,255,255,0.08)" },
  activityViewerRoutePhotoMeta: { color: "rgba(255,255,255,0.82)", fontSize: 9, lineHeight: 13, marginTop: 5, fontVariant: ["tabular-nums"] },
  activityViewerRouteEmpty: { color: "rgba(255,255,255,0.58)", fontSize: 11, lineHeight: 16, marginTop: 10 },
  activityViewerPhotoInfo: { position: "absolute", left: 18, right: 18, bottom: 84, alignItems: "center", gap: 7 },
  activityViewerPhotoText: { color: "rgba(255,255,255,0.82)", fontSize: 12, fontWeight: "700", backgroundColor: "rgba(0,0,0,0.58)", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 14, overflow: "hidden" },
  activityViewerPhotoMeta: { color: "rgba(255,255,255,0.94)", fontSize: 12, fontWeight: "700", backgroundColor: "rgba(0,0,0,0.72)", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, overflow: "hidden" },
  activityViewerCounterPill: { position: "absolute", bottom: 34, alignSelf: "center", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 15, backgroundColor: "rgba(0,0,0,0.62)" },
  mediaViewerCounter: { color: "rgba(255,255,255,0.9)", fontSize: 12, fontWeight: "800" },
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
