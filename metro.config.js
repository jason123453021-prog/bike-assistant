const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// 沙箱會同時維持 TypeScript 監看與 Web 預覽；限制 Metro 同時轉譯數，
// 讓 Android Expo Go Bundle 在資源有限時優先穩定完成而非遭 OOM 終止。
config.maxWorkers = 1;

// 讓 web 平台排除 react-native-maps（native-only 套件）
// Metro 會在 web bundle 時將其替換為空模組
config.resolver = config.resolver || {};
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    platform === "web" &&
    (moduleName === "react-native-maps" ||
      moduleName.startsWith("react-native-maps/"))
  ) {
    return {
      type: "empty",
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, {
  input: "./global.css",
  // Force write CSS to file system instead of virtual modules
  // This fixes iOS styling issues in development mode
  forceWriteFileSystem: true,
});
