import React from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Dimensions,
  StatusBar,
} from "react-native";
import { IconSymbol } from "@/components/ui/icon-symbol";
import type { SimplifiedModeFields, SimplifiedFieldKey } from "@/lib/settings-context";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

export interface SimplifiedNavOverlayProps {
  visible: boolean;
  onDismiss: () => void;
  // 核心數據
  speed: number;           // km/h
  distance: number;        // km
  remainingDist?: number;  // km（導航中才有）
  direction?: string;      // 方向提示（如「左轉」「直行」）
  directionIcon?: string;  // SF Symbol 名稱
  currentTime: string;     // HH:MM
  elapsedTime: string;     // MM:SS 或 HH:MM:SS
  // 額外數據（新增欄位用）
  grade?: number;          // 坡度 %
  power?: number;          // 功率 W
  avgSpeed?: number;       // 均速 km/h
  calories?: number;       // 卡路里 kcal
  pausedTime?: string;     // 暫停時間
  totalAscent?: number;    // 累計爬升 m
  currentAltitude?: number; // 目前海拔 m
  // 自訂顯示欄位（由設定頁面控制）
  fields?: SimplifiedModeFields;
  // 欄位顯示順序
  fieldOrder?: SimplifiedFieldKey[];
}

const DEFAULT_FIELDS: SimplifiedModeFields = {
  showSpeed: true,
  showDistance: true,
  showElapsed: true,
  showCurrentTime: true,
  showRemaining: true,
  showDirection: true,
  showGrade: false,
  showPower: false,
  showAvgSpeed: false,
  showCalories: false,
  showPausedTime: false,
  showTotalAscent: false,
  showCurrentAltitude: false,
};

