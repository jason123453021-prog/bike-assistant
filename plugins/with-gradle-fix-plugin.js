const { withAppBuildGradle } = require("@expo/config-plugins");

/**
 * Config Plugin: with-gradle-fix-plugin
 * 
 * 功能：
 * 1. 移除無效的 enableBundleCompression 屬性（React Native 0.76.3 不支持）
 * 2. 修復 Gradle 解析失敗
 */
module.exports = function withGradleFixPlugin(config) {
  return withAppBuildGradle(config, async (config) => {
    let contents = config.modResults.contents;

    // 移除 enableBundleCompression 屬性
    // 匹配模式：enableBundleCompression = true 或 enableBundleCompression = false
    // 支持多種格式：enableBundleCompression=true, enableBundleCompression = true 等
    contents = contents.replace(
      /\s*enableBundleCompression\s*=\s*(true|false)\s*\n?/g,
      ""
    );

    // 清理多餘的空行
    contents = contents.replace(/\n\s*\n\s*\n/g, "\n\n");

    config.modResults.contents = contents;
    return config;
  });
};
