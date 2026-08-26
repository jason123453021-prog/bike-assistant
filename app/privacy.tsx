import React from "react";
import { ScrollView, Text, View, StyleSheet, Pressable } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/use-colors";
import { useTranslation } from "react-i18next";

export default function PrivacyPolicyScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* 頂部導覽列 */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 12,
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
        >
          <Text style={[styles.backText, { color: colors.primary }]}>
            ← {t("audit.back")}
          </Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          {t("audit.privacyPolicy")}
        </Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* 標題區 */}
        <Text style={[styles.title, { color: colors.foreground }]}>
          {t("appName")}
        </Text>
        <Text style={[styles.subtitle, { color: colors.foreground }]}>
          {t("audit.privacyPolicy")}
        </Text>
        <Text style={[styles.updated, { color: colors.muted }]}>
          {t("audit.privacyUpdated")}
        </Text>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <Section
          title="1. 前言"
          color={colors.foreground}
          mutedColor={colors.muted}
        >
          {`智慧單車騎乘助手採 Local-First 設計。本政策說明 App 在您的裝置上處理、保存與刪除資料的方式。App 不提供帳號、社群、好友、雲端同步或遠端推播服務。`}
        </Section>

        <Section
          title="2. 我們收集的資料"
          color={colors.foreground}
          mutedColor={colors.muted}
        >
          {`App 僅在裝置上處理下列資料：\n\n【位置與路線資料】\n• GPS 位置、海拔、速度與行進方向\n• 騎乘軌跡與已匯入的 GPX 路線\n\n用途：目前位置顯示、離線騎乘紀錄、背景追蹤、路線預覽與導航。\n\n【個人與活動資料】\n• 生日、身高、體重及本機推定的生理指標\n• 騎乘時間、距離、爬升、功率、卡路里與補給估算\n• 使用者主動附加的相片、影片與活動備註\n\n用途：產生本機活動分析、補給提醒與個人化估算。App 不建立帳號，也不收集電子郵件、聯絡人或好友資料。`}
        </Section>

        <Section
          title="3. 資料的使用方式"
          color={colors.foreground}
          mutedColor={colors.muted}
        >
          {`資料僅用於裝置內的 GPS 導航、騎乘紀錄、功率與消耗估算、補給提醒、活動分析及 GPX 匯出。騎乘中的通知為本機通知，不會註冊或接收遠端推播。`}
        </Section>

        <Section
          title="4. 資料的儲存與保留"
          color={colors.foreground}
          mutedColor={colors.muted}
        >
          {`騎乘紀錄、GPX 檔案、設定、媒體與崩潰恢復快照皆儲存於您的裝置。資料會保留至您在 App 內刪除活動、清除快取或解除安裝 App 為止。App 不會自動上傳或跨裝置同步這些資料。`}
        </Section>

        <Section
          title="5. 資料的分享"
          color={colors.foreground}
          mutedColor={colors.muted}
        >
          {`App 沒有好友位置共享、社群功能或雲端資料庫。您可透過 Android 系統分享功能主動匯出 GPX、活動卡片或媒體；分享對象與內容完全由您決定。\n\n若您主動在有網路時使用線上路徑或天氣資訊，App 可能會將路徑計算所需的座標傳送至公開地圖或路徑服務。這些服務不是帳號、追蹤或同步機制；離線功能不依賴它們。`}
        </Section>

        <Section
          title="6. 您的權利"
          color={colors.foreground}
          mutedColor={colors.muted}
        >
          {`您可直接在 App 內編輯個人資料、刪除活動與媒體，並以 GPX 或活動分享卡匯出自己的資料。您也可以隨時在裝置設定中撤銷位置、通知、相片或媒體權限。由於 App 不保存帳號或雲端副本，沒有帳號刪除或伺服器資料刪除程序。`}
        </Section>

        <Section
          title="7. 兒童隱私"
          color={colors.foreground}
          mutedColor={colors.muted}
        >
          {`本應用程式不針對 13 歲以下兒童設計，我們不會故意收集兒童的個人資料。若您發現有兒童使用本應用程式，請聯絡我們。`}
        </Section>

        <Section
          title="8. 位置權限說明"
          color={colors.foreground}
          mutedColor={colors.muted}
        >
          {`本應用程式需要以下位置相關權限：\n\n• ACCESS_FINE_LOCATION（精確位置）：提供準確的 GPS 導航與速度計算\n• ACCESS_COARSE_LOCATION（概略位置）：作為精確位置的備用\n• ACCESS_BACKGROUND_LOCATION（背景位置）：騎乘中螢幕關閉時持續追蹤路線，並更新前台通知欄的速度與距離資訊\n• FOREGROUND_SERVICE（前台服務）：顯示騎乘中的持續通知，確保 GPS 追蹤不被系統中斷\n\n背景位置僅在您主動開始騎乘後才會啟用，您可隨時暫停或停止騎乘以終止背景追蹤。`}
        </Section>

        <Section
          title="9. 通知權限說明"
          color={colors.foreground}
          mutedColor={colors.muted}
        >
          {`• POST_NOTIFICATIONS（推播通知）：用於顯示騎乘中的速度、距離、時間資訊，以及補給提醒通知\n\n您可在裝置設定中管理通知權限。`}
        </Section>

        <Section
          title="10. 資料安全"
          color={colors.foreground}
          mutedColor={colors.muted}
        >
          {`App 將資料保存於裝置的應用程式私有儲存空間，並只在您授權後讀取定位、相片或檔案。為保護資料，請為裝置設定螢幕鎖定，並在分享活動、媒體或 GPX 前確認分享內容。`}
        </Section>

        <Section
          title="11. 政策變更"
          color={colors.foreground}
          mutedColor={colors.muted}
        >
          {`我們可能不定期更新本隱私政策。重大變更時，我們將透過應用程式通知您。繼續使用本應用程式即表示您接受更新後的政策。`}
        </Section>

        <Section
          title="12. 聯絡我們"
          color={colors.foreground}
          mutedColor={colors.muted}
        >
          {`若您對本隱私政策有任何疑問，或需要行使您的資料權利，請透過 Google Play 商店的開發者聯絡功能與我們聯繫。\n\n本政策適用於智慧單車騎乘助手 Android 應用程式的所有版本。`}
        </Section>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <Text style={[styles.footer, { color: colors.muted }]}>
          {t("audit.privacyCopyright")}
        </Text>
      </ScrollView>
    </View>
  );
}

function Section({
  title,
  children,
  color,
  mutedColor,
}: {
  title: string;
  children: string;
  color: string;
  mutedColor: string;
}) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color }]}>{title}</Text>
      <Text style={[styles.sectionBody, { color: mutedColor }]}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 60,
  },
  backText: {
    fontSize: 16,
    fontWeight: "500",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "600",
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 4,
  },
  updated: {
    fontSize: 13,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 4,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 20,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 8,
  },
  sectionBody: {
    fontSize: 14,
    lineHeight: 22,
  },
  footer: {
    fontSize: 12,
    textAlign: "center",
    marginTop: 8,
  },
});