export function SimplifiedNavOverlay({
  visible,
  onDismiss,
  speed,
  distance,
  remainingDist,
  direction,
  directionIcon,
  currentTime,
  elapsedTime,
  grade,
  power,
  avgSpeed,
  calories,
  pausedTime,
  totalAscent,
  currentAltitude,
  fields,
  fieldOrder,
}: SimplifiedNavOverlayProps) {
  if (!visible) return null;

  const f = fields ?? DEFAULT_FIELDS;

  // 底部欄位：依 fieldOrder 排序，跳過 direction/remaining/speed（展示在其他區址）
  const BOTTOM_KEY_MAP: Partial<Record<SimplifiedFieldKey, () => { value: string; label: string } | null>> = {
    showDistance: () => f.showDistance ? { value: distance.toFixed(2), label: "公里" } : null,
    showElapsed: () => f.showElapsed ? { value: elapsedTime, label: "時間" } : null,
    showCurrentTime: () => f.showCurrentTime ? { value: currentTime, label: "現在" } : null,
    showGrade: () => f.showGrade ? { value: grade !== undefined ? `${grade > 0 ? "+" : ""}${grade.toFixed(1)}%` : "--", label: "坡度" } : null,
    showPower: () => f.showPower ? { value: power !== undefined ? `${power}W` : "--", label: "功率" } : null,
    showAvgSpeed: () => f.showAvgSpeed ? { value: avgSpeed !== undefined && avgSpeed > 0 ? avgSpeed.toFixed(1) : "--", label: "均速" } : null,
    showCalories: () => f.showCalories ? { value: calories !== undefined ? `${calories}` : "--", label: "kcal" } : null,
    showPausedTime: () => f.showPausedTime ? { value: pausedTime ?? "--", label: "暫停" } : null,
    showTotalAscent: () => f.showTotalAscent ? { value: totalAscent !== undefined ? `${totalAscent.toFixed(0)}` : "0", label: "m 爬升" } : null,
    showCurrentAltitude: () => f.showCurrentAltitude ? { value: currentAltitude !== undefined ? `${currentAltitude.toFixed(0)}` : "--", label: "m 海拔" } : null,
  };
  const BOTTOM_KEYS: SimplifiedFieldKey[] = ["showDistance", "showElapsed", "showCurrentTime", "showGrade", "showPower", "showAvgSpeed", "showCalories", "showPausedTime", "showTotalAscent", "showCurrentAltitude"];
  const orderedKeys = fieldOrder
    ? [...fieldOrder.filter((k) => BOTTOM_KEYS.includes(k)), ...BOTTOM_KEYS.filter((k) => !fieldOrder.includes(k))]
    : BOTTOM_KEYS;
  const bottomItems: { value: string; label: string }[] = [];
  for (const key of orderedKeys) {
    const fn = BOTTOM_KEY_MAP[key];
    if (fn) {
      const item = fn();
      if (item) bottomItems.push(item);
    }
  }

  return (
    <Pressable style={styles.overlay} onPress={onDismiss}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* 頂部：方向指引 */}
      {f.showDirection ? (
        direction ? (
          <View style={styles.directionRow}>
            {directionIcon && (
              <IconSymbol name={directionIcon as any} size={36} color="#fff" />
            )}
            <Text style={styles.directionText}>{direction}</Text>
          </View>
        ) : (
          <View style={styles.directionRow}>
            <Text style={styles.directionPlaceholder}>騎乘中</Text>
          </View>
        )
      ) : (
        <View style={styles.directionRow}>
          <Text style={styles.directionPlaceholder}>騎乘中</Text>
        </View>
      )}

      {/* 剩餘距離 */}
      {f.showRemaining && remainingDist !== undefined && (
        <View style={styles.remainRow}>
          <Text style={styles.remainLabel}>剩餘</Text>
          <Text style={styles.remainValue}>
            {remainingDist < 1
              ? `${Math.round(remainingDist * 1000)} m`
              : `${remainingDist.toFixed(1)} km`}
          </Text>
        </View>
      )}

      {/* 主要數據：速度 */}
      {f.showSpeed ? (
        <View style={styles.speedBlock}>
          <Text style={styles.speedValue}>{speed.toFixed(1)}</Text>
          <Text style={styles.speedUnit}>km/h</Text>
        </View>
      ) : (
        <View style={styles.speedBlock} />
      )}

      {/* 底部：距離 + 時間 + 當前時間（依設定動態顯示，超過3個橫向捲動） */}
      {bottomItems.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[
            styles.bottomRow,
            bottomItems.length <= 3 && { width: "100%", justifyContent: "space-around" },
          ]}
          style={{ width: "100%" }}
        >
          {bottomItems.map((item, idx) => (
            <React.Fragment key={item.label}>
              {idx > 0 && <View style={styles.bottomDivider} />}
              <View style={[
                styles.bottomItem,
                bottomItems.length > 3 && { minWidth: SCREEN_W / 3.5 },
              ]}>
                <Text style={styles.bottomValue}>{item.value}</Text>
                <Text style={styles.bottomLabel}>{item.label}</Text>
              </View>
            </React.Fragment>
          ))}
        </ScrollView>
      )}

      {/* 提示文字 */}
      <Text style={styles.tapHint}>點擊任意處返回標準模式</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#000",
    zIndex: 9999,
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 60,
    paddingBottom: 48,
    paddingHorizontal: 32,
  },
  directionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
  },
  directionText: {
    fontSize: 32,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: -0.5,
  },
  directionPlaceholder: {
    fontSize: 28,
    fontWeight: "300",
    color: "#888",
    letterSpacing: 2,
  },
  remainRow: {
    alignItems: "center",
    gap: 4,
  },
  remainLabel: {
    fontSize: 14,
    color: "#888",
    fontWeight: "500",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  remainValue: {
    fontSize: 40,
    fontWeight: "300",
    color: "#fff",
    letterSpacing: -1,
  },
  speedBlock: {
    alignItems: "center",
    gap: 0,
  },
  speedValue: {
    fontSize: 96,
    fontWeight: "200",
    color: "#fff",
    letterSpacing: -4,
    lineHeight: 100,
  },
  speedUnit: {
    fontSize: 18,
    fontWeight: "400",
    color: "#888",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
  },
  bottomItem: {
    alignItems: "center",
    flex: 1,
    gap: 4,
  },
  bottomValue: {
    fontSize: 26,
    fontWeight: "600",
    color: "#fff",
    letterSpacing: -0.5,
  },
  bottomLabel: {
    fontSize: 12,
    color: "#888",
    fontWeight: "500",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  bottomDivider: {
    width: 1,
    height: 40,
    backgroundColor: "#333",
  },
  tapHint: {
    fontSize: 12,
    color: "#555",
    letterSpacing: 0.5,
  },
});
