import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Switch,
  TextInput,
  Alert,
  Modal,
  PanResponder,
  Animated,
  LayoutAnimation,
  Platform,
  UIManager,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets, SafeAreaView } from "react-native-safe-area-context";


// 啟用 Android LayoutAnimation
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import Slider from "@react-native-community/slider";
import { router } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useSettings, DEFAULT_FIELD_ORDER, DEFAULT_SIMPLIFIED_FIELD_ORDER, SUPPLY_ITEM_TEMPLATES, type NormalFieldKey, type SimplifiedFieldKey, type SupplyItem } from "@/lib/settings-context";
import { SensorPairingModal } from "@/components/sensor-pairing-modal";
import { SmartPowerSavingManager, type PowerSavingSettings } from "@/lib/power-saving/smart-power-saving-system";
import { importLocalRideFile } from "@/lib/local-ride-import";
import { useRide } from "@/lib/ride-context";


import Constants from "expo-constants";

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { settings, updateSettings, updateNormalFields, updateSimplifiedFields, updateFieldOrder, updateSimplifiedFieldOrder, addSupplyItem, updateSupplyItem, deleteSupplyItem } = useSettings();
  const { loadRecords } = useRide();
  const powerSavingManagerRef = useRef(SmartPowerSavingManager.getInstance());
  const [powerSavingSettings, setPowerSavingSettings] = useState<PowerSavingSettings>(
    powerSavingManagerRef.current.getSettings(),
  );

  useEffect(() => {
    let mounted = true;
    powerSavingManagerRef.current.loadSettings().then((loaded) => {
      if (mounted) setPowerSavingSettings(loaded);
    });
    return () => { mounted = false; };
  }, []);

  const updatePowerSavingSettings = async (patch: Partial<PowerSavingSettings>) => {
    const next = { ...powerSavingSettings, ...patch };
    setPowerSavingSettings(next);
    await powerSavingManagerRef.current.saveSettings(patch);
  };

  const handleManualRideImport = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/gpx+xml", "application/json", "text/xml", "text/plain"],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const file = result.assets[0];
      const imported = await importLocalRideFile(file.uri, file.name);
      await loadRecords();
      Alert.alert("匯入完成", `已匯入 ${imported.importedCount} 筆${imported.sourceType.toUpperCase()}紀錄${imported.skippedCount ? `，略過 ${imported.skippedCount} 筆重複資料` : ""}。`);
    } catch (error) {
      Alert.alert("匯入失敗", error instanceof Error ? error.message : "無法讀取選取的檔案。");
    }
  };

  // ── 感測器配對 Modal 狀態 ──
  const [sensorModalVisible, setSensorModalVisible] = useState(false);
  const [bleScanning, setBleScanning] = useState(false);
  const [bleDevices, setBleDevices] = useState<any[]>([]);
  const [bleConnecting, setBleConnecting] = useState<string | null>(null);
  const [sensorStatus, setSensorStatus] = useState<{
    connectedCount: number;
    lastUpdateTimeStr: string;
    signalQuality: 'excellent' | 'good' | 'poor' | 'disconnected';
  }>({ connectedCount: 0, lastUpdateTimeStr: '--', signalQuality: 'disconnected' });

  // 定時更新感測器狀態
  useEffect(() => {
    const interval = setInterval(() => {
      try {
        const { getSensorDataManager } = require('@/lib/sensor-data-manager');
        const manager = getSensorDataManager();
        const status = manager.getSensorStatus();
        setSensorStatus({
          connectedCount: status.connectedCount,
          lastUpdateTimeStr: status.lastUpdateTimeStr,
          signalQuality: status.signalQuality,
        });
      } catch (err) {
        // SensorDataManager 未初始化
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // BLE 掃描與連線
  const handleBleScan = async () => {
    setBleScanning(true);
    try {
      const { getSensorDataManager } = require('@/lib/sensor-data-manager');
      const manager = getSensorDataManager();
      await manager.startBleScanning();
      
      // 延遲 5 秒後取得掃描結果
      setTimeout(() => {
        const connectedDevices = manager.getBleConnectedDevices();
        setBleDevices(connectedDevices);
        setBleScanning(false);
      }, 5000);
    } catch (error) {
      console.error('[Settings] BLE scan error:', error);
      setBleScanning(false);
      Alert.alert('掃描失敗', '無法掃描 BLE 設備');
    }
  };

  const handleBleConnect = async (deviceId: string) => {
    setBleConnecting(deviceId);
    try {
      const { getSensorDataManager } = require('@/lib/sensor-data-manager');
      const manager = getSensorDataManager();
      await manager.connectBleDevice(deviceId);
      
      // 更新設備列表
      const updated = bleDevices.map((d) => (d.id === deviceId ? { ...d, isConnected: true } : d));
      setBleDevices(updated);
      Alert.alert('連接成功', '感測器已連接');
    } catch (error) {
      console.error('[Settings] BLE connect error:', error);
      Alert.alert('連接失敗', '無法連接到感測器');
    } finally {
      setBleConnecting(null);
    }
  };

  const handleBleDisconnect = async (deviceId: string) => {
    try {
      const { getSensorDataManager } = require('@/lib/sensor-data-manager');
      const manager = getSensorDataManager();
      await manager.disconnectBleDevice(deviceId);
      
      // 更新設備列表
      const updated = bleDevices.map((d) => (d.id === deviceId ? { ...d, isConnected: false } : d));
      setBleDevices(updated);
    } catch (error) {
      console.error('[Settings] BLE disconnect error:', error);
      Alert.alert('斷開失敗', '無法斷開感測器');
    }
  };

  const getSensorEmoji = (serviceType: string) => {
    switch (serviceType) {
      case 'heartRate':
        return '❤️';
      case 'power':
        return '⚡';
      case 'cadence':
        return '🔄';
      default:
        return '📱';
    }
  };

  const getSensorLabel = (serviceType: string) => {
    switch (serviceType) {
      case 'heartRate':
        return '心率帶';
      case 'power':
        return '功率計';
      case 'cadence':
        return '踏頻器';
      default:
        return '未知設備';
    }
  };

  const [editModal, setEditModal] = useState<{
    visible: boolean;
    key: string;
    label: string;
    value: string;
    unit: string;
    isNumber: boolean;
  }>({ visible: false, key: "", label: "", value: "", unit: "", isNumber: true });

  // ── 補給品管理 Modal 狀態 ──
  const [supplyModal, setSupplyModal] = useState<{
    visible: boolean;
    mode: "add" | "edit";
    item: SupplyItem | null;
  }>({ visible: false, mode: "add", item: null });

  const [supplyForm, setSupplyForm] = useState<SupplyItem>({
    id: "",
    name: "",
    triggerType: "time",
    triggerValue: 10,
    triggerHours: 0,
    triggerMinutes: 5,
    triggerSeconds: 0,
    repeatMode: "every",
    enabled: true,
    repeatUntilDismissed: false,
    autoDismissSeconds: 0,
    pauseOnDownhill: false,
  });

  const openSupplyModal = (item?: SupplyItem) => {
    if (item) {
      setSupplyForm(item);
      setSupplyModal({ visible: true, mode: "edit", item });
    } else {
      setSupplyForm({
        id: Date.now().toString(),
        name: "",
        triggerType: "time",
        triggerValue: 10,
        triggerHours: 0,
        triggerMinutes: 5,
        triggerSeconds: 0,
        repeatMode: "every",
        enabled: true,
        repeatUntilDismissed: false,
        autoDismissSeconds: 0,
        pauseOnDownhill: false,
      });
      setSupplyModal({ visible: true, mode: "add", item: null });
    }
  };

  const closeSupplyModal = () => {
    setSupplyModal({ visible: false, mode: "add", item: null });
  };

  const handleSaveSupply = async () => {
    if (!supplyForm.name.trim()) {
      Alert.alert("錯誤", "請輸入補給品名稱");
      return;
    }
    if (supplyModal.mode === "add") {
      await addSupplyItem(supplyForm);
    } else if (supplyModal.item) {
      await updateSupplyItem(supplyModal.item.id, supplyForm);
    }
    closeSupplyModal();
  };

  const handleDeleteSupply = async (id: string) => {
    Alert.alert("刪除補給品", "確定要刪除此補給品嗎？", [
      { text: "取消", style: "cancel" },
      { text: "刪除", style: "destructive", onPress: () => deleteSupplyItem(id) },
    ]);
  };

  // 各區塊折疊狀態（預設全部展開）
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const toggleSection = (key: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCollapsedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // 拖曳排序狀態
  const [dragOrder, setDragOrder] = useState<NormalFieldKey[]>(
    settings.normalModeFieldOrder ?? DEFAULT_FIELD_ORDER
  );
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const dragY = useRef(new Animated.Value(0)).current;
  const dragStartY = useRef(0);
  const ITEM_H = 52; // 每列高度

  // 同步 settings 變化到 dragOrder
  React.useEffect(() => {
    setDragOrder(settings.normalModeFieldOrder ?? DEFAULT_FIELD_ORDER);
  }, [settings.normalModeFieldOrder]);

  // 精簡模式拖曳排序狀態
  const [simpDragOrder, setSimpDragOrder] = useState<SimplifiedFieldKey[]>(
    settings.simplifiedModeFieldOrder ?? DEFAULT_SIMPLIFIED_FIELD_ORDER
  );
  const [simpDraggingIdx, setSimpDraggingIdx] = useState<number | null>(null);
  const [simpHoverIdx, setSimpHoverIdx] = useState<number | null>(null);
  const simpDragY = useRef(new Animated.Value(0)).current;
  const simpDragStartY = useRef(0);

  React.useEffect(() => {
    setSimpDragOrder(settings.simplifiedModeFieldOrder ?? DEFAULT_SIMPLIFIED_FIELD_ORDER);
  }, [settings.simplifiedModeFieldOrder]);

  const SIMP_FIELD_LABELS: Record<SimplifiedFieldKey, string> = {
    showDirection: "方向指引",
    showRemaining: "剩餘距離",
    showSpeed: "速度",
    showDistance: "距離",
    showElapsed: "騎乘時間",
    showCurrentTime: "現在時間",
    showGrade: "坡度",
    showPower: "功率",
    showAvgSpeed: "均速",
    showCalories: "卡路里",
    showPausedTime: "暫停時間",
    showTotalAscent: "累計爬升",
    showCurrentAltitude: "目前海拔",
  };

  const makeSimpDragResponder = (idx: number) =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        simpDragStartY.current = e.nativeEvent.pageY;
        simpDragY.setValue(0);
        setSimpDraggingIdx(idx);
        setSimpHoverIdx(idx);
      },
      onPanResponderMove: (e) => {
        const dy = e.nativeEvent.pageY - simpDragStartY.current;
        simpDragY.setValue(dy);
        const newIdx = Math.max(0, Math.min(simpDragOrder.length - 1, idx + Math.round(dy / ITEM_H)));
        setSimpHoverIdx(newIdx);
      },
      onPanResponderRelease: (e) => {
        const dy = e.nativeEvent.pageY - simpDragStartY.current;
        const newIdx = Math.max(0, Math.min(simpDragOrder.length - 1, idx + Math.round(dy / ITEM_H)));
        if (newIdx !== idx) {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          const next = [...simpDragOrder];
          const [moved] = next.splice(idx, 1);
          next.splice(newIdx, 0, moved);
          setSimpDragOrder(next);
          updateSimplifiedFieldOrder(next);
        }
        setSimpDraggingIdx(null);
        setSimpHoverIdx(null);
        simpDragY.setValue(0);
      },
      onPanResponderTerminate: () => {
        setSimpDraggingIdx(null);
        setSimpHoverIdx(null);
        simpDragY.setValue(0);
      },
    });

  const FIELD_LABELS: Record<NormalFieldKey, string> = {
    showElapsed: "騎乘時間",
    showSpeed: "速度",
    showDistance: "距離",
    showGrade: "坡度",
    showPower: "功率",
    showAvgSpeed: "均速",
    showCalories: "卡路里",
    showPausedTime: "暫停時間",
    showHeartRate: "心率",
    showCadence: "踏頻",
    showTotalAscent: "累計爬升",
    showCurrentAltitude: "目前海拔",
    showGradeDistribution: "坡度分布",
  };

  const makeDragResponder = (idx: number) =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        dragStartY.current = e.nativeEvent.pageY;
        dragY.setValue(0);
        setDraggingIdx(idx);
        setHoverIdx(idx);
      },
      onPanResponderMove: (e) => {
        const dy = e.nativeEvent.pageY - dragStartY.current;
        dragY.setValue(dy);
        const newIdx = Math.max(0, Math.min(dragOrder.length - 1, idx + Math.round(dy / ITEM_H)));
        setHoverIdx(newIdx);
      },
      onPanResponderRelease: (e) => {
        const dy = e.nativeEvent.pageY - dragStartY.current;
        const newIdx = Math.max(0, Math.min(dragOrder.length - 1, idx + Math.round(dy / ITEM_H)));
        if (newIdx !== idx) {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          const next = [...dragOrder];
          const [moved] = next.splice(idx, 1);
          next.splice(newIdx, 0, moved);
          setDragOrder(next);
          updateFieldOrder(next);
        }
        setDraggingIdx(null);
        setHoverIdx(null);
        dragY.setValue(0);
      },
      onPanResponderTerminate: () => {
        setDraggingIdx(null);
        setHoverIdx(null);
        dragY.setValue(0);
      },
    });

  const openEdit = (key: string, label: string, value: number, unit: string) => {
    setEditModal({ visible: true, key, label, value: String(value), unit, isNumber: true });
  };

  const saveEdit = async () => {
    const num = parseFloat(editModal.value);
    if (isNaN(num) || num <= 0) {
      Alert.alert("錯誤", "請輸入有效的數值");
      return;
    }
    await updateSettings({ [editModal.key]: num });
    setEditModal({ ...editModal, visible: false });
  };

  return (
    <ScreenContainer containerClassName="bg-background">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.title, { color: colors.foreground }]}>設定</Text>

        {/* ── 個人資料 ── */}
        <SectionHeader title="個人資料" colors={colors} onToggle={() => toggleSection("personal")} collapsed={collapsedSections["personal"]} />
        {!collapsedSections["personal"] && <View style={[styles.section, { borderColor: colors.border }]}>
          <NumberRow
            icon="person.fill"
            label="體重"
            value={settings.weight}
            unit="kg"
            colors={colors}
            onPress={() => openEdit("weight", "體重", settings.weight, "kg")}
          />
          <Divider colors={colors} />
          <NumberRow
            icon="arrow.up"
            label="身高"
            value={settings.height}
            unit="cm"
            colors={colors}
            onPress={() => openEdit("height", "身高", settings.height, "cm")}
          />
          <Divider colors={colors} />
          <NumberRow
            icon="bicycle"
            label="單車+裝備重量"
            value={settings.bikeWeight ?? 10}
            unit="kg"
            colors={colors}
            hint="包含單車、水壺、工具等裝備的總重，用於 GPX 卡路里預估"
            onPress={() => openEdit("bikeWeight", "單車+裝備重量", settings.bikeWeight ?? 10, "kg")}
          />
          <Divider colors={colors} />
          <NumberRow
            icon="person.fill"
            label="年齡"
            value={settings.age ?? 32}
            unit="歲"
            colors={colors}
            hint="用於推算最大心率（MHR）與水分消耗演算"
            onPress={() => openEdit("age", "年齡", settings.age ?? 32, "歲")}
          />
          <Divider colors={colors} />
          <NumberRow
            icon="bolt.fill"
            label="FTP（功能閾值功率）"
            value={settings.ftp}
            unit="W"
            colors={colors}
            onPress={() => openEdit("ftp", "FTP", settings.ftp, "W")}
          />
        </View>}

        {/* ── 效能模式 ── */}
        <SectionHeader title="效能模式" colors={colors} onToggle={() => toggleSection("performance")} collapsed={collapsedSections["performance"]} />
        {!collapsedSections["performance"] && <View style={[styles.section, { borderColor: colors.border }]}>
          <View style={{ paddingHorizontal: 16, paddingVertical: 12, gap: 12 }}>
            <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "600" }}>效能模式</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {(["battery-saver", "balanced", "performance"] as const).map((mode) => (
                <Pressable
                  key={mode}
                  style={({ pressed }) => [{
                    flex: 1,
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                    borderRadius: 8,
                    backgroundColor: settings.performanceMode === mode ? colors.primary : colors.surface,
                    borderWidth: 1,
                    borderColor: settings.performanceMode === mode ? colors.primary : colors.border,
                    opacity: pressed ? 0.8 : 1,
                  }]}
                  onPress={() => updateSettings({ performanceMode: mode })}
                >
                  <Text style={{
                    color: settings.performanceMode === mode ? "#fff" : colors.foreground,
                    fontSize: 12,
                    fontWeight: "600",
                    textAlign: "center",
                  }}>
                    {mode === "battery-saver" ? "🔋 省電" : mode === "balanced" ? "⚖️ 平衡" : "⚡ 性能"}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingTop: 8 }}>
              <Pressable
                style={({ pressed }) => [{
                  width: 24,
                  height: 24,
                  borderRadius: 4,
                  backgroundColor: settings.autoPerformanceMode ? colors.primary : colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: pressed ? 0.8 : 1,
                }]}
                onPress={() => updateSettings({ autoPerformanceMode: !settings.autoPerformanceMode })}
              >
                {settings.autoPerformanceMode && <Text style={{ color: "#fff", fontSize: 12, fontWeight: "bold" }}>✓</Text>}
              </Pressable>
              <Text style={{ color: colors.foreground, fontSize: 12 }}>根據電量自動調整模式</Text>
            </View>
          </View>
        </View>}



        {/* ── 背景 GPS 精度 ── */}
        <SectionHeader title="背景 GPS 精度" colors={colors} onToggle={() => toggleSection("gpsAccuracy")} collapsed={collapsedSections["gpsAccuracy"]} />
        {!collapsedSections["gpsAccuracy"] && <View style={[styles.section, { borderColor: colors.border }]}>
          <View style={{ paddingHorizontal: 16, paddingVertical: 12, gap: 12 }}>
            <Text style={{ color: colors.muted, fontSize: 12 }}>設定背景執行時的 GPS 更新頻率，高精度更耗電但軌跡更精確</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {(["power_saving", "standard", "high_accuracy"] as const).map((level) => (
                <Pressable
                  key={level}
                  style={({ pressed }) => [{
                    flex: 1,
                    paddingVertical: 10,
                    paddingHorizontal: 8,
                    borderRadius: 8,
                    backgroundColor: settings.gpsAccuracy === level ? colors.primary : colors.surface,
                    borderWidth: 1,
                    borderColor: settings.gpsAccuracy === level ? colors.primary : colors.border,
                    opacity: pressed ? 0.8 : 1,
                  }]}
                  onPress={() => updateSettings({ gpsAccuracy: level })}
                >
                  <Text style={{
                    color: settings.gpsAccuracy === level ? "#fff" : colors.foreground,
                    fontSize: 11,
                    fontWeight: "600",
                    textAlign: "center",
                  }}>
                    {level === "power_saving" ? "🔋 省電" : level === "standard" ? "⚖️ 標準" : "📡 高精度"}
                  </Text>
                  <Text style={{
                    color: settings.gpsAccuracy === level ? "rgba(255,255,255,0.8)" : colors.muted,
                    fontSize: 10,
                    textAlign: "center",
                    marginTop: 2,
                  }}>
                    {level === "power_saving" ? "15s / 30m" : level === "standard" ? "5s / 10m" : "3s / 5m"}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>}

        {/* ── 補給閾值 ── */}
        <SectionHeader title="補給閾值" colors={colors} onToggle={() => toggleSection("supply")} collapsed={collapsedSections["supply"]} />
        {!collapsedSections["supply"] && <View style={[styles.section, { borderColor: colors.border }]}>
          <NumberRow
            icon="flame.fill"
            label="卡路里提醒閾值"
            value={settings.calorieThreshold}
            unit="kcal"
            colors={colors}
            iconColor={colors.warning}
            onPress={() => openEdit("calorieThreshold", "卡路里提醒閾值", settings.calorieThreshold, "kcal")}
          />
          <Divider colors={colors} />
          <NumberRow
            icon="drop.fill"
            label="汗液流失提醒閾值"
            value={settings.waterThreshold}
            unit="ml"
            colors={colors}
            iconColor="#4FC3F7"
            hint="每流失此量汗液即提醒補水"
            onPress={() => openEdit("waterThreshold", "汗液流失提醒閾值 (ml)", settings.waterThreshold, "ml")}
          />
          <Divider colors={colors} />
          <ToggleRow
            icon="bell.badge.fill"
            label="依時間／距離提醒補給"
            value={settings.supplyIntervalReminderEnabled}
            colors={colors}
            onToggle={(enabled) => updateSettings({ supplyIntervalReminderEnabled: enabled })}
          />
          {settings.supplyIntervalReminderEnabled && <>
            <Divider colors={colors} />
            <ToggleRow
              icon="clock.fill"
              label="按時間間隔提醒"
              value={settings.supplyTimeIntervalEnabled}
              colors={colors}
              onToggle={(enabled) => updateSettings({ supplyTimeIntervalEnabled: enabled })}
            />
            {settings.supplyTimeIntervalEnabled && <NumberRow
              icon="clock.fill"
              label="時間提醒間隔"
              value={settings.supplyTimeIntervalMinutes}
              unit="分鐘"
              colors={colors}
              iconColor={colors.primary}
              hint="從開始騎乘或上次確認補給後重新計時"
              onPress={() => openEdit("supplyTimeIntervalMinutes", "時間提醒間隔", settings.supplyTimeIntervalMinutes, "分鐘")}
            />}
            <Divider colors={colors} />
            <ToggleRow
              icon="location.fill"
              label="按距離間隔提醒"
              value={settings.supplyDistanceIntervalEnabled}
              colors={colors}
              onToggle={(enabled) => updateSettings({ supplyDistanceIntervalEnabled: enabled })}
            />
            {settings.supplyDistanceIntervalEnabled && <NumberRow
              icon="location.fill"
              label="距離提醒間隔"
              value={settings.supplyDistanceIntervalKm}
              unit="km"
              colors={colors}
              iconColor="#9C27B0"
              hint="從開始騎乘或上次確認補給後重新累計距離"
              onPress={() => openEdit("supplyDistanceIntervalKm", "距離提醒間隔", settings.supplyDistanceIntervalKm, "km")}
            />}
          </>}
          <Divider colors={colors} />
          <NumberRow
            icon="bell.badge.fill"
            label="未關閉時重複提醒間隔"
            value={settings.supplyReminderRepeatSec}
            unit="秒"
            colors={colors}
            iconColor={colors.primary}
            hint={settings.supplyReminderRepeatSec === 0 ? "已停用重複提醒" : `每 ${settings.supplyReminderRepeatSec} 秒語音重複提醒一次`}
            onPress={() => openEdit("supplyReminderRepeatSec", "重複提醒間隔（秒，0 = 停用）", settings.supplyReminderRepeatSec, "秒")}
          />
          <Divider colors={colors} />

          {/* 補給提醒高級功能（統一設定） */}
          <View style={{ marginVertical: 8 }}>
            <Text style={{ fontSize: 14, fontWeight: "700", color: colors.foreground, marginBottom: 12 /* internal spacing */ }}>補給提醒高級功能</Text>
            <View style={{ marginBottom: 12 /* internal spacing */, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: "600", color: colors.foreground }}>未關閉時重複提醒</Text>
                <Text style={{ fontSize: 11, color: colors.muted, marginTop: 2 }}>彈窗未確認時持續提醒（卡路里和水分）</Text>
              </View>
              <Switch value={(settings.calorieRepeatUntilDismissed ?? false) || (settings.waterRepeatUntilDismissed ?? false)} onValueChange={(v) => updateSettings({ calorieRepeatUntilDismissed: v, waterRepeatUntilDismissed: v })} trackColor={{ false: colors.border, true: colors.primary }} />
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: "600", color: colors.foreground }}>長下坡暫停提醒</Text>
                <Text style={{ fontSize: 11, color: colors.muted, marginTop: 2 }}>下坡時暫停提醒但仍計數（卡路里和水分）</Text>
              </View>
              <Switch value={(settings.caloriePauseOnDownhill ?? false) || (settings.waterPauseOnDownhill ?? false)} onValueChange={(v) => updateSettings({ caloriePauseOnDownhill: v, waterPauseOnDownhill: v })} trackColor={{ false: colors.border, true: colors.primary }} />
            </View>
          </View>
        </View>}

        {/* ── 自訂補給品清單 ── */}
        <SectionHeader title="自訂補給品" colors={colors} onToggle={() => toggleSection("customSupply")} collapsed={collapsedSections["customSupply"]} />
        {!collapsedSections["customSupply"] && <View style={[styles.section, { borderColor: colors.border }]}>
          {/* 快速新延預設補給品已移除 */}
          {settings.supplyItems.length === 0 ? (
            <View style={{ padding: 16, alignItems: "center" }}>
              <Text style={{ color: colors.muted, fontSize: 14 }}>沒有自訂補給品</Text>
            </View>
          ) : (
            settings.supplyItems.map((item, idx) => (
              <View key={item.id}>
                <View style={[styles.row, { paddingVertical: 12 }]}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 /* internal spacing */ }}>
                      <Switch
                        value={item.enabled}
                        onValueChange={(v) => updateSupplyItem(item.id, { enabled: v })}
                      />
                      <Pressable
                        style={{ flex: 1 }}
                        onPress={() => openSupplyModal(item)}
                      >
                        <Text style={[styles.rowLabel, { color: colors.foreground }]}>{item.name}</Text>
                        <Text style={[styles.rowHint, { color: colors.muted, fontSize: 12 }]}>
                          {item.triggerType === "time" ? `每 ${item.triggerHours || 0}h ${item.triggerMinutes || 0}m ${item.triggerSeconds || 0}s` : `每 ${item.triggerValue} 公里`} • {item.repeatMode === "once" ? "只提醒一次" : item.repeatMode === "every" ? "每次提醒" : "不提醒"}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                  <Pressable
                    style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
                    onPress={() => handleDeleteSupply(item.id)}
                  >
                    <IconSymbol name="trash.fill" size={18} color={colors.error} />
                  </Pressable>
                </View>
                {idx < settings.supplyItems.length - 1 && <Divider colors={colors} />}
              </View>
            ))
          )}
          <Divider colors={colors} />
          <Pressable
            style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}
            onPress={() => openSupplyModal()}
          >
            <IconSymbol name="plus.circle.fill" size={18} color={colors.primary} />
            <Text style={[styles.rowLabel, { color: colors.primary }]}>新增補給品</Text>
          </Pressable>
        </View>}

        {/* ── 回饋設定 ── */}
        <SectionHeader title="回饋設定" colors={colors} onToggle={() => toggleSection("feedback")} collapsed={collapsedSections["feedback"]} />
        {!collapsedSections["feedback"] && <View style={[styles.section, { borderColor: colors.border }]}> 
          <ToggleRow
            icon="iphone.radiowaves.left.and.right"
            label="震動回饋"
            value={settings.vibrationEnabled}
            colors={colors}
            onToggle={(v) => updateSettings({ vibrationEnabled: v })}
          />
          <Divider colors={colors} />
          <ToggleRow
            icon="speaker.wave.2.fill"
            label="TTS 語音播報"
            value={settings.ttsEnabled}
            colors={colors}
            onToggle={(v) => updateSettings({ ttsEnabled: v })}
          />
          <Divider colors={colors} />
          <ToggleRow
            icon="music.note"
            label="音效提醒"
            value={settings.soundEnabled}
            colors={colors}
            onToggle={(v) => updateSettings({ soundEnabled: v })}
          />
          <Divider colors={colors} />
          <ToggleRow
            icon="bell.fill"
            label="通知提醒"
            value={settings.notificationEnabled}
            colors={colors}
            onToggle={(v) => updateSettings({ notificationEnabled: v })}
          />
        </View>}

        {/* ── 智慧省電模式 ── */}
        <SectionHeader title="智慧省電模式" colors={colors} onToggle={() => toggleSection("powerSaving")} collapsed={collapsedSections["powerSaving"]} />
        {!collapsedSections["powerSaving"] && <View style={[styles.section, { borderColor: colors.border }]}> 
          <ToggleRow
            icon="moon.fill"
            label="自動省電模式"
            value={powerSavingSettings.enabled}
            colors={colors}
            onToggle={(enabled) => { void updatePowerSavingSettings({ enabled }); }}
          />
          <Divider colors={colors} />
          <View style={styles.row}>
            <IconSymbol name="moon.fill" size={18} color={colors.muted} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowLabel, { color: colors.foreground }]}>無操作後自動調暗</Text>
              <Text style={[styles.rowHint, { color: colors.muted }]}>觸控、轉彎提示或補給提醒會立即恢復亮度</Text>
            </View>
            <TextInput
              style={[styles.numericInput, { color: colors.foreground, borderColor: colors.border }]}
              value={String(powerSavingSettings.timeoutSeconds)}
              onChangeText={(value) => {
                const seconds = Math.max(15, Math.min(3600, Number.parseInt(value || "15", 10) || 15));
                void updatePowerSavingSettings({ timeoutSeconds: seconds });
              }}
              keyboardType="number-pad"
              returnKeyType="done"
              editable={powerSavingSettings.enabled}
            />
            <Text style={[styles.rowHint, { color: colors.muted, marginLeft: 6 }]}>秒</Text>
          </View>
          <Divider colors={colors} />
          <ToggleRow
            icon="pause.circle.fill"
            label="靜止自動暫停定位"
            value={settings.idleAutoPauseEnabled}
            colors={colors}
            onToggle={(enabled) => updateSettings({ idleAutoPauseEnabled: enabled })}
          />
          <Divider colors={colors} />
          <View style={styles.row}>
            <IconSymbol name="clock.badge.exclamationmark" size={18} color={colors.muted} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowLabel, { color: colors.foreground }]}>靜止後切換省電監測</Text>
              <Text style={[styles.rowHint, { color: colors.muted }]}>偵測到重新移動時會自動恢復完整定位</Text>
            </View>
            <TextInput
              style={[styles.numericInput, { color: colors.foreground, borderColor: colors.border }]}
              value={String(settings.idleAutoPauseSeconds)}
              onChangeText={(value) => {
                const seconds = Math.max(30, Math.min(900, Number.parseInt(value || "30", 10) || 30));
                void updateSettings({ idleAutoPauseSeconds: seconds });
              }}
              keyboardType="number-pad"
              returnKeyType="done"
              editable={settings.idleAutoPauseEnabled}
            />
            <Text style={[styles.rowHint, { color: colors.muted, marginLeft: 6 }]}>秒</Text>
          </View>
        </View>}

        {/* ── 騎乘防誤觸 ── */}
        <SectionHeader title="騎乘防誤觸" colors={colors} onToggle={() => toggleSection("touchGuard")} collapsed={collapsedSections["touchGuard"]} />
        {!collapsedSections["touchGuard"] && <View style={[styles.section, { borderColor: colors.border }]}> 
          <ToggleRow
            icon="lock.fill"
            label="騎乘時自動鎖定觸控"
            value={settings.touchGuardEnabled}
            colors={colors}
            onToggle={(enabled) => updateSettings({ touchGuardEnabled: enabled })}
          />
          <Divider colors={colors} />
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowLabel, { color: colors.foreground }]}>解除方式</Text>
              <Text style={[styles.rowHint, { color: colors.muted }]}>鎖定時仍能觀看地圖與數據，只會阻擋誤觸控制</Text>
            </View>
          </View>
          <View style={styles.guardModeRow}>
            {([
              ["hold", "長按 1.2 秒"],
              ["swipe", "向右滑動"],
            ] as const).map(([mode, label]) => (
              <Pressable
                key={mode}
                style={({ pressed }) => [
                  styles.guardModeChip,
                  {
                    backgroundColor: settings.touchGuardUnlockMode === mode ? colors.primary : colors.surface,
                    borderColor: settings.touchGuardUnlockMode === mode ? colors.primary : colors.border,
                    opacity: pressed ? 0.75 : 1,
                  },
                ]}
                onPress={() => updateSettings({ touchGuardUnlockMode: mode })}
                disabled={!settings.touchGuardEnabled}
              >
                <Text style={[styles.guardModeChipText, { color: settings.touchGuardUnlockMode === mode ? "#fff" : colors.foreground }]}>{label}</Text>
              </Pressable>
            ))}
          </View>
        </View>}

        {/* ── 本機資料匯入 ── */}
        <SectionHeader title="本機資料" colors={colors} onToggle={() => toggleSection("localData")} collapsed={collapsedSections["localData"]} />
        {!collapsedSections["localData"] && <View style={[styles.section, { borderColor: colors.border }]}> 
          <Pressable
            style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}
            onPress={handleManualRideImport}
          >
            <IconSymbol name="arrow.down.circle.fill" size={18} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowLabel, { color: colors.foreground }]}>匯入／手動同步騎乘紀錄</Text>
              <Text style={[styles.rowHint, { color: colors.muted }]}>從手機選取 .gpx 或 .json 備份，僅儲存在本機</Text>
            </View>
            <IconSymbol name="chevron.right" size={16} color={colors.muted} />
          </Pressable>
        </View>}

        {/* ── 精簡導航模式 ── */}
        <SectionHeader title="精簡導航模式" colors={colors} onToggle={() => toggleSection("simplified")} collapsed={collapsedSections["simplified"]} />
        {!collapsedSections["simplified"] && <View style={[styles.section, { borderColor: colors.border }]}>
          <View style={styles.row}>
            <IconSymbol name="moon.fill" size={18} color={colors.muted} />
            <Text style={[styles.rowLabel, { color: colors.foreground, flex: 1 }]}>模式選擇</Text>
            <View style={{ flexDirection: "row", gap: 6 }}>
              {(["off", "manual", "auto"] as const).map((mode) => (
                <Pressable
                  key={mode}
                  style={({ pressed }) => ([
                    styles.modeChip,
                    {
                      backgroundColor: settings.simplifiedNavMode === mode ? colors.accent : colors.surface,
                      borderColor: settings.simplifiedNavMode === mode ? colors.accent : colors.border,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ])}
                  onPress={() => updateSettings({ simplifiedNavMode: mode })}
                >
                  <Text style={[styles.modeChipText, { color: settings.simplifiedNavMode === mode ? "#fff" : colors.muted }]}>
                    {mode === "off" ? "關閉" : mode === "manual" ? "手動" : "自動"}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
          {settings.simplifiedNavMode === "auto" && (
            <>
              <Divider colors={colors} />
              <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 /* internal spacing */ }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <IconSymbol name="clock.fill" size={16} color={colors.muted} />
                    <Text style={{ fontSize: 15, color: colors.foreground }}>自動開啟閒置時間</Text>
                  </View>
                  <Text style={{ fontSize: 15, fontWeight: "600", color: colors.primary }}>
                    {settings.simplifiedNavIdleSec ?? 30} 秒
                  </Text>
                </View>
                <Slider
                  style={{ width: "100%", height: 36 }}
                  minimumValue={10}
                  maximumValue={120}
                  step={5}
                  value={settings.simplifiedNavIdleSec ?? 30}
                  onValueChange={(v) => updateSettings({ simplifiedNavIdleSec: Math.round(v) })}
                  minimumTrackTintColor={colors.primary}
                  maximumTrackTintColor={colors.border}
                  thumbTintColor={colors.primary}
                />
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 11, color: colors.muted }}>10 秒</Text>
                  <Text style={{ fontSize: 11, color: colors.muted }}>120 秒</Text>
                </View>
                <Text style={{ fontSize: 12, color: colors.muted, marginTop: 4 }}>騎乘中閒置此時間後自動進入精簡模式</Text>
              </View>
            </>
          )}
        </View>}

        {/* ── 導航儀表板欄位（拖曳排序 + 開關） ── */}
        {/* 導航儀表板欄位標題 + 恢復預設按鈕 */}
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 /* internal spacing */ }}>
          <SectionHeader title="導航儀表板欄位" colors={colors} />
          <Pressable
            onPress={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setDragOrder(DEFAULT_FIELD_ORDER);
              updateFieldOrder(DEFAULT_FIELD_ORDER);
            }}
            style={({ pressed }) => ([
              styles.resetBtn,
              { borderColor: colors.border, backgroundColor: pressed ? colors.surface : "transparent" },
            ])}
          >
            <Text style={{ fontSize: 12, color: colors.muted }}>恢復預設</Text>
          </Pressable>
        </View>
        <Text style={{ fontSize: 11, color: colors.muted, marginBottom: 8 /* internal spacing */, paddingHorizontal: 4 }}>
          拖曳右側☰按鈕可調整顯示順序，前 6 格在收縮面板顯示
        </Text>
        <View style={[styles.section, { borderColor: colors.border }]}>
          {dragOrder.map((key, idx) => {
            const isDragging = draggingIdx === idx;
            const isHover = hoverIdx === idx && draggingIdx !== null && draggingIdx !== idx;
            const responder = makeDragResponder(idx);
            return (
              <React.Fragment key={key}>
                <Animated.View
                  style={[
                    styles.row,
                    isDragging && {
                      backgroundColor: colors.surface,
                      opacity: 0.92,
                      zIndex: 20,
                      elevation: 12,
                      shadowColor: "#000",
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.22,
                      shadowRadius: 8,
                      transform: [{ scale: 1.025 }],
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: "#34C759",
                    },
                    isHover && { backgroundColor: colors.border + "55" },
                  ]}
                >
                  <Switch
                    value={settings.normalModeFields?.[key] ?? false}
                    onValueChange={(v) => updateNormalFields({ [key]: v })}
                    trackColor={{ false: "#767577", true: "#34C759" }}
                    thumbColor="#fff"
                    ios_backgroundColor="#767577"
                  />
                  <Text style={[styles.rowLabel, { color: colors.foreground, flex: 1, marginLeft: 4 }]}>
                    {FIELD_LABELS[key]}
                  </Text>
                  <Text style={[
                    { fontSize: 11, marginRight: 4 },
                    idx < 6
                      ? { color: "#34C759", fontWeight: "600" }
                      : { color: colors.muted },
                  ]}>
                    {idx < 6 ? "面板" : "展開"}
                  </Text>
                  <View {...responder.panHandlers} style={styles.dragHandle}>
                    <Text style={[
                      { fontSize: 20, lineHeight: 24 },
                      isDragging ? { color: "#34C759" } : { color: colors.muted },
                    ]}>☰</Text>
                  </View>
                </Animated.View>
                {idx < dragOrder.length - 1 && (
                  idx === 5 ? (
                    /* 面板區 / 展開區 分界線 */
                    <View style={styles.panelDivider}>
                      <View style={[styles.panelDividerLine, { borderColor: "#34C759" }]} />
                      <Text style={styles.panelDividerLabel}>↑ 面板區  展開區 ↓</Text>
                      <View style={[styles.panelDividerLine, { borderColor: "#34C759" }]} />
                    </View>
                  ) : (
                    <Divider colors={colors} />
                  )
                )}
              </React.Fragment>
            );
          })}
        </View>

        {/* ── 精簡導航模式欄位（拖曳排序 + 開關 + 上限限制） ── */}
        {(() => {
          const SIMPLIFIED_MAX = 3;
          const simplifiedEnabledCount = simpDragOrder.filter(
            (k) => settings.simplifiedModeFields?.[k] ?? false
          ).length;
          return (
            <>
              {/* 標題 + 恢復預設按鈕 */}
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 /* internal spacing */ }}>
                <SectionHeader title="精簡模式欄位" colors={colors} />
                <Pressable
                  onPress={() => {
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    setSimpDragOrder(DEFAULT_SIMPLIFIED_FIELD_ORDER);
                    updateSimplifiedFieldOrder(DEFAULT_SIMPLIFIED_FIELD_ORDER);
                  }}
                  style={({ pressed }) => ([
                    styles.resetBtn,
                    { borderColor: colors.border, backgroundColor: pressed ? colors.surface : "transparent" },
                  ])}
                >
                  <Text style={{ fontSize: 12, color: colors.muted }}>恢復預設</Text>
                </Pressable>
              </View>
              {/* 計數徽章 + 說明 */}
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 /* internal spacing */, paddingHorizontal: 4 }}>
                <Text style={{ fontSize: 11, color: colors.muted, flex: 1 }}>
                  拖曳右側☰可調整顯示順序，最多開啟 3 個欄位
                </Text>
                <Text style={[
                  { fontSize: 12, fontWeight: "700", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
                  simplifiedEnabledCount >= SIMPLIFIED_MAX
                    ? { color: "#fff", backgroundColor: "#FF3B30" }
                    : { color: "#34C759", backgroundColor: "#34C75920" },
                ]}>
                  {simplifiedEnabledCount} / {SIMPLIFIED_MAX}
                </Text>
              </View>
              <View style={[styles.section, { borderColor: colors.border }]}>
                {simpDragOrder.map((key, idx) => {
                  const isOn = settings.simplifiedModeFields?.[key] ?? false;
                  const isDisabled = !isOn && simplifiedEnabledCount >= SIMPLIFIED_MAX;
                  const isSimpDragging = simpDraggingIdx === idx;
                  const isSimpHover = simpHoverIdx === idx && simpDraggingIdx !== null && simpDraggingIdx !== idx;
                  const responder = makeSimpDragResponder(idx);
                  return (
                    <React.Fragment key={key}>
                      <Animated.View
                        style={[
                          styles.row,
                          isDisabled && { opacity: 0.4 },
                          isSimpDragging && {
                            backgroundColor: colors.surface,
                            opacity: 0.92,
                            zIndex: 20,
                            elevation: 12,
                            shadowColor: "#000",
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.22,
                            shadowRadius: 8,
                            transform: [{ scale: 1.025 }],
                            borderRadius: 10,
                            borderWidth: 1,
                            borderColor: "#34C759",
                          },
                          isSimpHover && { backgroundColor: colors.border + "55" },
                        ]}
                      >
                        <Switch
                          value={isOn}
                          disabled={isDisabled}
                          onValueChange={(v) => {
                            if (v && simplifiedEnabledCount >= SIMPLIFIED_MAX) {
                              Alert.alert(
                                "已達上限",
                                `精簡模式最多只能開啟 ${SIMPLIFIED_MAX} 個欄位，請先關閉其中一個再開啟新欄位。`,
                                [{ text: "瞭解" }]
                              );
                              return;
                            }
                            updateSimplifiedFields({ [key]: v });
                          }}
                          trackColor={{ false: "#767577", true: "#34C759" }}
                          thumbColor="#fff"
                          ios_backgroundColor="#767577"
                        />
                        <Text style={[styles.rowLabel, { color: colors.foreground, flex: 1, marginLeft: 4 }]}>
                          {SIMP_FIELD_LABELS[key]}
                        </Text>
                        <View {...responder.panHandlers} style={styles.dragHandle}>
                          <Text style={[
                            { fontSize: 20, lineHeight: 24 },
                            isSimpDragging ? { color: "#34C759" } : { color: colors.muted },
                          ]}>☰</Text>
                        </View>
                      </Animated.View>
                      {idx < simpDragOrder.length - 1 && <Divider colors={colors} />}
                    </React.Fragment>
                  );
                })}
              </View>
            </>
          );
        })()}

        {/* 版本號 */}
        <View style={{ alignItems: "center", paddingVertical: 20, paddingBottom: 8 /* internal spacing */ }}>
          <Text style={{ fontSize: 12, color: colors.muted }}>
            單車助手 v{Constants.expoConfig?.version ?? "1.0.1"}
          </Text>
        </View>
      </ScrollView>

      {/* Edit Modal */}
      <Modal
        visible={editModal.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditModal({ ...editModal, visible: false })}
      >
        <View style={styles.editOverlay}>
          <View style={[styles.editCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.editTitle, { color: colors.foreground }]}>
              設定 {editModal.label}
            </Text>
            <View style={[styles.editInputRow, { borderColor: colors.border }]}>
              <TextInput
                style={[styles.editInput, { color: colors.foreground }]}
                value={editModal.value}
                onChangeText={(v) => setEditModal({ ...editModal, value: v })}
                keyboardType="numeric"
                autoFocus
                selectTextOnFocus
                placeholderTextColor={colors.muted}
              />
              <Text style={[styles.editUnit, { color: colors.muted }]}>{editModal.unit}</Text>
            </View>
            <View style={styles.editBtnRow}>
              <Pressable
                style={({ pressed }) => [styles.editCancelBtn, { borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
                onPress={() => setEditModal({ ...editModal, visible: false })}
              >
                <Text style={[styles.editCancelText, { color: colors.muted }]}>取消</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.editSaveBtn, { backgroundColor: colors.accent, opacity: pressed ? 0.85 : 1 }]}
                onPress={saveEdit}
              >
                <Text style={styles.editSaveText}>儲存</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── 補給品管理 Modal ── */}
      <Modal
        visible={supplyModal.visible}
        transparent
        animationType="slide"
        onRequestClose={closeSupplyModal}
      >
        <SafeAreaView style={[styles.modalOverlay, { backgroundColor: "rgba(0,0,0,0.5)" }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface, flex: 1, display: "flex", flexDirection: "column" }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                {supplyModal.mode === "add" ? "新增補給品" : "編輯補給品"}
              </Text>
              <Pressable onPress={closeSupplyModal}>
                <IconSymbol name="xmark.circle.fill" size={24} color={colors.muted} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 20 }} style={{ flex: 1 }}>
              {/* 補給品名稱 */}
              <View style={{ marginBottom: 24 /* internal spacing */ }}>
                <Text style={{ fontSize: 16, fontWeight: "700", color: colors.foreground, marginBottom: 10 /* internal spacing */ }}>
                  補給品名稱 *
                </Text>
                <TextInput
                  style={[
                    styles.textInput,
                    { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background, fontSize: 17, paddingVertical: 16, paddingHorizontal: 16 },
                  ]}
                  placeholder="例如：運動飲料、能量棒"
                  placeholderTextColor={colors.muted}
                  value={supplyForm.name}
                  onChangeText={(text) => setSupplyForm({ ...supplyForm, name: text })}
                />
              </View>

              {/* 觸發方式 */}
              <View style={{ marginBottom: 24 /* internal spacing */ }}>
                <Text style={{ fontSize: 16, fontWeight: "700", color: colors.foreground, marginBottom: 12 /* internal spacing */ }}>
                  觸發方式
                </Text>
                <View style={{ flexDirection: "row", gap: 12 }}>
                  {(["time", "distance"] as const).map((type) => (
                    <Pressable
                      key={type}
                      style={({ pressed }) => ([
                        styles.chipButton,
                        {
                          backgroundColor: supplyForm.triggerType === type ? colors.primary : colors.background,
                          borderColor: supplyForm.triggerType === type ? colors.primary : colors.border,
                          opacity: pressed ? 0.7 : 1,
                        },
                      ])}
                      onPress={() => setSupplyForm({ ...supplyForm, triggerType: type })}
                    >
                      <Text
                        style={{
                          color: supplyForm.triggerType === type ? "#fff" : colors.foreground,
                          fontWeight: "600",
                          fontSize: 14,
                        }}
                      >
                        {type === "time" ? "時間" : "距離"}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* 觸發值 */}
              {supplyForm.triggerType === "time" ? (
                <View style={{ marginBottom: 24 /* internal spacing */ }}>
                  <Text style={{ fontSize: 16, fontWeight: "700", color: colors.foreground, marginBottom: 12 /* internal spacing */ }}>
                    觸發時間
                  </Text>
                  <View style={{ flexDirection: "row", gap: 14 }}>
                    {/* 時 */}
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, color: colors.muted, marginBottom: 8 /* internal spacing */, fontWeight: "600" }}>時</Text>
                      <TextInput
                        style={[
                          styles.textInput,
                          { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background, fontSize: 18, paddingVertical: 16, textAlign: "center" },
                        ]}
                        placeholder="0"
                        placeholderTextColor={colors.muted}
                        keyboardType="number-pad"
                        value={String(supplyForm.triggerHours)}
                        onChangeText={(text) => setSupplyForm({ ...supplyForm, triggerHours: parseInt(text) || 0 })}
                      />
                    </View>
                    {/* 分 */}
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, color: colors.muted, marginBottom: 8 /* internal spacing */, fontWeight: "600" }}>分</Text>
                      <TextInput
                        style={[
                          styles.textInput,
                          { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background, fontSize: 18, paddingVertical: 16, textAlign: "center" },
                        ]}
                        placeholder="0"
                        placeholderTextColor={colors.muted}
                        keyboardType="number-pad"
                        value={String(supplyForm.triggerMinutes)}
                        onChangeText={(text) => setSupplyForm({ ...supplyForm, triggerMinutes: parseInt(text) || 0 })}
                      />
                    </View>
                    {/* 秒 */}
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, color: colors.muted, marginBottom: 8 /* internal spacing */, fontWeight: "600" }}>秒</Text>
                      <TextInput
                        style={[
                          styles.textInput,
                          { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background, fontSize: 18, paddingVertical: 16, textAlign: "center" },
                        ]}
                        placeholder="0"
                        placeholderTextColor={colors.muted}
                        keyboardType="number-pad"
                        value={String(supplyForm.triggerSeconds)}
                        onChangeText={(text) => setSupplyForm({ ...supplyForm, triggerSeconds: parseInt(text) || 0 })}
                      />
                    </View>
                  </View>
                </View>
              ) : (
                <View style={{ marginBottom: 16 /* internal spacing */ }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 /* internal spacing */ }}>
                    <Text style={{ fontSize: 14, fontWeight: "600", color: colors.foreground }}>
                      觸發值
                    </Text>
                    <Text style={{ fontSize: 14, fontWeight: "600", color: colors.primary }}>
                      {supplyForm.triggerValue} 公里
                    </Text>
                  </View>
                  <Slider
                    style={{ width: "100%", height: 36 }}
                    minimumValue={1}
                    maximumValue={50}
                    step={1}
                    value={supplyForm.triggerValue}
                    onValueChange={(v) => setSupplyForm({ ...supplyForm, triggerValue: Math.round(v) })}
                    minimumTrackTintColor={colors.primary}
                    maximumTrackTintColor={colors.border}
                  />
                </View>
              )}

              {/* 重複模式 */}
              <View style={{ marginBottom: 16 /* internal spacing */ }}>
                <Text style={{ fontSize: 14, fontWeight: "600", color: colors.foreground, marginBottom: 6 /* internal spacing */ }}>
                  重複模式
                </Text>
                <View style={{ gap: 8 }}>
                  {(["once", "every", "off"] as const).map((mode) => (
                    <Pressable
                      key={mode}
                      style={({ pressed }) => ([
                        styles.modeButton,
                        {
                          backgroundColor: supplyForm.repeatMode === mode ? colors.primary : colors.background,
                          borderColor: supplyForm.repeatMode === mode ? colors.primary : colors.border,
                          opacity: pressed ? 0.7 : 1,
                        },
                      ])}
                      onPress={() => setSupplyForm({ ...supplyForm, repeatMode: mode })}
                    >
                      <Text
                        style={{
                          color: supplyForm.repeatMode === mode ? "#fff" : colors.foreground,
                          fontWeight: "600",
                          fontSize: 14,
                        }}
                      >
                        {mode === "once" ? "只提醒一次" : mode === "every" ? "每次提醒" : "不提醒"}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* 高級提醒功能 */}
              <View style={{ marginBottom: 20 /* internal spacing */, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
                <Text style={{ fontSize: 14, fontWeight: "700", color: colors.foreground, marginBottom: 12 /* internal spacing */ }}>
                  高級提醒功能
                </Text>

                {/* 未關閉時重複提醒 */}
                <View style={{ marginBottom: 14 /* internal spacing */, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: "600", color: colors.foreground }}>
                      未關閉時重複提醒
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>
                      彈窗未確認時持續提醒
                    </Text>
                  </View>
                  <Switch
                    value={supplyForm.repeatUntilDismissed ?? false}
                    onValueChange={(v) => setSupplyForm({ ...supplyForm, repeatUntilDismissed: v })}
                    trackColor={{ false: colors.border, true: colors.primary }}
                  />
                </View>

                {/* 自動關閉功能已移除 - 彈窗現在只能通過音量鍵或按鈕手動關閉 */}

                {/* 長下坡暫停提醒 */}
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: "600", color: colors.foreground }}>
                      長下坡暫停提醒
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>
                      下坡時暫停提醒但仍計數
                    </Text>
                  </View>
                  <Switch
                    value={supplyForm.pauseOnDownhill ?? false}
                    onValueChange={(v) => setSupplyForm({ ...supplyForm, pauseOnDownhill: v })}
                    trackColor={{ false: colors.border, true: colors.primary }}
                  />
                </View>
              </View>
            </ScrollView>

            {/* 固定底部按鈕區域 */}
            <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: 24, paddingVertical: 16, paddingBottom: 16 /* internal spacing */, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface }}>
              <Pressable
                style={({ pressed }) => ([
                  styles.editCancelBtn,
                  { borderColor: colors.border, opacity: pressed ? 0.7 : 1, flex: 1 },
                ])}
                onPress={closeSupplyModal}
              >
                <Text style={[styles.editCancelText, { color: colors.muted }]}>取消</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => ([
                  styles.editConfirmBtn,
                  { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1, flex: 1 },
                ])}
                onPress={handleSaveSupply}
              >
                <Text style={[styles.editConfirmText, { color: "#fff" }]}>保存</Text>
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      </Modal>
      {/* 感測器配對 Modal */}
      <SensorPairingModal
        visible={sensorModalVisible}
        onClose={() => setSensorModalVisible(false)}
      />
    </ScreenContainer>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({
  title, colors, onToggle, collapsed,
}: {
  title: string; colors: any;
  onToggle?: () => void;
  collapsed?: boolean;
}) {
  if (!onToggle) {
    return <Text style={[styles.sectionHeader, { color: colors.muted }]}>{title}</Text>;
  }
  return (
    <Pressable
      onPress={onToggle}
      style={({ pressed }) => ([
        { flexDirection: "row", alignItems: "center", paddingVertical: 2, opacity: pressed ? 0.7 : 1, flex: 1 },
      ])}
    >
      <Text style={[styles.sectionHeader, { color: colors.muted, flex: 1, marginBottom: 0 /* internal spacing */ }]}>{title}</Text>
      <Text style={{ fontSize: 12, color: colors.muted, marginRight: 4 }}>
        {collapsed ? "▶" : "▼"}
      </Text>
    </Pressable>
  );
}

