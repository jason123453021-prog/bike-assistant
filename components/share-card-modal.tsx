import React, { useMemo } from "react";
import { View, Text, Modal, Pressable, ScrollView, Share, Alert } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { RideRecord } from "@/lib/ride-context";
import { generateShareCard, generateShareText, calculateRideLevel } from "@/lib/garmin-card-generator";

export interface ShareCardModalProps {
  visible: boolean;
  ride: RideRecord | null;
  onClose: () => void;
}

export function ShareCardModal({ visible, ride, onClose }: ShareCardModalProps) {
  const colors = useColors();

  const shareCard = useMemo(() => {
    if (!ride) return null;
    return generateShareCard(ride);
  }, [ride]);

  const shareText = useMemo(() => {
    if (!shareCard) return "";
    return generateShareText(shareCard);
  }, [shareCard]);

  const rideLevel = useMemo(() => {
    if (!ride) return "";
    return calculateRideLevel(ride.distance / 1000, ride.totalAscent, ride.avgSpeed);
  }, [ride]);

  const handleShare = async () => {
    if (!shareText) return;

    try {
      await Share.share({
        message: shareText,
        title: "分享騎乘記錄",
      });
    } catch (error) {
      Alert.alert("分享失敗", "無法分享騎乘記錄");
    }
  };

  if (!ride || !shareCard) return null;

  const durationMin = Math.floor(ride.duration / 60);
  const durationSec = ride.duration % 60;

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
              分享卡片
            </Text>
            <Pressable onPress={onClose} style={{ padding: 8 }}>
              <Text style={{ color: colors.muted, fontSize: 24 }}>✕</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
            {/* 卡片預覽 */}
            <View
              style={{
                backgroundColor: "#667eea",
                borderRadius: 16,
                padding: 24,
                alignItems: "center",
                gap: 16,
              }}
            >
              {/* Emoji */}
              <Text style={{ fontSize: 48 }}>{shareCard.emoji}</Text>

              {/* 路線名稱 */}
              <Text
                style={{
                  color: "#fff",
                  fontSize: 24,
                  fontWeight: "bold",
                  textAlign: "center",
                }}
              >
                {shareCard.routeName}
              </Text>

              {/* 日期 */}
              <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 12 }}>
                {shareCard.date}
              </Text>

              {/* 統計資訊 */}
              <View
                style={{
                  width: "100%",
                  backgroundColor: "rgba(255,255,255,0.1)",
                  borderRadius: 12,
                  padding: 16,
                  gap: 12,
                }}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-around" }}>
                  <View style={{ alignItems: "center" }}>
                    <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 11 }}>距離</Text>
                    <Text style={{ color: "#fff", fontSize: 20, fontWeight: "bold", marginTop: 4 }}>
                      {shareCard.distance}
                    </Text>
                    <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 10 }}>km</Text>
                  </View>
                  <View style={{ alignItems: "center" }}>
                    <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 11 }}>時間</Text>
                    <Text style={{ color: "#fff", fontSize: 20, fontWeight: "bold", marginTop: 4 }}>
                      {durationMin}:{String(durationSec).padStart(2, "0")}
                    </Text>
                    <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 10 }}>m:s</Text>
                  </View>
                  <View style={{ alignItems: "center" }}>
                    <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 11 }}>速度</Text>
                    <Text style={{ color: "#fff", fontSize: 20, fontWeight: "bold", marginTop: 4 }}>
                      {shareCard.avgSpeed}
                    </Text>
                    <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 10 }}>km/h</Text>
                  </View>
                </View>

                <View style={{ flexDirection: "row", justifyContent: "space-around" }}>
                  <View style={{ alignItems: "center" }}>
                    <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 11 }}>爬升</Text>
                    <Text style={{ color: "#fff", fontSize: 20, fontWeight: "bold", marginTop: 4 }}>
                      {shareCard.elevation}
                    </Text>
                    <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 10 }}>m</Text>
                  </View>
                  <View style={{ alignItems: "center" }}>
                    <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 11 }}>最高速度</Text>
                    <Text style={{ color: "#fff", fontSize: 20, fontWeight: "bold", marginTop: 4 }}>
                      {shareCard.maxSpeed}
                    </Text>
                    <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 10 }}>km/h</Text>
                  </View>
                  <View style={{ alignItems: "center" }}>
                    <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 11 }}>卡路里</Text>
                    <Text style={{ color: "#fff", fontSize: 20, fontWeight: "bold", marginTop: 4 }}>
                      {shareCard.calories}
                    </Text>
                    <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 10 }}>kcal</Text>
                  </View>
                </View>

                {/* 進階訓練數據 */}
                {(shareCard.avgHeartRate || shareCard.avgPower || shareCard.avgCadence) && (
                  <View style={{ borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.2)", paddingTop: 12 }}>
                    <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 12, fontWeight: "600", marginBottom: 8 }}>進階數據</Text>
                    <View style={{ flexDirection: "row", justifyContent: "space-around" }}>
                      {shareCard.avgHeartRate && (
                        <View style={{ alignItems: "center" }}>
                          <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 11 }}>平均心率</Text>
                          <Text style={{ color: "#fff", fontSize: 16, fontWeight: "bold", marginTop: 2 }}>
                            {Math.round(shareCard.avgHeartRate)}
                          </Text>
                          <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 10 }}>bpm</Text>
                        </View>
                      )}
                      {shareCard.avgPower && (
                        <View style={{ alignItems: "center" }}>
                          <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 11 }}>平均功率</Text>
                          <Text style={{ color: "#fff", fontSize: 16, fontWeight: "bold", marginTop: 2 }}>
                            {Math.round(shareCard.avgPower)}
                          </Text>
                          <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 10 }}>W</Text>
                        </View>
                      )}
                      {shareCard.avgCadence && (
                        <View style={{ alignItems: "center" }}>
                          <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 11 }}>平均踏頻</Text>
                          <Text style={{ color: "#fff", fontSize: 16, fontWeight: "bold", marginTop: 2 }}>
                            {Math.round(shareCard.avgCadence)}
                          </Text>
                          <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 10 }}>rpm</Text>
                        </View>
                      )}
                    </View>
                  </View>
                )}
              </View>

              {/* 騎乘等級 */}
              <Text style={{ color: "rgba(255,255,255,0.9)", fontSize: 14, fontWeight: "600" }}>
                {rideLevel}
              </Text>
            </View>

            {/* 分享選項 */}
            <View style={{ gap: 12 }}>
              <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "600" }}>
                分享方式
              </Text>

              {/* 分享文字 */}
              <Pressable
                style={({ pressed }) => [
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderWidth: 1,
                    borderRadius: 12,
                    padding: 12,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
                onPress={handleShare}
              >
                <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: "600", marginBottom: 8 }}>
                  📱 分享至社群
                </Text>
                <Text
                  style={{
                    color: colors.muted,
                    fontSize: 11,
                    lineHeight: 16,
                  }}
                  numberOfLines={3}
                >
                  {shareText.split("\n").slice(0, 3).join("\n")}...
                </Text>
              </Pressable>

              {/* 複製文字 */}
              <Pressable
                style={({ pressed }) => [
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderWidth: 1,
                    borderRadius: 12,
                    padding: 12,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
                onPress={() => {
                  // TODO: 實現複製功能
                  Alert.alert("已複製", "分享文字已複製到剪貼板");
                }}
              >
                <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: "600" }}>
                  📋 複製分享文字
                </Text>
              </Pressable>

              {/* 下載卡片 */}
              <Pressable
                style={({ pressed }) => [
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderWidth: 1,
                    borderRadius: 12,
                    padding: 12,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
                onPress={() => {
                  // TODO: 實現下載功能
                  Alert.alert("下載", "卡片已保存到相機膠捲");
                }}
              >
                <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: "600" }}>
                  💾 下載卡片圖片
                </Text>
              </Pressable>
            </View>

            {/* 關閉按鈕 */}
            <Pressable
              style={({ pressed }) => [
                {
                  backgroundColor: colors.primary,
                  borderRadius: 12,
                  paddingVertical: 12,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
              onPress={onClose}
            >
              <Text style={{ color: "#fff", fontSize: 14, fontWeight: "600", textAlign: "center" }}>
                關閉
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
