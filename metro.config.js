const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// 沙箱會同時維持 TypeScript 監看與 Web 預覽；限制 Metro 同時轉譯數，
// 讓 Android Expo Go Bundle 在資源有限時優先穩定完成而非遭 OOM 終止。
config.maxWorkers = 1;

module.exports = withNativeWind(config, {
  input: "./global.css",
  // Force write CSS to file system instead of virtual modules
  // This fixes iOS styling issues in development mode
  forceWriteFileSystem: true,
});
