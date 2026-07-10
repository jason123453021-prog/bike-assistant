import { Redirect } from "expo-router";

/**
 * 導航頁為主要入口，直接重定向至 map 頁面
 */
export default function IndexScreen() {
  return <Redirect href="/(tabs)/map" />;
}
