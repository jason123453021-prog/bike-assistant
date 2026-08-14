import React, { useMemo, useState } from "react";
import { View, Text, Modal, Pressable, ScrollView, Share, Alert, Platform } from "react-native";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";
import { WebView } from "react-native-webview";
import { useColors } from "@/hooks/use-colors";
import { RideRecord } from "@/lib/ride-context";
import { generateShareCard, generateShareText, calculateRideLevel } from "@/lib/garmin-card-generator";
import { createRideShareCardFilename, createRideShareCardSvg } from "@/lib/ride-share-card-svg";

export interface ShareCardModalProps {
  visible: boolean;
  ride: RideRecord | null;
  onClose: () => void;
}

export function ShareCardModal({ visible, ride, onClose }: ShareCardModalProps) {
  const colors = useColors();
  const [isPreparingImage, setIsPreparingImage] = useState(false);

  const shareCard = useMemo(() => {
    if (!ride) return null;
    return generateShareCard(ride);
  }, [ride]);

  const shareCardSvg = useMemo(() => (ride ? createRideShareCardSvg(ride) : ""), [ride]);

  const imageRendererHtml = useMemo(() => {
    if (!shareCardSvg) return "";
    const encodedSvg = encodeURIComponent(shareCardSvg);
    return `<!doctype html><html><body style="margin:0;background:transparent"><canvas id="card"></canvas><script>
      const svg = "data:image/svg+xml;charset=utf-8,${encodedSvg}";
      const image = new Image();
      image.onload = function () {
        const canvas = document.getElementById("card");
        canvas.width = image.naturalWidth || 1080;
        canvas.height = image.naturalHeight || 1920;
        const context = canvas.getContext("2d");
        context.drawImage(image, 0, 0);
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: "shareCardPng", base64: canvas.toDataURL("image/png").split(",")[1] }));
      };
      image.onerror = function () { window.ReactNativeWebView.postMessage(JSON.stringify({ type: "shareCardError" })); };
      image.src = svg;
    </script></body></html>`;
  }, [shareCardSvg]);

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
    } catch {
      Alert.alert("分享失敗", "無法分享騎乘記錄");
    }
  };

  const handleShareImage = async () => {
    if (!ride) return;
    if (Platform.OS === "web") {
      Alert.alert("此平台不支援", "本機圖像分享需在 Android 或 iOS 裝置上使用。");
      return;
    }

    setIsPreparingImage(true);
  };

  const handleImageRendererMessage = async (event: { nativeEvent: { data: string } }) => {
    if (!ride || !isPreparingImage) return;
    try {
      const message = JSON.parse(event.nativeEvent.data);
      if (message.type === "shareCardError" || !message.base64) throw new Error("IMAGE_RENDER_FAILED");
      if (!FileSystem.cacheDirectory) throw new Error("NO_CACHE_DIRECTORY");
      if (!(await Sharing.isAvailableAsync())) throw new Error("SHARING_UNAVAILABLE");

      const filename = createRideShareCardFilename(ride).replace(/\.svg$/, ".png");
      const directory = `${FileSystem.cacheDirectory}ride-share-cards`;
      const uri = `${directory}/${filename}`;
      await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
      await FileSystem.writeAsStringAsync(uri, message.base64, { encoding: FileSystem.EncodingType.Base64 });
      await Sharing.shareAsync(uri, {
        dialogTitle: "分享騎乘長圖",
        mimeType: "image/png",
        UTI: "public.png",
      });
    } catch {
      Alert.alert("產生分享長圖失敗", "無法建立本機分享圖片，請稍後再試。");
    } finally {
      setIsPreparingImage(false);
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
            {isPreparingImage && imageRendererHtml ? (
              <WebView
                source={{ html: imageRendererHtml }}
                onMessage={handleImageRendererMessage}
                style={{ position: "absolute", width: 1, height: 1, opacity: 0 }}
                javaScriptEnabled
                originWhitelist={["*"]}
              />
            ) : null}
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
                    <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 12, fontWeight: "600", marginBottom: 8 /* internal spacing */ }}>進階數據</Text>
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

              {/* 主要分享：完整騎乘長圖 */}
              <Pressable
                style={({ pressed }) => [
                  {
                    backgroundColor: "#00B96B",
                    borderRadius: 12,
                    padding: 14,
                    opacity: pressed || isPreparingImage ? 0.8 : 1,
                  },
                ]}
                disabled={isPreparingImage}
                onPress={handleShareImage}
              >
                <Text style={{ color: "#fff", fontSize: 14, fontWeight: "800", textAlign: "center" }}>
                  {isPreparingImage ? "正在產生分享長圖…" : "分享完整騎乘長圖"}
                </Text>
                <Text style={{ color: "rgba(255,255,255,0.78)", fontSize: 11, textAlign: "center", marginTop: 4 }}>
                  包含路線概覽、活動名稱、個人最佳與核心成績
                </Text>
              </Pressable>

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
                <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: "600", marginBottom: 8 /* internal spacing */ }}>
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

              {/* 建立可分享圖檔 */}
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
                disabled={isPreparingImage}
                onPress={handleShareImage}
              >
                <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: "600" }}>
                  🖼️ 產生並分享圖片檔
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
