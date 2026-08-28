const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);
const shouldWriteNativeWindCache = process.env.NODE_ENV !== "production" && process.env.CI !== "true";

// 沙箱會同時維持 TypeScript 監看與 Web 預覽；限制 Metro 同時轉譯數，
// 讓 Android Expo Go Bundle 在資源有限時優先穩定完成而非遭 OOM 終止。
config.maxWorkers = 1;

module.exports = withNativeWind(config, {
  input: "./global.css",
  // 開發期沿用檔案快取以支援 Metro 熱更新；正式匯出改用虛擬 CSS 模組。
  // 後者不會在 node_modules/.cache 寫入暫存檔，因此可避開雲端 Docker
  // 建置時 Metro 無法追蹤該檔案 SHA-1 而中止 Web export 的問題。
  forceWriteFileSystem: shouldWriteNativeWindCache,
});
