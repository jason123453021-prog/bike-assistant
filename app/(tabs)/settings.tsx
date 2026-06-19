import React, { useState, useRef, useCallback } from "react";
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

// 啟用 Android LayoutAnimation
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import Slider from "@react-native-community/slider";
import { router } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useSettings, DEFAULT_FIELD_ORDER, DEFAULT_SIMPLIFIED_FIELD_ORDER, type NormalFieldKey, type SimplifiedFieldKey } from "@/lib/settings-context";
import { useAuth } from "@/hooks/use-auth";
import { startOAuthLogin } from "@/constants/oauth";
import { trpc } from "@/lib/trpc";

export default function SettingsScreen() {
  const colors = useColors();
  const { settings, updateSettings, updateNormalFields, updateSimplifiedFields, updateFieldOrder, updateSimplifiedFieldOrder } = useSettings();
  const { user, isAuthenticated, logout } = useAuth();
  const deleteAccountMutation = trpc.auth.deleteAccount.useMutation();

  // ── 刪除帳號防呆 Modal 狀態 ──
  const [deleteModal, setDeleteModal] = useState<{
    step: "confirm1" | "confirm2" | "loading" | "success" | "error";
    visible: boolean;
    confirmInput: string;
    errorMsg: string;
  }>({
    step: "confirm1",
    visible: false,
    confirmInput: "",
    errorMsg: "",
  });
  const CONFIRM_KEYWORD = "刪除帳號";

  const openDeleteModal = useCallback(() => {
    setDeleteModal({ step: "confirm1", visible: true, confirmInput: "", errorMsg: "" });
  }, []);

  const closeDeleteModal = useCallback(() => {
    setDeleteModal((prev) => ({ ...prev, visible: false, confirmInput: "", errorMsg: "" }));
  }, []);

  const handleDeleteAccount = openDeleteModal;

  const proceedToConfirm2 = useCallback(() => {
    setDeleteModal((prev) => ({ ...prev, step: "confirm2", confirmInput: "", errorMsg: "" }));
  }, []);

  const executeDelete = useCallback(async () => {
    const { confirmInput } = deleteModal;
    if (confirmInput.trim() !== CONFIRM_KEYWORD) {
      setDeleteModal((prev) => ({ ...prev, errorMsg: `請輸入「${CONFIRM_KEYWORD}」以確認` }));
      return;
    }
    setDeleteModal((prev) => ({ ...prev, step: "loading" }));
    try {
      await deleteAccountMutation.mutateAsync();
      setDeleteModal((prev) => ({ ...prev, step: "success" }));
      // 2 秒後自動關閉並登出
      setTimeout(() => {
        closeDeleteModal();
        logout();
      }, 2000);
    } catch {
      setDeleteModal((prev) => ({ ...prev, step: "error", errorMsg: "刪除失敗，請稍後再試或聯絡開發者。" }));
    }
  }, [deleteModal, deleteAccountMutation, logout, closeDeleteModal]);
  const [editModal, setEditModal] = useState<{
    visible: boolean;
    key: string;
    label: string;
    value: string;
    unit: string;
    isNumber: boolean;
  }>({ visible: false, key: "", label: "", value: "", unit: "", isNumber: true });

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
            label="FTP（功能閨値功率）"
            value={settings.ftp}
            unit="W"
            colors={colors}
            onPress={() => openEdit("ftp", "FTP", settings.ftp, "W")}
          />
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

        {/* ── 帳號與社交 ── */}
        <SectionHeader title="帳號與好友" colors={colors} onToggle={() => toggleSection("account")} collapsed={collapsedSections["account"]} />
        {!collapsedSections["account"] && <View style={[styles.section, { borderColor: colors.border }]}>
          {isAuthenticated ? (
            <>
              {/* 個人資料卡片 */}
              <View style={[styles.profileCard, { backgroundColor: colors.surface }]}>
                <View style={[styles.profileAvatar, { backgroundColor: colors.accent }]}>
                  <Text style={styles.profileAvatarText}>
                    {(user?.name ?? "?").charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.profileName, { color: colors.foreground }]}>{user?.name ?? "未命名"}</Text>
                  <Text style={[styles.profileEmail, { color: colors.muted }]}>{user?.email ?? ""}</Text>
                  <View style={[styles.profileBadge, { backgroundColor: colors.accent + "22" }]}>
                    <Text style={[styles.profileBadgeText, { color: colors.accent }]}>已登入</Text>
                  </View>
                </View>
              </View>
              <Divider colors={colors} />
              <Pressable
                style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}
                onPress={() => router.push("/friends" as any)}
              >
                <IconSymbol name="person.2.fill" size={18} color={colors.muted} />
                <Text style={[styles.rowLabel, { color: colors.foreground }]}>好友管理</Text>
                <View style={styles.rowRight}>
                  <IconSymbol name="chevron.right" size={16} color={colors.muted} />
                </View>
              </Pressable>
              <Divider colors={colors} />
              <Pressable
                style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}
                onPress={() => Alert.alert("登出", "確定要登出帳號？", [
                  { text: "取消", style: "cancel" },
                  { text: "登出", style: "destructive", onPress: logout },
                ])}
              >
                <IconSymbol name="arrow.left" size={18} color={colors.error} />
                <Text style={[styles.rowLabel, { color: colors.error }]}>登出帳號</Text>
              </Pressable>
              <Divider colors={colors} />
              <Pressable
                style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}
                onPress={handleDeleteAccount}
              >
                <IconSymbol name="trash.fill" size={18} color={colors.error} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowLabel, { color: colors.error }]}>刪除帳號</Text>
                  <Text style={[styles.rowHint, { color: colors.muted }]}>永久刪除帳號及所有伺服器資料</Text>
                </View>
              </Pressable>
            </>
          ) : (
            <Pressable
              style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}
              onPress={startOAuthLogin}
            >
              <IconSymbol name="person.fill" size={18} color={colors.accent} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowLabel, { color: colors.accent }]}>登入帳號</Text>
                <Text style={[styles.rowHint, { color: colors.muted }]}>登入後可使用好友功能與隱私設定</Text>
              </View>
              <IconSymbol name="chevron.right" size={16} color={colors.muted} />
            </Pressable>
          )}
        </View>}

        {/* ── 隊伍遙測 ── */}
        <SectionHeader title="隊伍遙測" colors={colors} onToggle={() => toggleSection("team")} collapsed={collapsedSections["team"]} />
        {!collapsedSections["team"] && <View style={[styles.section, { borderColor: colors.border }]}>
          <ToggleRow
            icon="person.2.fill"
            label="開啟隊伍遙測"
            value={settings.teamTelemetryEnabled}
            colors={colors}
            onToggle={(v) => updateSettings({ teamTelemetryEnabled: v })}
          />
          <Divider colors={colors} />
          <ToggleRow
            icon="location.fill"
            label="顯示隊友位置"
            value={settings.showFriendLocation}
            colors={colors}
            onToggle={(v) => updateSettings({ showFriendLocation: v })}
          />
          <Divider colors={colors} />
          <ToggleRow
            icon="arrow.up.circle.fill"
            label="顯示隊友距離"
            value={settings.showFriendDistance}
            colors={colors}
            onToggle={(v) => updateSettings({ showFriendDistance: v })}
          />
        </View>}

        {/* ── 隱私設定 ── */}
        <SectionHeader title="安全與隱私" colors={colors} onToggle={() => toggleSection("privacy")} collapsed={collapsedSections["privacy"]} />
        {!collapsedSections["privacy"] && <View style={[styles.section, { borderColor: colors.border }]}>
          <ToggleRow
            icon="eye.slash.fill"
            label="隱身模式"
            value={settings.ghostMode}
            colors={colors}
            onToggle={(v) => updateSettings({ ghostMode: v })}
          />
          <Divider colors={colors} />
          <ToggleRow
            icon="location.fill"
            label="分享位置給好友"
            value={settings.shareLocation}
            colors={colors}
            onToggle={(v) => updateSettings({ shareLocation: v })}
          />
          <Divider colors={colors} />
          <Pressable
            style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}
            onPress={() => router.push("/privacy" as any)}
          >
            <IconSymbol name="doc.text.fill" size={18} color={colors.muted} />
            <Text style={[styles.rowLabel, { color: colors.foreground }]}>隱私政策</Text>
            <View style={styles.rowRight}>
              <IconSymbol name="chevron.right" size={16} color={colors.muted} />
            </View>
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
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
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
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
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
        <Text style={{ fontSize: 11, color: colors.muted, marginBottom: 8, paddingHorizontal: 4 }}>
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
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
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
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8, paddingHorizontal: 4 }}>
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

        <View style={{ height: 20 }} />
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

      {/* 刪除帳號防呆 Modal */}
      <Modal
        visible={deleteModal.visible}
        transparent
        animationType="fade"
        onRequestClose={closeDeleteModal}
      >
        <View style={styles.editOverlay}>
          <View style={[styles.editCard, { backgroundColor: colors.surface, borderColor: colors.border, maxWidth: 340 }]}>

            {/* Step 1: 第一次確認 */}
            {deleteModal.step === "confirm1" && (
              <>
                <View style={{ alignItems: "center", marginBottom: 12 }}>
                  <View style={[styles.deleteIconWrap, { backgroundColor: colors.error + "18" }]}>
                    <IconSymbol name="trash.fill" size={32} color={colors.error} />
                  </View>
                </View>
                <Text style={[styles.editTitle, { color: colors.error, textAlign: "center" }]}>刪除帳號</Text>
                <Text style={[styles.deleteWarningText, { color: colors.muted }]}>
                  此操作無法復原。以下資料將被永久刪除：
                </Text>
                <View style={[styles.deleteInfoBox, { backgroundColor: colors.error + "0D", borderColor: colors.error + "30" }]}>
                  <Text style={[styles.deleteInfoItem, { color: colors.foreground }]}>• 帳號資料（姓名、Email）</Text>
                  <Text style={[styles.deleteInfoItem, { color: colors.foreground }]}>• 好友關係記錄</Text>
                  <Text style={[styles.deleteInfoItem, { color: colors.foreground }]}>• 伺服器上的位置分享資料</Text>
                  <Text style={[styles.deleteInfoItem, { color: colors.muted, marginTop: 6, fontSize: 12 }]}>⚠️ 本機騎乘記錄不受影響</Text>
                </View>
                <View style={styles.editBtnRow}>
                  <Pressable
                    style={({ pressed }) => [styles.editCancelBtn, { borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
                    onPress={closeDeleteModal}
                  >
                    <Text style={[styles.editCancelText, { color: colors.muted }]}>取消</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [styles.deleteConfirmBtn, { backgroundColor: colors.error, opacity: pressed ? 0.85 : 1 }]}
                    onPress={proceedToConfirm2}
                  >
                    <Text style={styles.deleteConfirmText}>下一步</Text>
                  </Pressable>
                </View>
              </>
            )}

            {/* Step 2: 輸入確認文字 */}
            {deleteModal.step === "confirm2" && (
              <>
                <Text style={[styles.editTitle, { color: colors.error, textAlign: "center" }]}>最後確認</Text>
                <Text style={[styles.deleteWarningText, { color: colors.muted }]}>
                  請在下方輸入「刪除帳號」以確認此不可復原的操作：
                </Text>
                <View style={[styles.editInputRow, { borderColor: deleteModal.errorMsg ? colors.error : colors.border, marginBottom: 4 }]}>
                  <TextInput
                    style={[styles.editInput, { color: colors.foreground, fontSize: 18, fontWeight: "600" }]}
                    value={deleteModal.confirmInput}
                    onChangeText={(v) => setDeleteModal((prev) => ({ ...prev, confirmInput: v, errorMsg: "" }))}
                    placeholder="刪除帳號"
                    placeholderTextColor={colors.muted}
                    autoFocus
                    returnKeyType="done"
                    onSubmitEditing={executeDelete}
                  />
                </View>
                {deleteModal.errorMsg ? (
                  <Text style={[styles.deleteErrorText, { color: colors.error }]}>{deleteModal.errorMsg}</Text>
                ) : null}
                <View style={[styles.editBtnRow, { marginTop: 12 }]}>
                  <Pressable
                    style={({ pressed }) => [styles.editCancelBtn, { borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
                    onPress={() => setDeleteModal((prev) => ({ ...prev, step: "confirm1", errorMsg: "" }))}
                  >
                    <Text style={[styles.editCancelText, { color: colors.muted }]}>返回</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [
                      styles.deleteConfirmBtn,
                      {
                        backgroundColor: deleteModal.confirmInput.trim() === CONFIRM_KEYWORD ? colors.error : colors.border,
                        opacity: pressed ? 0.85 : 1,
                      },
                    ]}
                    onPress={executeDelete}
                  >
                    <Text style={styles.deleteConfirmText}>永久刪除</Text>
                  </Pressable>
                </View>
              </>
            )}

            {/* Step 3: 載入中 */}
            {deleteModal.step === "loading" && (
              <View style={{ alignItems: "center", paddingVertical: 24, gap: 16 }}>
                <ActivityIndicator size="large" color={colors.error} />
                <Text style={[styles.deleteStatusText, { color: colors.foreground }]}>正在刪除帳號資料…</Text>
                <Text style={[{ fontSize: 12, color: colors.muted }]}>請勿關閉應用程式</Text>
              </View>
            )}

            {/* Step 4: 成功 */}
            {deleteModal.step === "success" && (
              <View style={{ alignItems: "center", paddingVertical: 24, gap: 12 }}>
                <View style={[styles.deleteIconWrap, { backgroundColor: colors.success + "20" }]}>
                  <IconSymbol name="checkmark.circle.fill" size={40} color={colors.success} />
                </View>
                <Text style={[styles.deleteStatusText, { color: colors.success }]}>帳號已成功刪除</Text>
                <Text style={[{ fontSize: 13, color: colors.muted, textAlign: "center" }]}>所有伺服器資料已清除，即將登出…</Text>
              </View>
            )}

            {/* Step 5: 失敗 */}
            {deleteModal.step === "error" && (
              <>
                <View style={{ alignItems: "center", marginBottom: 12 }}>
                  <View style={[styles.deleteIconWrap, { backgroundColor: colors.error + "18" }]}>
                    <IconSymbol name="exclamationmark.triangle.fill" size={36} color={colors.error} />
                  </View>
                </View>
                <Text style={[styles.editTitle, { color: colors.error, textAlign: "center" }]}>刪除失敗</Text>
                <Text style={[styles.deleteWarningText, { color: colors.muted, textAlign: "center" }]}>{deleteModal.errorMsg}</Text>
                <Pressable
                  style={({ pressed }) => [styles.editCancelBtn, { borderColor: colors.border, opacity: pressed ? 0.7 : 1, marginTop: 8 }]}
                  onPress={closeDeleteModal}
                >
                  <Text style={[styles.editCancelText, { color: colors.muted }]}>關閉</Text>
                </Pressable>
              </>
            )}

          </View>
        </View>
      </Modal>
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
      <Text style={[styles.sectionHeader, { color: colors.muted, flex: 1, marginBottom: 0 }]}>{title}</Text>
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
  content: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: "700", letterSpacing: -0.5, marginBottom: 24 },
  sectionHeader: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
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
  editTitle: { fontSize: 18, fontWeight: "700", marginBottom: 16 },
  editInputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 20,
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
  profileName: { fontSize: 16, fontWeight: "700", marginBottom: 2 },
  profileEmail: { fontSize: 12, marginBottom: 6 },
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
    marginBottom: 8,
  },
  deleteInfoBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 16,
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
    marginBottom: 4,
    textAlign: "center",
  },
  deleteStatusText: {
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
});
