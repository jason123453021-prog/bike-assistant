const { withGradleProperties } = require("@expo/config-plugins");

/**
 * Config Plugin: with-gradle-fix-plugin
 * 
 * 功能：
 * 1. 移除無效的 enableBundleCompression 屬性（React Native 0.76.3 不支持）
 * 2. 修復 Gradle 解析失敗
 */
module.exports = function withGradleFixPlugin(config) {
  return withGradleProperties(config, async (config) => {
    // gradle.properties 中移除 enableBundleCompression
    const properties = config.modResults;
    
    // 過濾掉 enableBundleCompression 相關的屬性
    const filtered = properties.filter((prop) => {
      if (typeof prop === "string") {
        return !prop.includes("enableBundleCompression");
      }
      return true;
    });

    config.modResults = filtered;
    return config;
  });
};
