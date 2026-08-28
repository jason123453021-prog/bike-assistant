import { Link, Stack } from "expo-router";
import { View, Text, StyleSheet } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { useTranslation } from "react-i18next";

export default function NotFoundScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  return (
    <>
      <Stack.Screen options={{ title: t("audit.notFoundTitle") }} />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>
          {t("audit.notFoundTitle")}
        </Text>
        <Link href="/" style={[styles.link, { color: colors.accent }]}>
          <Text>{t("audit.returnHome")}</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 16 /* internal spacing */,
  },
  link: { fontSize: 16, marginTop: 8 },
});
