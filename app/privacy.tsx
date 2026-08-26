import React from "react";
import { ScrollView, Text, View, StyleSheet, Pressable } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/use-colors";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/lib/i18n/language-provider";

const PRIVACY_SECTION_KEYS = [
  "introduction",
  "collection",
  "use",
  "storage",
  "sharing",
  "rights",
  "children",
  "locationPermissions",
  "notificationPermissions",
  "security",
  "changes",
  "contact",
] as const;

export default function PrivacyPolicyScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
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
          <Text
            style={[
              styles.backText,
              { color: colors.primary, textAlign: isRTL ? "right" : "left" },
            ]}
          >
            {isRTL ? "→" : "←"} {t("audit.back")}
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

        {PRIVACY_SECTION_KEYS.map((sectionKey) => (
          <Section
            key={sectionKey}
            title={t(`privacy.sections.${sectionKey}.title`)}
            body={t(`privacy.sections.${sectionKey}.body`)}
            color={colors.foreground}
            mutedColor={colors.muted}
            isRtl={isRTL}
          />
        ))}

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
  body,
  color,
  mutedColor,
  isRtl,
}: {
  title: string;
  body: string;
  color: string;
  mutedColor: string;
  isRtl: boolean;
}) {
  return (
    <View style={styles.section}>
      <Text
        style={[
          styles.sectionTitle,
          { color, textAlign: isRtl ? "right" : "left" },
        ]}
      >
        {title}
      </Text>
      <Text
        style={[
          styles.sectionBody,
          { color: mutedColor, textAlign: isRtl ? "right" : "left" },
        ]}
      >
        {body}
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
