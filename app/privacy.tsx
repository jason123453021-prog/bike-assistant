import React from "react";
import { ScrollView, Text, View, StyleSheet, Pressable } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/use-colors";

export default function PrivacyPolicyScreen() {
  const colors = useColors();
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
          <Text style={[styles.backText, { color: colors.primary }]}>← 返回</Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>隱私政策</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* 標題區 */}
        <Text style={[styles.title, { color: colors.foreground }]}>智慧單車騎乘助手</Text>
        <Text style={[styles.subtitle, { color: colors.foreground }]}>隱私政策</Text>
        <Text style={[styles.updated, { color: colors.muted }]}>最後更新日期：2026 年 6 月 19 日</Text>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <Section title="1. 前言" color={colors.foreground} mutedColor={colors.muted}>
          {`歡迎使用智慧單車騎乘助手（以下簡稱「本應用程式」或「我們」）。本隱私政策說明我們如何收集、使用、儲存及保護您的個人資料。使用本應用程式即表示您同意本政策所述之資料處理方式。\n\n本應用程式主要面向台灣及香港市場的自行車騎乘愛好者。`}
        </Section>

        <Section title="2. 我們收集的資料" color={colors.foreground} mutedColor={colors.muted}>
          {`我們收集以下類型的資料：\n\n【位置資料】\n• 精確 GPS 位置（緯度、經度、海拔）\n• 移動速度與方向\n• 騎乘路線軌跡\n\n收集目的：提供即時導航、路線追蹤、好友位置共享及偏離路線提示功能。\n\n【帳號資料】\n• 電子郵件地址\n• 顯示名稱\n• 登入方式（OAuth）\n\n收集目的：識別使用者身份、提供好友系統及跨裝置資料同步。\n\n【裝置資料】\n• 裝置電池電量（僅在啟用位置共享時）\n\n收集目的：顯示給好友以利安全確認。\n\n【健康與活動資料】\n• 體重、身高（使用者自行輸入）\n• 騎乘距離、時間、速度、功率估算值\n• 估算消耗卡路里\n\n收集目的：計算騎乘功率、卡路里消耗及補給提醒。此類資料僅儲存於您的裝置本地，不會上傳至伺服器。`}
        </Section>

        <Section title="3. 資料的使用方式" color={colors.foreground} mutedColor={colors.muted}>
          {`我們使用您的資料以：\n\n• 提供 GPS 導航與路線追蹤服務\n• 計算騎乘數據（速度、功率、卡路里）\n• 在您授權的情況下，與好友共享即時位置\n• 發送補給提醒及騎乘通知\n• 儲存騎乘記錄供您日後查閱\n• 改善應用程式功能與使用者體驗`}
        </Section>

        <Section title="4. 資料的儲存與保留" color={colors.foreground} mutedColor={colors.muted}>
          {`【本地儲存】\n騎乘記錄、個人設定（體重、身高、偏好設定）儲存於您的裝置本地（AsyncStorage），不會自動上傳至伺服器。\n\n【伺服器儲存】\n帳號資料及即時位置共享資料儲存於我們的安全伺服器（TiDB Cloud，位於亞太地區）。\n\n【保留期限】\n• 即時位置資料：5 分鐘未更新後自動標記為離線，不再顯示給好友\n• 帳號資料：保留至您主動刪除帳號為止\n• 騎乘記錄：本地儲存，您可隨時手動刪除\n\n所有伺服器通訊均使用 HTTPS 加密傳輸。`}
        </Section>

        <Section title="5. 資料的分享" color={colors.foreground} mutedColor={colors.muted}>
          {`我們不會將您的個人資料出售給第三方。以下情況可能涉及資料分享：\n\n【好友位置共享】\n當您啟用「分享位置給好友」功能時，您的即時位置、速度及電量資訊將對您的好友可見。您可隨時在設定頁面關閉此功能，或開啟「隱身模式」暫停分享。\n\n【第三方服務】\n• Open-Meteo（天氣資料）：傳送您的 GPS 座標以取得當地天氣，Open-Meteo 為免費開源服務，不儲存個人識別資訊\n• OSRM（路線計算）：傳送 GPS 座標以計算偏離路線的回歸路徑，不儲存個人識別資訊\n• OpenStreetMap（地圖底圖）：地圖顯示服務，不傳送個人資料\n\n【法律要求】\n若依法律要求，我們可能需要揭露您的資料。`}
        </Section>

        <Section title="6. 您的權利" color={colors.foreground} mutedColor={colors.muted}>
          {`您對您的個人資料擁有以下權利：\n\n• 查閱權：您可在應用程式內查看您的帳號資料\n• 更正權：您可在設定頁面修改個人資料\n• 刪除權：您可在設定頁面「帳號與好友」區塊選擇「刪除帳號」，這將永久刪除您的帳號資料及伺服器上的相關記錄\n• 資料可攜性：騎乘記錄可透過應用程式的分享功能匯出\n• 撤回同意：您可隨時在裝置設定中撤銷位置權限，或在應用程式設定中關閉位置共享`}
        </Section>

        <Section title="7. 兒童隱私" color={colors.foreground} mutedColor={colors.muted}>
          {`本應用程式不針對 13 歲以下兒童設計，我們不會故意收集兒童的個人資料。若您發現有兒童使用本應用程式，請聯絡我們。`}
        </Section>

        <Section title="8. 位置權限說明" color={colors.foreground} mutedColor={colors.muted}>
          {`本應用程式需要以下位置相關權限：\n\n• ACCESS_FINE_LOCATION（精確位置）：提供準確的 GPS 導航與速度計算\n• ACCESS_COARSE_LOCATION（概略位置）：作為精確位置的備用\n• ACCESS_BACKGROUND_LOCATION（背景位置）：騎乘中螢幕關閉時持續追蹤路線，並更新前台通知欄的速度與距離資訊\n• FOREGROUND_SERVICE（前台服務）：顯示騎乘中的持續通知，確保 GPS 追蹤不被系統中斷\n\n背景位置僅在您主動開始騎乘後才會啟用，您可隨時暫停或停止騎乘以終止背景追蹤。`}
        </Section>

        <Section title="9. 通知權限說明" color={colors.foreground} mutedColor={colors.muted}>
          {`• POST_NOTIFICATIONS（推播通知）：用於顯示騎乘中的速度、距離、時間資訊，以及補給提醒通知\n\n您可在裝置設定中管理通知權限。`}
        </Section>

        <Section title="10. 資料安全" color={colors.foreground} mutedColor={colors.muted}>
          {`我們採取以下措施保護您的資料：\n\n• 所有網路傳輸使用 HTTPS/TLS 加密\n• 伺服器資料庫採用 TiDB Cloud 託管，具備業界標準安全防護\n• 使用者認證採用 OAuth 2.0 標準，我們不儲存您的密碼\n• 位置資料僅在必要時傳輸，不建立長期歷史軌跡資料庫`}
        </Section>

        <Section title="11. 政策變更" color={colors.foreground} mutedColor={colors.muted}>
          {`我們可能不定期更新本隱私政策。重大變更時，我們將透過應用程式通知您。繼續使用本應用程式即表示您接受更新後的政策。`}
        </Section>

        <Section title="12. 聯絡我們" color={colors.foreground} mutedColor={colors.muted}>
          {`若您對本隱私政策有任何疑問，或需要行使您的資料權利，請透過 Google Play 商店的開發者聯絡功能與我們聯繫。\n\n本政策適用於智慧單車騎乘助手 Android 應用程式的所有版本。`}
        </Section>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <Text style={[styles.footer, { color: colors.muted }]}>
          © 2026 智慧單車騎乘助手。保留所有權利。
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
      <Text style={[styles.sectionBody, { color: mutedColor }]}>{children}</Text>
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
