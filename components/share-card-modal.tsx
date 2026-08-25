import React, { useMemo, useState } from "react";
import { View, Text, Modal, Pressable, ScrollView, Share, Alert, Platform } from "react-native";
import * as Sharing from "expo-sharing";
import * as Clipboard from "expo-clipboard";
import * as FileSystem from "expo-file-system/legacy";
import { WebView } from "react-native-webview";
import { useColors } from "@/hooks/use-colors";
import { RideRecord } from "@/lib/ride-context";
import { generateShareCard, generateShareText } from "@/lib/garmin-card-generator";
import { createRideShareCardFilename, createRideShareCardSvg } from "@/lib/ride-share-card-svg";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/lib/i18n/language-provider";

export interface ShareCardModalProps {
  visible: boolean;
  ride: RideRecord | null;
  onClose: () => void;
}

export function ShareCardModal({ visible, ride, onClose }: ShareCardModalProps) {
  const colors = useColors();
  const { t } = useTranslation();
  const { activeLanguage } = useLanguage();
  const [isPreparingImage, setIsPreparingImage] = useState(false);

  const shareCard = useMemo(() => {
    if (!ride) return null;
    return generateShareCard(ride, { locale: activeLanguage, t });
  }, [activeLanguage, ride, t]);

  const shareCardSvg = useMemo(() => (ride ? createRideShareCardSvg(ride, { locale: activeLanguage, t }) : ""), [activeLanguage, ride, t]);

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

  const shareCardPreviewHtml = useMemo(() => {
    if (!shareCardSvg) return "";
    return `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1"><style>html,body{margin:0;padding:0;background:#0A1118;overflow:hidden}svg{display:block;width:100%;height:auto}</style></head><body>${shareCardSvg}</body></html>`;
  }, [shareCardSvg]);

  const shareText = useMemo(() => {
    if (!shareCard) return "";
    return generateShareText(shareCard, t);
  }, [shareCard, t]);

  const handleShare = async () => {
    if (!shareText) return;

    try {
      await Share.share({
        message: shareText,
        title: t("share.title"),
      });
    } catch {
      Alert.alert(t("share.shareFailed"), t("share.shareFailed"));
    }
  };

  const handleCopyShareText = async () => {
    if (!shareText) return;

    try {
      await Clipboard.setStringAsync(shareText);
      Alert.alert(t("share.copied"), t("share.copySuccess"));
    } catch {
      Alert.alert(t("share.copyFailed"), t("share.copyFailed"));
    }
  };

  const handleShareImage = async () => {
    if (!ride) return;
    if (Platform.OS === "web") {
      Alert.alert(t("share.unsupported"), t("share.imageNativeOnly"));
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
          dialogTitle: t("share.shareImage"),
        mimeType: "image/png",
        UTI: "public.png",
      });
    } catch {
      Alert.alert(t("share.imageFailed"), t("share.imageFailed"));
    } finally {
      setIsPreparingImage(false);
    }
  };

  if (!ride || !shareCard) return null;

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
              {t("share.title")}
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
            {/* 預覽與實際匯出的 PNG 使用同一張 SVG，避免資料或版面不一致。 */}
            <View style={{ width: "100%", aspectRatio: 1080 / 1920, borderRadius: 16, overflow: "hidden", backgroundColor: "#0A1118" }}>
              {shareCardPreviewHtml ? (
                <WebView
                  source={{ html: shareCardPreviewHtml }}
                  style={{ flex: 1, backgroundColor: "#0A1118" }}
                  scrollEnabled={false}
                  originWhitelist={["*"]}
                />
              ) : null}
            </View>

            {/* 分享選項 */}
            <View style={{ gap: 12 }}>
              <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "600" }}>
                {t("share.methods")}
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
                  {isPreparingImage ? t("share.preparingImage") : t("share.shareImage")}
                </Text>
                <Text style={{ color: "rgba(255,255,255,0.78)", fontSize: 11, textAlign: "center", marginTop: 4 }}>
                  {t("share.imageDescription")}
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
                  📱 {t("share.shareSocial")}
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
                onPress={() => { void handleCopyShareText(); }}
              >
                <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: "600" }}>
                  📋 {t("share.copyText")}
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
                  🖼️ {t("share.createImage")}
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
              <Text style={{ color: colors.onAccent, fontSize: 14, fontWeight: "600", textAlign: "center" }}>
                {t("common.close")}
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
