import { Link, Stack } from "expo-router";
import { View, Text, StyleSheet } from "react-native";
import { useColors } from "@/hooks/use-colors";

export default function NotFoundScreen() {
  const colors = useColors();
  return (
    <>
      <Stack.Screen options={{ title: "找不到頁面" }} />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>找不到此頁面</Text>
        <Link href="/" style={[styles.link, { color: colors.accent }]}>
          <Text>返回首頁</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },
  title: { fontSize: 20, fontWeight: "bold", marginBottom: 16 },
  link: { fontSize: 16, marginTop: 8 },
});