function Divider({ colors }: { colors: any }) {
  return (
    <View style={[styles.divider, { backgroundColor: colors.border }]} />
  );
}

function NumberRow({
  icon, label, value, unit, colors, iconColor, hint, onPress,
}: {
  icon: string; label: string; value: number; unit: string;
  colors: any; iconColor?: string; hint?: string; onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}
      onPress={onPress}
    >
      <IconSymbol name={icon as any} size={18} color={iconColor ?? colors.muted} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowLabel, { color: colors.foreground }]}>{label}</Text>
        {hint && (
          <Text style={[styles.rowHint, { color: colors.muted }]}>{hint}</Text>
        )}
      </View>
      <View style={styles.rowRight}>
        <Text style={[styles.rowValue, { color: colors.accent }]}>
          {value} {unit}
        </Text>
        <IconSymbol name="chevron.right" size={16} color={colors.muted} />
      </View>
    </Pressable>
  );
}

function ToggleRow({
  icon, label, value, colors, onToggle,
}: {
  icon: string; label: string; value: boolean; colors: any; onToggle: (v: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <IconSymbol name={icon as any} size={18} color={colors.muted} />
      <Text style={[styles.rowLabel, { color: colors.foreground }]}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: "#767577", true: "#34C759" }}
        thumbColor="#fff"
        ios_backgroundColor="#767577"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 40 /* internal spacing */ },
  title: { fontSize: 28, fontWeight: "700", letterSpacing: -0.5, marginBottom: 24 /* internal spacing */ },
  sectionHeader: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8 /* internal spacing */,
    marginTop: 20,
    paddingHorizontal: 4,
  },
  section: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  rowLabel: { fontSize: 15 },
  rowHint: { fontSize: 11, marginTop: 2 },
  rowRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  rowValue: { fontSize: 15, fontWeight: "500" },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 46 },
  aboutRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  aboutLabel: { fontSize: 14 },
  aboutValue: { fontSize: 14, fontWeight: "500" },
  // Edit Modal
  editOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  editCard: {
    width: "100%",
    maxWidth: 320,
    borderRadius: 20,
    padding: 24,
    borderWidth: StyleSheet.hairlineWidth,
  },
  editTitle: { fontSize: 18, fontWeight: "700", marginBottom: 16 /* internal spacing */ },
  editInputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 20 /* internal spacing */,
  },
  editInput: { flex: 1, fontSize: 24, fontWeight: "300", paddingVertical: 12 },
  editUnit: { fontSize: 16 },
  editBtnRow: { flexDirection: "row", gap: 12 },
  editCancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
  },
  editCancelText: { fontSize: 15, fontWeight: "600" },
  editSaveBtn: {
    flex: 2,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: "center",
  },
  editSaveText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  // Mode chip
  modeChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  modeChipText: { fontSize: 13, fontWeight: "600" },
  // Profile card
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 12,
    margin: 4,
  },
  profileAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  profileAvatarText: { fontSize: 22, fontWeight: "700", color: "#fff" },
  profileName: { fontSize: 16, fontWeight: "700", marginBottom: 2 /* internal spacing */ },
  profileEmail: { fontSize: 12, marginBottom: 6 /* internal spacing */ },
  profileBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  profileBadgeText: { fontSize: 11, fontWeight: "600" },
  dragHandle: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  resetBtn: {
    marginLeft: "auto",
    marginTop: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  panelDivider: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 6,
    gap: 8,
  },
  panelDividerLine: {
    flex: 1,
    borderTopWidth: 1,
    borderStyle: "dashed",
  },
  panelDividerLabel: {
    fontSize: 10,
    color: "#34C759",
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  // Delete Account Modal
  deleteIconWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteWarningText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8 /* internal spacing */,
  },
  deleteInfoBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 16 /* internal spacing */,
    gap: 4,
  },
  deleteInfoItem: {
    fontSize: 14,
    lineHeight: 20,
  },
  deleteConfirmBtn: {
    flex: 2,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: "center",
  },
  deleteConfirmText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  deleteErrorText: {
    fontSize: 13,
    marginBottom: 4 /* internal spacing */,
    textAlign: "center",
  },
  deleteStatusText: {
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  chipButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  modeButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  numericInput: {
    minWidth: 56,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 7,
    fontSize: 14,
    textAlign: "center",
  },
  guardModeRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 2,
  },
  guardModeChip: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: "center",
  },
  guardModeChipText: {
    fontSize: 13,
    fontWeight: "700",
  },
  editConfirmBtn: {
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: "center",
  },
  editConfirmText: {
    fontSize: 15,
    fontWeight: "700",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "transparent",
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    width: "100%",
    maxHeight: "85%",
    paddingTop: 16,
    paddingBottom: 0 /* internal spacing */,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
});
