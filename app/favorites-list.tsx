import { Redirect } from "expo-router";

/**
 * 舊版最愛路線深層連結相容入口。
 * 已無最愛路線功能或畫面；任何既有網址均無畫面地回到 App 首頁。
 */
export default function LegacyFavoritesRedirect() {
  return <Redirect href="/" />;
}
