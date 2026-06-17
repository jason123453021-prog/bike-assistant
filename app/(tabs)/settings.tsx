import React, { useState } from "react";
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
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useSettings } from "@/lib/settings-context";

export default function SettingsScreen() {
  const colors = useColors();
  const { settings, updateSettings } = useSettings();
  const [editModal, setEditModal] = useState<{
    visible: boolean;
    key: string;
    label: string;
    value: string;
    unit: string;
    isNumber: boolean;
  }>({ visible: false, key: "", label: "", value: "", unit: "", isNumber: true });

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
        <SectionHeader title="個人資料" colors={colors} />
        <View style={[styles.section, { borderColor: colors.border }]}>
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
            icon="bolt.fill"
            label="FTP（功能閾值功率）"
            value={settings.ftp}
            unit="W"
            colors={colors}
            onPress={() => openEdit("ftp", "FTP", settings.ftp, "W")}
          />
        </View>

        {/* ── 補給閾值 ── */}
        <SectionHeader title="補給閾值" colors={colors} />
        <View style={[styles.section, { borderColor: colors.border }]}>
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
            label="水分提醒閾值"
            value={settings.waterThreshold}
            unit="ml"
            colors={colors}
            iconColor="#4FC3F7"
            onPress={() => openEdit("waterThreshold", "水分提醒閾值", settings.waterThreshold, "ml")}
          />
        </View>

        {/* ── 回饋設定 ── */}
        <SectionHeader title="回饋設定" colors={colors} />
        <View style={[styles.section, { borderColor: colors.border }]}>
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
        </View>

        {/* ── 關於 ── */}
        <SectionHeader title="關於" colors={colors} />
        <View style={[styles.section, { borderColor: colors.border }]}>
          <View style={styles.aboutRow}>
            <Text style={[styles.aboutLabel, { color: colors.muted }]}>版本</Text>
            <Text style={[styles.aboutValue, { color: colors.foreground }]}>1.0.0</Text>
          </View>
          <Divider colors={colors} />
          <View style={styles.aboutRow}>
            <Text style={[styles.aboutLabel, { color: colors.muted }]}>天氣來源</Text>
            <Text style={[styles.aboutValue, { color: colors.foreground }]}>Open-Meteo（免費）</Text>
          </View>
          <Divider colors={colors} />
          <View style={styles.aboutRow}>
            <Text style={[styles.aboutLabel, { color: colors.muted }]}>功率計算</Text>
            <Text style={[styles.aboutValue, { color: colors.foreground }]}>虛擬功率（GPS + 高度）</Text>
          </View>
        </View>

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
    </ScreenContainer>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ title, colors }: { title: string; colors: any }) {
  return (
    <Text style={[styles.sectionHeader, { color: colors.muted }]}>{title}</Text>
  );
}

function Divider({ colors }: { colors: any }) {
  return (
    <View style={[styles.divider, { backgroundColor: colors.border }]} />
  );
}

function NumberRow({
  icon, label, value, unit, colors, iconColor, onPress,
}: {
  icon: string; label: string; value: number; unit: string;
  colors: any; iconColor?: string; onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}
      onPress={onPress}
    >
      <IconSymbol name={icon as any} size={18} color={iconColor ?? colors.muted} />
      <Text style={[styles.rowLabel, { color: colors.foreground }]}>{label}</Text>
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
        trackColor={{ false: colors.border, true: colors.accent + "80" }}
        thumbColor={value ? colors.accent : colors.muted}
        ios_backgroundColor={colors.border}
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
  rowLabel: { flex: 1, fontSize: 15 },
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
});
