const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const config = getDefaultConfig(__dirname);

// 確保 Metro 轉譯 react-native-maps 的 TypeScript/JSX 原始碼
// 修復 SyntaxError: Unexpected token '<' 閃退問題
const reactNativeMapsPath = path.resolve(
  __dirname,
  "node_modules/react-native-maps"
);

config.watchFolders = [
  ...(config.watchFolders || []),
  reactNativeMapsPath,
];

// 強制 Metro 轉譯 react-native-maps（包含 TypeScript 與 JSX）
config.transformer = config.transformer || {};
config.transformer.unstable_allowRequireContext = true;

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
