import React, { useEffect, useState } from "react";
import { View, Text, Modal, Pressable, ScrollView, ActivityIndicator, Alert } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { bluetoothSensorManager, type SensorDevice } from "@/lib/bluetooth-sensor";
import { IconSymbol } from "@/components/ui/icon-symbol";

export interface SensorPairingModalProps {
  visible: boolean;
  onClose: () => void;
}

export function SensorPairingModal({ visible, onClose }: SensorPairingModalProps) {
  const colors = useColors();
  const [devices, setDevices] = useState<SensorDevice[]>([]);
  const [scanning, setScanning] = useState(false);
  const [connecting, setConnecting] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      handleScan();
    }
  }, [visible]);

  const handleScan = async () => {
    setScanning(true);
    try {
      const scannedDevices = await bluetoothSensorManager.scanDevices();
      setDevices(scannedDevices);
    } catch (error) {
      Alert.alert("掃描失敗", "無法掃描藍牙設備");
    } finally {
      setScanning(false);
    }
  };

  const handleConnect = async (deviceId: string) => {
    setConnecting(deviceId);
    try {
      const success = await bluetoothSensorManager.connectDevice(deviceId);
      if (success) {
        Alert.alert("連接成功", "感測器已連接");
        // 更新設備列表
        const updated = devices.map((d) => (d.id === deviceId ? { ...d, isConnected: true } : d));
        setDevices(updated);
      } else {
        Alert.alert("連接失敗", "無法連接到感測器");
      }
    } catch (error) {
      Alert.alert("連接失敗", "發生錯誤");
    } finally {
      setConnecting(null);
    }
  };

  const handleDisconnect = async (deviceId: string) => {
    try {
      const success = await bluetoothSensorManager.disconnectDevice(deviceId);
      if (success) {
        // 更新設備列表
        const updated = devices.map((d) => (d.id === deviceId ? { ...d, isConnected: false } : d));
        setDevices(updated);
      }
    } catch (error) {
      Alert.alert("斷開失敗", "發生錯誤");
    }
  };

  const getSensorEmoji = (type: string) => {
    switch (type) {
      case "heart-rate":
        return "❤️";
      case "power-meter":
        return "⚡";
      case "cadence-sensor":
        return "🔄";
      default:
        return "📱";
    }
  };

  const getSensorLabel = (type: string) => {
    switch (type) {
      case "heart-rate":
        return "心率帶";
      case "power-meter":
        return "功率計";
      case "cadence-sensor":
        return "踏頻器";
      default:
        return "感測器";
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)" }}>
        <View
          style={{
            flex: 1,
            backgroundColor: colors.background,
            marginTop: 60,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            overflow: "hidden",
          }}
        >
          {/* 標題欄 */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              paddingHorizontal: 16,
              paddingVertical: 16,
              borderBottomColor: colors.border,
              borderBottomWidth: 1,
            }}
          >
            <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: "bold" }}>
              感測器配對
            </Text>
            <Pressable onPress={onClose} style={{ padding: 8 }}>
              <Text style={{ color: colors.muted, fontSize: 24 }}>✕</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
            {/* 掃描按鈕 */}
            <Pressable
              style={({ pressed }) => [
                {
                  backgroundColor: colors.primary,
                  borderRadius: 12,
                  paddingVertical: 12,
                  opacity: pressed ? 0.8 : 1,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                },
              ]}
              onPress={handleScan}
              disabled={scanning}
            >
              {scanning ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={{ color: "#fff", fontSize: 14, fontWeight: "600" }}>
                  🔍 掃描設備
                </Text>
              )}
            </Pressable>

            {/* 設備列表 */}
            {devices.length === 0 ? (
              <View
                style={{
                  alignItems: "center",
                  justifyContent: "center",
                  paddingVertical: 32,
                  gap: 8,
                }}
              >
                <Text style={{ color: colors.muted, fontSize: 14 }}>未找到設備</Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  請確保藍牙已開啟並靠近設備
                </Text>
              </View>
            ) : (
              <View style={{ gap: 12 }}>
                {devices.map((device) => (
                  <View
                    key={device.id}
                    style={{
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      borderWidth: 1,
                      borderRadius: 12,
                      padding: 12,
                      gap: 12,
                    }}
                  >
                    {/* 設備信息 */}
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                      <Text style={{ fontSize: 24 }}>{getSensorEmoji(device.type)}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "600" }}>
                          {device.name}
                        </Text>
                        <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
                          {getSensorLabel(device.type)}
                        </Text>
                      </View>
                      {device.isConnected && (
                        <View
                          style={{
                            backgroundColor: "rgba(76, 175, 80, 0.2)",
                            paddingHorizontal: 8,
                            paddingVertical: 4,
                            borderRadius: 6,
                          }}
                        >
                          <Text style={{ color: "#4CAF50", fontSize: 11, fontWeight: "600" }}>
                            已連接
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* 電池和信號 */}
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <Text style={{ fontSize: 12 }}>🔋</Text>
                        <Text style={{ color: colors.muted, fontSize: 12 }}>
                          {device.batteryLevel}%
                        </Text>
                      </View>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <Text style={{ fontSize: 12 }}>📡</Text>
                        <Text style={{ color: colors.muted, fontSize: 12 }}>
                          {device.isConnected ? "已連接" : "未連接"}
                        </Text>
                      </View>
                    </View>

                    {/* 連接/斷開按鈕 */}
                    <Pressable
                      style={({ pressed }) => [
                        {
                          backgroundColor: device.isConnected
                            ? "rgba(244, 67, 54, 0.2)"
                            : colors.primary,
                          borderRadius: 8,
                          paddingVertical: 10,
                          opacity: pressed ? 0.8 : 1,
                        },
                      ]}
                      onPress={() => {
                        if (device.isConnected) {
                          handleDisconnect(device.id);
                        } else {
                          handleConnect(device.id);
                        }
                      }}
                      disabled={connecting === device.id}
                    >
                      {connecting === device.id ? (
                        <ActivityIndicator color={colors.primary} size="small" />
                      ) : (
                        <Text
                          style={{
                            color: device.isConnected ? "#F44336" : "#fff",
                            fontSize: 12,
                            fontWeight: "600",
                            textAlign: "center",
                          }}
                        >
                          {device.isConnected ? "斷開連接" : "連接"}
                        </Text>
                      )}
                    </Pressable>
                  </View>
                ))}
              </View>
            )}

            {/* 提示信息 */}
            <View
              style={{
                backgroundColor: "rgba(33, 150, 243, 0.1)",
                borderColor: "rgba(33, 150, 243, 0.3)",
                borderWidth: 1,
                borderRadius: 8,
                padding: 12,
                gap: 8,
              }}
            >
              <Text style={{ color: "#2196F3", fontSize: 12, fontWeight: "600" }}>
                💡 提示
              </Text>
              <Text style={{ color: colors.muted, fontSize: 11, lineHeight: 16 }}>
                • 確保藍牙設備已開啟並處於配對模式{"\n"}
                • 連接後，設備數據將實時顯示在騎乘頁面{"\n"}
                • 長按設備可查看詳細信息
              </Text>
            </View>

            {/* 關閉按鈕 */}
            <Pressable
              style={({ pressed }) => [
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderWidth: 1,
                  borderRadius: 12,
                  paddingVertical: 12,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
              onPress={onClose}
            >
              <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "600", textAlign: "center" }}>
                關閉
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
